import {
  accountUserSchema,
  accountExportSchema,
  authenticatedTodayResponseSchema,
  emailAddressSchema,
  onboardingProfileSchema,
  progressDayResponseSchema,
  type AccountUser,
  type AccountExport,
  type AuthenticatedTodayResponse,
  type CurriculumSeedDay,
  type OnboardingProfile,
  type ProgressDayResponse,
  type ProgressEvidenceRequest,
  type ProgressReflectionRequest,
  type ProgressStatusRequest
} from "@codelift/contracts";
import { Types, type ClientSession, type HydratedDocument } from "mongoose";

import type { RegistrationConfig, SessionConfig } from "../config.js";
import type { CurriculumRuntime } from "../curriculum/runtime.js";
import { HttpProblem } from "../http/problem.js";
import type {
  CodeLiftModels,
  PilotAggregateEvent,
  ProgressRecord,
  ReflectionRecord,
  SessionRecord,
  UserRecord
} from "../persistence/models.js";
import { withActiveAccountWrite } from "../persistence/active-account-write.js";
import {
  issueSelfServicePasswordReset,
  type SelfServicePasswordResetResult
} from "./access-operator.js";
import { digestLoginCode, generateLoginCode } from "./email-login-code.js";
import {
  createDummyPasswordHash,
  createOpaqueToken,
  digestOpaqueToken,
  hashPassword,
  opaqueTokenMatches,
  verifyPassword
} from "./security.js";

type UserDocument = HydratedDocument<UserRecord>;
type SessionDocument = HydratedDocument<SessionRecord>;
type ProgressDocument = HydratedDocument<ProgressRecord>;
type ReflectionDocument = HydratedDocument<ReflectionRecord>;

export interface SessionIdentity {
  readonly sessionId: string;
  readonly userId: string | null;
}

export interface IssuedSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export interface AuthResult extends IssuedSession {
  readonly user: AccountUser;
}

export type EmailLoginCodeIssueResult =
  | {
      readonly kind: "issued";
      readonly id: string;
      readonly email: string;
      readonly code: string;
      readonly expiresAt: Date;
    }
  | { readonly kind: "missing_account" }
  | { readonly kind: "cooldown" };

const terminalStatuses = ["core_completed", "recovery_completed", "intentionally_skipped"] as const;

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === 11_000;
}

function accountProblem(slug: string, title: string, status: number, detail: string): HttpProblem {
  return new HttpProblem({
    type: `https://codelift.ai/problems/${slug}`,
    title,
    status,
    detail
  });
}

function invalidCredentials(): HttpProblem {
  return accountProblem(
    "invalid-credentials",
    "Unable to authenticate",
    401,
    "We couldn’t sign you in with those details."
  );
}

function accountDeletionCredentialsRejected(): HttpProblem {
  return accountProblem(
    "account-deletion-failed",
    "Account deletion failed",
    401,
    "The account was not deleted. Check the current password and confirmation."
  );
}

function sessionExpired(): HttpProblem {
  return accountProblem(
    "session-expired",
    "Session expired",
    401,
    "Your session ended to protect your account. Your progress was not changed."
  );
}

function authenticationRequired(): HttpProblem {
  return accountProblem(
    "authentication-required",
    "Authentication required",
    401,
    "Sign in to continue to this private workspace."
  );
}

function accessTokenRejected(): HttpProblem {
  return accountProblem(
    "account-access-rejected",
    "Unable to complete account access",
    400,
    "The account access link is invalid, expired, already used, or does not match this request."
  );
}

function exportTooLarge(): HttpProblem {
  return accountProblem(
    "export-too-large",
    "Account export too large",
    413,
    "The bounded private-pilot export exceeded its record or byte budget. Contact support for an isolated export."
  );
}

function toIso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function toUser(document: UserDocument): AccountUser {
  const profile =
    document.profile === null
      ? null
      : onboardingProfileSchema.parse({
          displayName: document.profile.displayName,
          timezone: document.profile.timezone,
          startDate: document.profile.startDate,
          commitmentMinutes: document.profile.commitmentMinutes,
          preferredCodingTime: document.profile.preferredCodingTime,
          routineCue: document.profile.routineCue,
          codingPlace: document.profile.codingPlace,
          implementationIntention: document.profile.implementationIntention,
          whyItMatters: document.profile.whyItMatters,
          githubUsername: document.profile.githubUsername,
          targetRoles: [...document.profile.targetRoles],
          aiPrivacyMode: document.profile.aiPrivacyMode,
          themePreference: document.profile.themePreference,
          motionPreference: document.profile.motionPreference,
          ...(document.profile.reviewPreference === undefined
            ? {}
            : { reviewPreference: document.profile.reviewPreference })
        });

  return accountUserSchema.parse({
    id: document._id.toString(),
    email: document.email,
    onboardingComplete: profile !== null,
    profile,
    createdAt: document.createdAt.toISOString()
  });
}

function emptyProgress(dayNumber: number): ProgressDayResponse {
  return progressDayResponseSchema.parse({
    dayNumber,
    status: "not_started",
    selectedMode: null,
    evidence: [],
    reflection: {
      confused: "",
      mentalModelChanged: "",
      retrieveLater: "",
      updatedAt: null
    },
    version: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
    statusReason: null,
    rescheduledFor: null
  });
}

function toProgress(
  dayNumber: number,
  progress: ProgressDocument | null,
  reflection: ReflectionDocument | null
): ProgressDayResponse {
  if (progress === null) {
    return emptyProgress(dayNumber);
  }

  return progressDayResponseSchema.parse({
    dayNumber: progress.dayNumber,
    status: progress.status,
    selectedMode: progress.selectedMode,
    evidence: progress.evidence.map((evidence) => ({
      id: evidence._id.toString(),
      kind: evidence.kind,
      label: evidence.label,
      value: evidence.value,
      idempotencyKey: evidence.idempotencyKey,
      createdAt: evidence.createdAt.toISOString()
    })),
    reflection: {
      confused: reflection?.confused ?? "",
      mentalModelChanged: reflection?.mentalModelChanged ?? "",
      retrieveLater: reflection?.retrieveLater ?? "",
      updatedAt: toIso(reflection?.updatedAt)
    },
    version: progress.version,
    startedAt: toIso(progress.startedAt),
    completedAt: toIso(progress.completedAt),
    updatedAt: toIso(progress.updatedAt),
    statusReason: progress.statusReason ?? null,
    rescheduledFor: progress.rescheduledFor ?? null
  });
}

function localDateInTimezone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year") ?? ""}-${values.get("month") ?? ""}-${values.get("day") ?? ""}`;
}

function reflectionIsComplete(reflection: ReflectionDocument | null): boolean {
  return (
    reflection !== null &&
    reflection.confused.trim().length > 0 &&
    reflection.mentalModelChanged.trim().length > 0 &&
    reflection.retrieveLater.trim().length > 0
  );
}

const forbiddenExportKeys = new Set([
  "_id",
  "__v",
  "userId",
  "consumedByUserId",
  "reviewItemId",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "csrfHash",
  "sessionSecret",
  "credential"
]);

function sanitizeExportRecord(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value, (key, child: unknown) => {
    if (forbiddenExportKeys.has(key) || key.toLowerCase().endsWith("hash")) {
      return undefined;
    }
    return child;
  });
  const parsed: unknown = JSON.parse(serialized);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Export record did not serialize to an object.");
  }
  return parsed as Record<string, unknown>;
}

interface ExportBudget {
  bytes: number;
}

const maxExportRecordsPerCollection = 1_000;
const maxExportPayloadBytes = 8 * 1_024 * 1_024;

async function collectBoundedExportRecords(
  values: AsyncIterable<unknown>,
  budget: ExportBudget
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for await (const value of values) {
    if (records.length >= maxExportRecordsPerCollection) throw exportTooLarge();
    const record = sanitizeExportRecord(value);
    budget.bytes += Buffer.byteLength(JSON.stringify(record), "utf8");
    if (budget.bytes > maxExportPayloadBytes) throw exportTooLarge();
    records.push(record);
  }
  return records;
}

export class AccountService {
  readonly #models: CodeLiftModels;
  readonly #curriculum: CurriculumRuntime;
  readonly #sessionConfig: SessionConfig;
  readonly #registrationConfig: RegistrationConfig;
  readonly #dummyPasswordHash: string;
  readonly #loginCodePepper: Buffer | null;
  readonly #now: () => Date;

  private constructor(options: {
    models: CodeLiftModels;
    curriculum: CurriculumRuntime;
    sessionConfig: SessionConfig;
    registrationConfig: RegistrationConfig;
    dummyPasswordHash: string;
    loginCodePepper?: Buffer | null;
    now?: () => Date;
  }) {
    this.#models = options.models;
    this.#curriculum = options.curriculum;
    this.#sessionConfig = options.sessionConfig;
    this.#registrationConfig = options.registrationConfig;
    this.#dummyPasswordHash = options.dummyPasswordHash;
    this.#loginCodePepper =
      options.loginCodePepper === undefined || options.loginCodePepper === null
        ? null
        : Buffer.from(options.loginCodePepper);
    this.#now = options.now ?? (() => new Date());
  }

  static async create(options: {
    models: CodeLiftModels;
    curriculum: CurriculumRuntime;
    sessionConfig: SessionConfig;
    registrationConfig: RegistrationConfig;
    loginCodePepper?: Buffer | null;
    now?: () => Date;
  }): Promise<AccountService> {
    const dummyPasswordHash = await createDummyPasswordHash();
    return new AccountService({
      ...options,
      dummyPasswordHash
    });
  }

  async #createSession(
    userId: Types.ObjectId | null,
    databaseSession?: ClientSession
  ): Promise<IssuedSession> {
    const now = this.#now();
    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const absoluteExpiresAt = new Date(now.getTime() + this.#sessionConfig.absoluteTtlMs);
    const idleExpiresAt = new Date(now.getTime() + this.#sessionConfig.idleTtlMs);
    const expiresAt =
      idleExpiresAt.getTime() < absoluteExpiresAt.getTime() ? idleExpiresAt : absoluteExpiresAt;

    await this.#models.Session.create(
      [
        {
          tokenHash: digestOpaqueToken(sessionToken),
          csrfHash: digestOpaqueToken(csrfToken),
          userId,
          issuedAt: now,
          lastSeenAt: now,
          idleExpiresAt,
          absoluteExpiresAt,
          expiresAt,
          schemaVersion: 1
        }
      ],
      databaseSession === undefined ? undefined : { session: databaseSession }
    );
    if (userId !== null) {
      await this.#recordAuthenticatedActivity(userId, now, databaseSession);
    }

    return {
      sessionToken,
      csrfToken,
      expiresAt
    };
  }

  async #recordAuthenticatedActivity(
    userId: Types.ObjectId,
    now: Date,
    databaseSession?: ClientSession
  ): Promise<void> {
    const write = async (session: ClientSession) => {
      await this.#models.UserActivity.updateOne(
        { userId, date: now.toISOString().slice(0, 10) },
        {
          $min: { firstSeenAt: now },
          $max: { lastSeenAt: now }
        },
        { session, upsert: true, setDefaultsOnInsert: true }
      );
    };

    if (databaseSession !== undefined) {
      await write(databaseSession);
      return;
    }
    await withActiveAccountWrite(this.#models, userId.toString(), sessionExpired, write);
  }

  async #findSession(rawToken: string): Promise<SessionDocument | null> {
    const session = await this.#models.Session.findOne({
      tokenHash: digestOpaqueToken(rawToken)
    });

    if (session === null) {
      return null;
    }

    const now = this.#now();
    if (
      session.idleExpiresAt.getTime() <= now.getTime() ||
      session.absoluteExpiresAt.getTime() <= now.getTime()
    ) {
      await this.#models.Session.deleteOne({ _id: session._id });
      return null;
    }

    const nextIdle = new Date(now.getTime() + this.#sessionConfig.idleTtlMs);
    const idleExpiresAt =
      nextIdle.getTime() < session.absoluteExpiresAt.getTime()
        ? nextIdle
        : session.absoluteExpiresAt;

    session.lastSeenAt = now;
    session.idleExpiresAt = idleExpiresAt;
    session.expiresAt = idleExpiresAt;
    await session.save();
    return session;
  }

  async issueCsrf(rawSessionToken: string | null): Promise<IssuedSession> {
    const existing = rawSessionToken === null ? null : await this.#findSession(rawSessionToken);

    if (existing === null) {
      return this.#createSession(null);
    }

    const csrfToken = createOpaqueToken();
    existing.csrfHash = digestOpaqueToken(csrfToken);
    await existing.save();

    return {
      sessionToken: rawSessionToken ?? "",
      csrfToken,
      expiresAt: existing.expiresAt
    };
  }

  async verifyCsrf(
    rawSessionToken: string | null,
    csrfToken: string | null
  ): Promise<SessionIdentity> {
    if (rawSessionToken === null || csrfToken === null) {
      throw accountProblem(
        "csrf-invalid",
        "Security check failed",
        403,
        "Your security check is missing or expired. Refresh protection, then submit again."
      );
    }

    const session = await this.#findSession(rawSessionToken);
    if (session === null || !opaqueTokenMatches(csrfToken, session.csrfHash)) {
      throw accountProblem(
        "csrf-invalid",
        "Security check failed",
        403,
        "Your security check is missing or expired. Refresh protection, then submit again."
      );
    }

    return {
      sessionId: session._id.toString(),
      userId: session.userId?.toString() ?? null
    };
  }

  async register(
    identity: SessionIdentity,
    email: string,
    password: string,
    invitationToken?: string
  ): Promise<AuthResult> {
    if (identity.userId !== null) {
      throw accountProblem(
        "progress-conflict",
        "Account already authenticated",
        409,
        "Sign out before creating a different account."
      );
    }

    if (this.#registrationConfig.mode === "closed") {
      throw accessTokenRejected();
    }

    if (this.#registrationConfig.mode === "invite_only" && invitationToken === undefined) {
      throw accessTokenRejected();
    }

    const passwordHash = await hashPassword(password);
    const databaseSession = await this.#models.User.db.startSession();
    let result: AuthResult | null = null;

    try {
      await databaseSession.withTransaction(async () => {
        const [user] = await this.#models.User.create(
          [
            {
              email,
              passwordHash,
              profile: null,
              schemaVersion: 1
            }
          ],
          { session: databaseSession }
        );

        if (user === undefined) {
          throw new Error("User creation did not return a document.");
        }

        if (this.#registrationConfig.mode === "invite_only") {
          const invitation = await this.#models.Invitation.findOneAndUpdate(
            {
              tokenHash: digestOpaqueToken(invitationToken ?? ""),
              purpose: "registration",
              email,
              expiresAt: { $gt: this.#now() },
              consumedAt: null,
              revokedAt: null
            },
            {
              $set: {
                consumedAt: this.#now(),
                consumedByUserId: user._id
              }
            },
            { session: databaseSession, returnDocument: "after" }
          );
          if (invitation === null) {
            throw accessTokenRejected();
          }
        }

        await this.#models.Session.deleteOne(
          { _id: identity.sessionId },
          { session: databaseSession }
        );
        const issued = await this.#createSession(user._id, databaseSession);
        result = {
          ...issued,
          user: toUser(user)
        };
      });
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw this.#registrationConfig.mode === "invite_only"
          ? accessTokenRejected()
          : invalidCredentials();
      }
      throw error;
    } finally {
      await databaseSession.endSession();
    }

    if (result === null) {
      throw accountProblem(
        "service-unavailable",
        "Account service unavailable",
        503,
        "The account could not be created safely. Try again."
      );
    }

    return result;
  }

  async login(identity: SessionIdentity, email: string, password: string): Promise<AuthResult> {
    const user = await this.#models.User.findOne({ email }).select("+passwordHash");
    const passwordIsValid =
      user === null
        ? await verifyPassword(this.#dummyPasswordHash, password)
        : await verifyPassword(user.passwordHash, password);

    if (user === null || !passwordIsValid) {
      throw invalidCredentials();
    }

    const databaseSession = await this.#models.User.db.startSession();
    let issued: IssuedSession | null = null;

    try {
      await databaseSession.withTransaction(async () => {
        const activeAccount = await this.#models.User.updateOne(
          { _id: user._id, passwordHash: user.passwordHash },
          { $inc: { writeFence: 1 } },
          { session: databaseSession }
        );
        if (activeAccount.matchedCount !== 1) {
          throw invalidCredentials();
        }
        await this.#models.Session.deleteOne(
          { _id: identity.sessionId },
          { session: databaseSession }
        );
        issued = await this.#createSession(user._id, databaseSession);
      });
    } finally {
      await databaseSession.endSession();
    }

    const authenticatedSession = issued as IssuedSession | null;
    if (authenticatedSession === null) {
      throw accountProblem(
        "service-unavailable",
        "Account service unavailable",
        503,
        "The session could not be created safely. Try again."
      );
    }

    return {
      ...authenticatedSession,
      user: toUser(user)
    };
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    const now = this.#now();
    const databaseSession = await this.#models.User.db.startSession();

    try {
      await databaseSession.withTransaction(async () => {
        const reset = await this.#models.PasswordReset.findOneAndUpdate(
          {
            tokenHash: digestOpaqueToken(rawToken),
            purpose: "password_reset",
            expiresAt: { $gt: now },
            consumedAt: null,
            revokedAt: null,
            $or: [
              { deliveryMethod: { $ne: "email" } },
              {
                deliveryMethod: "email",
                sentAt: { $exists: true, $ne: null }
              }
            ]
          },
          { $set: { consumedAt: now } },
          { session: databaseSession, returnDocument: "after" }
        );
        if (reset === null) {
          throw accessTokenRejected();
        }

        const updated = await this.#models.User.updateOne(
          { _id: reset.userId },
          { $set: { passwordHash } },
          { session: databaseSession, runValidators: true }
        );
        if (updated.matchedCount !== 1) {
          throw accessTokenRejected();
        }

        await this.#models.PasswordReset.updateMany(
          {
            userId: reset.userId,
            _id: { $ne: reset._id },
            consumedAt: null,
            revokedAt: null
          },
          { $set: { revokedAt: now } },
          { session: databaseSession }
        );

        await this.#models.Session.deleteMany(
          { userId: reset.userId },
          { session: databaseSession }
        );
      });
    } finally {
      await databaseSession.endSession();
    }
  }

  async issueSelfServicePasswordReset(email: string): Promise<SelfServicePasswordResetResult> {
    return issueSelfServicePasswordReset({
      models: this.#models,
      email,
      ttlMs: this.#registrationConfig.passwordResetTtlMs,
      cooldownMs: 60_000,
      now: this.#now()
    });
  }

  async acknowledgePasswordResetDelivery(resetId: string): Promise<boolean> {
    const now = this.#now();
    const result = await this.#models.PasswordReset.updateOne(
      {
        _id: resetId,
        deliveryMethod: "email",
        sentAt: null,
        expiresAt: { $gt: now },
        consumedAt: null,
        revokedAt: null
      },
      { $set: { sentAt: now } }
    );
    return result.modifiedCount === 1;
  }

  async revokePasswordResetDelivery(resetId: string): Promise<void> {
    await this.#models.PasswordReset.updateOne(
      {
        _id: resetId,
        deliveryMethod: "email",
        consumedAt: null,
        revokedAt: null
      },
      { $set: { revokedAt: this.#now() } }
    );
  }

  async issueEmailLoginCode(emailInput: string): Promise<EmailLoginCodeIssueResult> {
    if (this.#loginCodePepper === null) {
      throw new Error("Email login-code issuance requires configured HMAC key material.");
    }
    const email = emailAddressSchema.parse(emailInput);
    const now = this.#now();
    const code = generateLoginCode();
    const codeId = new Types.ObjectId();
    const codeDigest = digestLoginCode({
      pepper: this.#loginCodePepper,
      recordIdHex: codeId.toString(),
      code
    });
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
    const cooldownBoundary = new Date(now.getTime() - 60_000);
    const databaseSession = await this.#models.User.db.startSession();
    let result: EmailLoginCodeIssueResult = { kind: "missing_account" };

    try {
      await databaseSession.withTransaction(async () => {
        const user = await this.#models.User.findOneAndUpdate(
          { email },
          { $inc: { writeFence: 1 } },
          { session: databaseSession, returnDocument: "after" }
        );
        if (user === null) {
          result = { kind: "missing_account" };
          return;
        }

        const recentActive = await this.#models.EmailLoginCode.findOne(
          {
            userId: user._id,
            purpose: "email_login",
            createdAt: { $gt: cooldownBoundary },
            consumedAt: null,
            revokedAt: null
          },
          null,
          { session: databaseSession }
        );
        if (recentActive !== null) {
          result = { kind: "cooldown" };
          return;
        }

        await this.#models.EmailLoginCode.updateMany(
          {
            userId: user._id,
            purpose: "email_login",
            consumedAt: null,
            revokedAt: null
          },
          { $set: { revokedAt: now } },
          { session: databaseSession }
        );
        const [created] = await this.#models.EmailLoginCode.create(
          [
            {
              _id: codeId,
              userId: user._id,
              purpose: "email_login",
              codeDigest,
              expiresAt,
              sentAt: null,
              consumedAt: null,
              revokedAt: null,
              failedAttempts: 0,
              createdAt: now
            }
          ],
          { session: databaseSession }
        );
        if (created === undefined) {
          throw new Error("Email login-code creation returned no record.");
        }
        result = {
          kind: "issued",
          id: created._id.toString(),
          email,
          code,
          expiresAt
        };
      });
    } finally {
      await databaseSession.endSession();
    }

    return result;
  }

  async acknowledgeEmailLoginCodeDelivery(codeId: string): Promise<boolean> {
    const now = this.#now();
    const result = await this.#models.EmailLoginCode.updateOne(
      {
        _id: codeId,
        purpose: "email_login",
        sentAt: null,
        expiresAt: { $gt: now },
        consumedAt: null,
        revokedAt: null
      },
      { $set: { sentAt: now } }
    );
    return result.modifiedCount === 1;
  }

  async revokeEmailLoginCodeDelivery(codeId: string): Promise<void> {
    await this.#models.EmailLoginCode.updateOne(
      {
        _id: codeId,
        purpose: "email_login",
        consumedAt: null,
        revokedAt: null
      },
      { $set: { revokedAt: this.#now() } }
    );
  }

  async authenticate(rawSessionToken: string | null): Promise<{
    identity: SessionIdentity;
    user: AccountUser;
  }> {
    if (rawSessionToken === null) {
      throw authenticationRequired();
    }

    const session = await this.#findSession(rawSessionToken);
    if (session === null || session.userId === null) {
      throw sessionExpired();
    }

    const user = await this.#models.User.findOne({ _id: session.userId });
    if (user === null) {
      await this.#models.Session.deleteOne({ _id: session._id });
      throw sessionExpired();
    }
    await this.#recordAuthenticatedActivity(user._id, this.#now());

    return {
      identity: {
        sessionId: session._id.toString(),
        userId: user._id.toString()
      },
      user: toUser(user)
    };
  }

  async me(rawSessionToken: string | null): Promise<AccountUser | null> {
    if (rawSessionToken === null) {
      return null;
    }
    const session = await this.#findSession(rawSessionToken);
    if (session === null || session.userId === null) {
      return null;
    }
    const user = await this.#models.User.findOne({ _id: session.userId });
    if (user === null) {
      await this.#models.Session.deleteOne({ _id: session._id });
      return null;
    }
    await this.#recordAuthenticatedActivity(user._id, this.#now());
    return toUser(user);
  }

  async logout(identity: SessionIdentity): Promise<void> {
    await this.#models.Session.deleteOne({ _id: identity.sessionId });
  }

  async saveOnboarding(userId: string, profile: OnboardingProfile): Promise<AccountUser> {
    const parsedProfile = onboardingProfileSchema.parse(profile);
    const user = await this.#models.User.findOne({ _id: userId });

    if (user === null) {
      throw sessionExpired();
    }
    user.profile = parsedProfile;
    user.onboardedAt ??= this.#now();
    await user.save();

    return toUser(user);
  }

  async exportAccount(userId: string): Promise<AccountExport> {
    const user = await this.#models.User.findOne({ _id: userId });
    if (user === null) {
      throw sessionExpired();
    }
    const owner = user._id;
    const serializedUser = toUser(user);
    const budget: ExportBudget = {
      bytes: Buffer.byteLength(JSON.stringify(serializedUser), "utf8") + 2_048
    };
    const progress = await collectBoundedExportRecords(
      this.#models.Progress.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const reflections = await collectBoundedExportRecords(
      this.#models.Reflection.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const authenticatedActivity = await collectBoundedExportRecords(
      this.#models.UserActivity.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const reviewItems = await collectBoundedExportRecords(
      this.#models.ReviewItem.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const misconceptions = await collectBoundedExportRecords(
      this.#models.Misconception.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const errorMuseumEntries = await collectBoundedExportRecords(
      this.#models.ErrorMuseumEntry.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const portfolioArtifacts = await collectBoundedExportRecords(
      this.#models.PortfolioArtifact.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const jobApplications = await collectBoundedExportRecords(
      this.#models.JobApplication.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const xpEvents = await collectBoundedExportRecords(
      this.#models.XpEvent.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const achievements = await collectBoundedExportRecords(
      this.#models.UserAchievement.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const skillEvidence = await collectBoundedExportRecords(
      this.#models.SkillEvidence.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const aiTraces = await collectBoundedExportRecords(
      this.#models.AiTrace.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const evalRuns = await collectBoundedExportRecords(
      this.#models.EvalRun.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const indexedSources = await collectBoundedExportRecords(
      this.#models.IndexedSource.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const agentRuns = await collectBoundedExportRecords(
      this.#models.AgentRun.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );
    const invitationMetadata = await collectBoundedExportRecords(
      this.#models.Invitation.find({
        $or: [{ consumedByUserId: owner }, { email: user.email }]
      })
        .lean()
        .batchSize(25)
        .cursor(),
      budget
    );
    const passwordResetMetadata = await collectBoundedExportRecords(
      this.#models.PasswordReset.find({ userId: owner }).lean().batchSize(25).cursor(),
      budget
    );

    return accountExportSchema.parse({
      schemaVersion: "codelift.account-export.v1",
      exportedAt: this.#now().toISOString(),
      account: serializedUser,
      sourceRecords: {
        progress,
        reflections,
        authenticatedActivity,
        reviewItems,
        misconceptions,
        errorMuseumEntries,
        portfolioArtifacts,
        jobApplications
      },
      derivedRecords: {
        xpEvents,
        achievements,
        skillEvidence,
        aiTraces,
        evalRuns,
        indexedSources,
        agentRuns,
        invitationMetadata,
        passwordResetMetadata
      }
    });
  }

  async recordPilotEvent(event: PilotAggregateEvent): Promise<void> {
    await this.#models.PilotAggregate.updateOne(
      { date: this.#now().toISOString().slice(0, 10), event },
      { $inc: { count: 1 } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  async recordPilotEventBestEffort(event: PilotAggregateEvent): Promise<void> {
    try {
      await this.recordPilotEvent(event);
    } catch {
      // Authentication behavior does not depend on privacy-safe aggregate telemetry.
    }
  }

  async today(userId: string): Promise<AuthenticatedTodayResponse> {
    const user = await this.#models.User.findOne({ _id: userId });
    if (user === null) {
      throw sessionExpired();
    }
    if (user.profile === null) {
      throw accountProblem(
        "onboarding-required",
        "Onboarding required",
        409,
        "Complete onboarding before opening Today."
      );
    }
    if (this.#curriculum.status !== "ready") {
      throw accountProblem(
        "service-unavailable",
        "Curriculum unavailable",
        503,
        "Today cannot be selected until the curriculum passes validation."
      );
    }

    const serializedUser = toUser(user);
    const profile = serializedUser.profile;
    if (profile === null) {
      throw accountProblem(
        "onboarding-required",
        "Onboarding required",
        409,
        "Complete onboarding before opening Today."
      );
    }
    const today = localDateInTimezone(this.#now(), profile.timezone);
    if (profile.startDate > today) {
      return authenticatedTodayResponseSchema.parse({
        selection: "future_start",
        user: serializedUser,
        day: null,
        progress: null,
        futureStartDate: profile.startDate
      });
    }

    const completed = await this.#models.Progress.find({
      userId: user._id,
      status: { $in: terminalStatuses }
    })
      .select("dayNumber")
      .lean();
    const completedDays = new Set(completed.map((record) => record.dayNumber));
    let selectedDayNumber: number | null = null;

    for (let dayNumber = 1; dayNumber <= 365; dayNumber += 1) {
      if (!completedDays.has(dayNumber)) {
        selectedDayNumber = dayNumber;
        break;
      }
    }

    if (selectedDayNumber === null) {
      return authenticatedTodayResponseSchema.parse({
        selection: "curriculum_complete",
        user: serializedUser,
        day: null,
        progress: null,
        futureStartDate: null
      });
    }

    const day: CurriculumSeedDay | undefined = this.#curriculum.getDay(selectedDayNumber);
    if (day === undefined) {
      throw accountProblem(
        "service-unavailable",
        "Curriculum unavailable",
        503,
        "The selected curriculum day is not available."
      );
    }

    const [progress, reflection] = await Promise.all([
      this.#models.Progress.findOne({ userId: user._id, dayNumber: selectedDayNumber }),
      this.#models.Reflection.findOne({ userId: user._id, dayNumber: selectedDayNumber })
    ]);

    return authenticatedTodayResponseSchema.parse({
      selection: "next_incomplete",
      user: serializedUser,
      day,
      progress: toProgress(selectedDayNumber, progress, reflection),
      futureStartDate: null
    });
  }

  async #progressSnapshot(userId: string, dayNumber: number): Promise<ProgressDayResponse> {
    const [progress, reflection] = await Promise.all([
      this.#models.Progress.findOne({ userId, dayNumber }),
      this.#models.Reflection.findOne({ userId, dayNumber })
    ]);
    return toProgress(dayNumber, progress, reflection);
  }

  async updateStatus(
    userId: string,
    dayNumber: number,
    request: ProgressStatusRequest
  ): Promise<ProgressDayResponse> {
    const now = this.#now();
    let progress = await this.#models.Progress.findOne({ userId, dayNumber });

    if (progress?.operationKeys.includes(request.idempotencyKey) === true) {
      return this.#progressSnapshot(userId, dayNumber);
    }

    if (request.intent === "start") {
      if (progress === null) {
        try {
          progress = await withActiveAccountWrite(
            this.#models,
            userId,
            sessionExpired,
            async (databaseSession) => {
              const [created] = await this.#models.Progress.create(
                [
                  {
                    userId,
                    dayNumber,
                    status: "in_progress",
                    selectedMode: request.mode,
                    evidence: [],
                    operationKeys: [request.idempotencyKey],
                    version: 1,
                    startedAt: now,
                    completedAt: null,
                    statusReason: null,
                    rescheduledFor: null
                  }
                ],
                { session: databaseSession }
              );
              if (created === undefined) {
                throw new Error("Progress creation did not return a record.");
              }
              return created;
            }
          );
        } catch (error: unknown) {
          if (!isDuplicateKeyError(error)) {
            throw error;
          }
          progress = await this.#models.Progress.findOne({ userId, dayNumber });
        }
      }

      if (progress === null) {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "The mission state changed. Reload Today before trying again."
        );
      }

      if (
        progress.status === "not_started" ||
        progress.status === "opened" ||
        progress.status === "rescheduled"
      ) {
        progress.status = "in_progress";
        progress.selectedMode = request.mode;
        progress.startedAt = progress.startedAt ?? now;
        progress.completedAt = null;
        progress.statusReason = null;
        progress.rescheduledFor = null;
        progress.operationKeys.push(request.idempotencyKey);
        progress.version += 1;
        await progress.save();
        return this.#progressSnapshot(userId, dayNumber);
      }

      if (progress.status !== "in_progress" || progress.selectedMode !== request.mode) {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "Core and Recovery cannot replace one another after a mission has started."
        );
      }

      if (!progress.operationKeys.includes(request.idempotencyKey)) {
        progress.operationKeys.push(request.idempotencyKey);
        progress.version += 1;
        await progress.save();
      }

      return this.#progressSnapshot(userId, dayNumber);
    }

    if (progress === null) {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "Start this mission before recording completion."
      );
    }
    const terminalStatus = request.mode === "core" ? "core_completed" : "recovery_completed";
    if (progress.status === terminalStatus) {
      return this.#progressSnapshot(userId, dayNumber);
    }
    if (progress.status !== "in_progress" || progress.selectedMode !== request.mode) {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "The requested completion does not match the mission that was started."
      );
    }
    if (request.expectedVersion !== undefined && request.expectedVersion !== progress.version) {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "The mission changed in another request. Reload Today before completing it."
      );
    }
    if (progress.evidence.length === 0) {
      throw accountProblem(
        "completion-evidence-required",
        "Evidence required",
        409,
        "Add explicit evidence before recording completion."
      );
    }

    await withActiveAccountWrite(this.#models, userId, sessionExpired, async (databaseSession) => {
      const currentProgress = await this.#models.Progress.findOne({
        _id: progress._id,
        userId,
        dayNumber,
        status: "in_progress",
        selectedMode: request.mode
      }).session(databaseSession);
      if (
        currentProgress === null ||
        (request.expectedVersion !== undefined &&
          request.expectedVersion !== currentProgress.version)
      ) {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "The mission changed in another request. Reload Today before completing it."
        );
      }
      if (currentProgress.evidence.length === 0) {
        throw accountProblem(
          "completion-evidence-required",
          "Evidence required",
          409,
          "Add explicit evidence before recording completion."
        );
      }

      const currentReflection = await this.#models.Reflection.findOne({
        userId,
        dayNumber
      }).session(databaseSession);
      if (!reflectionIsComplete(currentReflection)) {
        throw accountProblem(
          "completion-reflection-required",
          "Reflection required",
          409,
          "Answer all three reflection prompts before recording completion."
        );
      }

      const updated = await this.#models.Progress.findOneAndUpdate(
        {
          _id: currentProgress._id,
          userId,
          dayNumber,
          status: "in_progress",
          selectedMode: request.mode,
          version: currentProgress.version
        },
        {
          $set: {
            status: terminalStatus,
            completedAt: now
          },
          $addToSet: {
            operationKeys: request.idempotencyKey
          },
          $inc: {
            version: 1
          }
        },
        { session: databaseSession, returnDocument: "after", runValidators: true }
      );

      if (updated === null) {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "The mission changed in another request. Reload Today before completing it."
        );
      }
    });

    return this.#progressSnapshot(userId, dayNumber);
  }

  async addEvidence(
    userId: string,
    dayNumber: number,
    evidence: ProgressEvidenceRequest
  ): Promise<ProgressDayResponse> {
    const progress = await this.#models.Progress.findOne({ userId, dayNumber });
    if (progress === null || progress.status !== "in_progress") {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "Start this mission before saving evidence."
      );
    }

    if (progress.evidence.some((item) => item.idempotencyKey === evidence.idempotencyKey)) {
      return this.#progressSnapshot(userId, dayNumber);
    }
    if (progress.evidence.length >= 25) {
      throw accountProblem(
        "validation-failed",
        "Evidence limit reached",
        422,
        "A mission can contain at most 25 evidence records."
      );
    }

    const updated = await this.#models.Progress.findOneAndUpdate(
      {
        _id: progress._id,
        userId,
        dayNumber,
        status: "in_progress",
        "evidence.idempotencyKey": { $ne: evidence.idempotencyKey }
      },
      {
        $push: {
          evidence: {
            ...evidence,
            createdAt: this.#now()
          }
        },
        $inc: {
          version: 1
        }
      },
      { returnDocument: "after", runValidators: true }
    );

    if (updated === null) {
      const replay = await this.#models.Progress.findOne({ userId, dayNumber });
      if (replay?.evidence.some((item) => item.idempotencyKey === evidence.idempotencyKey)) {
        return this.#progressSnapshot(userId, dayNumber);
      }
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "The mission changed before evidence could be saved."
      );
    }

    return this.#progressSnapshot(userId, dayNumber);
  }

  async saveReflection(
    userId: string,
    dayNumber: number,
    reflection: ProgressReflectionRequest
  ): Promise<ProgressDayResponse> {
    await withActiveAccountWrite(this.#models, userId, sessionExpired, async (databaseSession) => {
      const progress = await this.#models.Progress.findOne({ userId, dayNumber }).session(
        databaseSession
      );
      if (progress === null || progress.status !== "in_progress") {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "Start this mission before saving a reflection."
        );
      }

      const existing = await this.#models.Reflection.findOne({ userId, dayNumber }).session(
        databaseSession
      );
      if (existing?.operationKeys.includes(reflection.idempotencyKey) === true) {
        return;
      }

      const claimed = await this.#models.Progress.updateOne(
        {
          _id: progress._id,
          userId,
          dayNumber,
          status: "in_progress",
          version: progress.version
        },
        { $inc: { version: 1 } },
        { session: databaseSession }
      );
      if (claimed.matchedCount !== 1) {
        throw accountProblem(
          "progress-conflict",
          "Progress conflict",
          409,
          "The mission changed before the reflection could be saved."
        );
      }

      await this.#models.Reflection.findOneAndUpdate(
        { userId, dayNumber },
        {
          $set: {
            confused: reflection.confused,
            mentalModelChanged: reflection.mentalModelChanged,
            retrieveLater: reflection.retrieveLater
          },
          $addToSet: {
            operationKeys: reflection.idempotencyKey
          }
        },
        {
          session: databaseSession,
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );
    });

    return this.#progressSnapshot(userId, dayNumber);
  }

  async deleteAccount(
    identity: SessionIdentity,
    password: string,
    confirmation: "DELETE"
  ): Promise<void> {
    void confirmation;
    if (identity.userId === null) {
      throw authenticationRequired();
    }

    const user = await this.#models.User.findOne({ _id: identity.userId }).select("+passwordHash");
    if (user === null || !(await verifyPassword(user.passwordHash, password))) {
      throw accountDeletionCredentialsRejected();
    }

    const databaseSession = await this.#models.User.db.startSession();
    const credentialsRejected = accountDeletionCredentialsRejected();
    try {
      await databaseSession.withTransaction(async () => {
        const deletionFence = await this.#models.User.updateOne(
          { _id: user._id, passwordHash: user.passwordHash },
          { $inc: { writeFence: 1 } },
          { session: databaseSession }
        );
        if (deletionFence.matchedCount !== 1) {
          throw credentialsRejected;
        }

        // The MongoDB Node driver does not support parallel operations on one
        // transaction session. Keep the deletion registry explicit and serial.
        await this.#models.Progress.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.Reflection.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.UserActivity.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.XpEvent.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.UserAchievement.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.SkillEvidence.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.ReviewItem.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.Misconception.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.ErrorMuseumEntry.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.PortfolioArtifact.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.AiTrace.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.EvalRun.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.IndexedSource.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.AgentRun.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.JobApplication.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await this.#models.Session.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.Invitation.deleteMany(
          {
            $or: [{ consumedByUserId: user._id }, { email: user.email }]
          },
          { session: databaseSession }
        );
        await this.#models.PasswordReset.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        const deleted = await this.#models.User.deleteOne(
          { _id: user._id },
          { session: databaseSession }
        );
        if (deleted.deletedCount !== 1) {
          throw new Error("Account ownership changed during deletion.");
        }
        await this.#models.PilotAggregate.updateOne(
          {
            date: this.#now().toISOString().slice(0, 10),
            event: "account_deletion_succeeded"
          },
          { $inc: { count: 1 } },
          { session: databaseSession, upsert: true, setDefaultsOnInsert: true }
        );
      });
    } catch (error: unknown) {
      if (error === credentialsRejected) throw error;
      throw accountProblem(
        "account-deletion-failed",
        "Account deletion failed",
        503,
        "The account and session remain available because deletion did not complete safely."
      );
    } finally {
      await databaseSession.endSession();
    }
  }
}
