import {
  accountUserSchema,
  authenticatedTodayResponseSchema,
  onboardingProfileSchema,
  progressDayResponseSchema,
  type AccountUser,
  type AuthenticatedTodayResponse,
  type CurriculumSeedDay,
  type OnboardingProfile,
  type ProgressDayResponse,
  type ProgressEvidenceRequest,
  type ProgressReflectionRequest,
  type ProgressStatusRequest
} from "@codelift/contracts";
import type { ClientSession, HydratedDocument, Types } from "mongoose";

import type { SessionConfig } from "../config.js";
import type { CurriculumRuntime } from "../curriculum/runtime.js";
import { HttpProblem } from "../http/problem.js";
import type {
  CodeLiftModels,
  ProgressRecord,
  ReflectionRecord,
  SessionRecord,
  UserRecord
} from "../persistence/models.js";
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

export class AccountService {
  readonly #models: CodeLiftModels;
  readonly #curriculum: CurriculumRuntime;
  readonly #sessionConfig: SessionConfig;
  readonly #dummyPasswordHash: string;
  readonly #now: () => Date;

  private constructor(options: {
    models: CodeLiftModels;
    curriculum: CurriculumRuntime;
    sessionConfig: SessionConfig;
    dummyPasswordHash: string;
    now?: () => Date;
  }) {
    this.#models = options.models;
    this.#curriculum = options.curriculum;
    this.#sessionConfig = options.sessionConfig;
    this.#dummyPasswordHash = options.dummyPasswordHash;
    this.#now = options.now ?? (() => new Date());
  }

  static async create(options: {
    models: CodeLiftModels;
    curriculum: CurriculumRuntime;
    sessionConfig: SessionConfig;
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

    return {
      sessionToken,
      csrfToken,
      expiresAt
    };
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

  async register(identity: SessionIdentity, email: string, password: string): Promise<AuthResult> {
    if (identity.userId !== null) {
      throw accountProblem(
        "progress-conflict",
        "Account already authenticated",
        409,
        "Sign out before creating a different account."
      );
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
        throw invalidCredentials();
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
    return toUser(user);
  }

  async logout(identity: SessionIdentity): Promise<void> {
    await this.#models.Session.deleteOne({ _id: identity.sessionId });
  }

  async saveOnboarding(userId: string, profile: OnboardingProfile): Promise<AccountUser> {
    const parsedProfile = onboardingProfileSchema.parse(profile);
    const user = await this.#models.User.findOneAndUpdate(
      { _id: userId },
      { $set: { profile: parsedProfile } },
      { returnDocument: "after", runValidators: true }
    );

    if (user === null) {
      throw sessionExpired();
    }

    return toUser(user);
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
          progress = await this.#models.Progress.create({
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
          });
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

    const reflection = await this.#models.Reflection.findOne({ userId, dayNumber });
    if (!reflectionIsComplete(reflection)) {
      throw accountProblem(
        "completion-reflection-required",
        "Reflection required",
        409,
        "Answer all three reflection prompts before recording completion."
      );
    }

    const updated = await this.#models.Progress.findOneAndUpdate(
      {
        _id: progress._id,
        userId,
        dayNumber,
        status: "in_progress",
        selectedMode: request.mode,
        version: progress.version
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
      { returnDocument: "after", runValidators: true }
    );

    if (updated === null) {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "The mission changed in another request. Reload Today before completing it."
      );
    }

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
    const progress = await this.#models.Progress.findOne({ userId, dayNumber });
    if (progress === null || progress.status !== "in_progress") {
      throw accountProblem(
        "progress-conflict",
        "Progress conflict",
        409,
        "Start this mission before saving a reflection."
      );
    }

    const existing = await this.#models.Reflection.findOne({ userId, dayNumber });
    if (existing?.operationKeys.includes(reflection.idempotencyKey) === true) {
      return this.#progressSnapshot(userId, dayNumber);
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
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

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
      throw accountProblem(
        "account-deletion-failed",
        "Account deletion failed",
        401,
        "The account was not deleted. Check the current password and confirmation."
      );
    }

    const databaseSession = await this.#models.User.db.startSession();
    try {
      await databaseSession.withTransaction(async () => {
        // The MongoDB Node driver does not support parallel operations on one
        // transaction session. Keep the deletion registry explicit and serial.
        await this.#models.Progress.deleteMany({ userId: user._id }, { session: databaseSession });
        await this.#models.Reflection.deleteMany(
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
        const deleted = await this.#models.User.deleteOne(
          { _id: user._id },
          { session: databaseSession }
        );
        if (deleted.deletedCount !== 1) {
          throw new Error("Account ownership changed during deletion.");
        }
      });
    } catch {
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
