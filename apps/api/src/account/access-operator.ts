import { emailAddressSchema } from "@codelift/contracts";
import { Types } from "mongoose";

import type { CodeLiftModels } from "../persistence/models.js";
import { createOpaqueToken, digestOpaqueToken } from "./security.js";

export interface IssuedAccessToken {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface IssuedPasswordReset extends IssuedAccessToken {
  readonly email: string;
}

export type SelfServicePasswordResetResult =
  | ({ readonly kind: "issued" } & IssuedPasswordReset)
  | { readonly kind: "missing_account" }
  | { readonly kind: "cooldown" };

export type AccountAccessPurpose = "invite" | "password_reset";

export function buildAccountAccessUrl(
  baseUrl: string,
  purpose: AccountAccessPurpose,
  token: string
): string {
  const pathname = purpose === "invite" ? "/register" : "/reset-password";
  const parameter = purpose === "invite" ? "invite" : "token";
  const url = new URL(pathname, baseUrl);
  url.hash = new URLSearchParams({ [parameter]: token }).toString();
  return url.toString();
}

function boundedIssuer(value: string): string {
  const issuer = value.trim();
  if (!/^[A-Za-z0-9._:@-]{1,80}$/.test(issuer)) {
    throw new Error("Issuer must contain 1 to 80 bounded audit-safe characters.");
  }
  return issuer;
}

export async function issueInvitation(options: {
  models: CodeLiftModels;
  email: string;
  ttlMs: number;
  issuer: string;
  now?: Date;
}): Promise<IssuedAccessToken> {
  const email = emailAddressSchema.parse(options.email);
  const now = options.now ?? new Date();
  const token = createOpaqueToken();
  const invitation = await options.models.Invitation.create({
    tokenHash: digestOpaqueToken(token),
    purpose: "registration",
    email,
    expiresAt: new Date(now.getTime() + options.ttlMs),
    consumedAt: null,
    revokedAt: null,
    consumedByUserId: null,
    createdBy: boundedIssuer(options.issuer),
    createdAt: now
  });

  return { id: invitation._id.toString(), token, expiresAt: invitation.expiresAt };
}

export async function revokeUnusedInvitation(options: {
  models: CodeLiftModels;
  invitationId: string;
  now?: Date;
}): Promise<boolean> {
  if (!Types.ObjectId.isValid(options.invitationId)) {
    throw new Error("Invitation ID must be a Mongo object ID.");
  }
  const result = await options.models.Invitation.updateOne(
    { _id: options.invitationId, consumedAt: null, revokedAt: null },
    { $set: { revokedAt: options.now ?? new Date() } }
  );
  return result.modifiedCount === 1;
}

async function issuePasswordResetRecord(options: {
  models: CodeLiftModels;
  email: string;
  ttlMs: number;
  issuer: string;
  deliveryMethod: "email" | "operator";
  cooldownMs: number | null;
  now?: Date;
}): Promise<SelfServicePasswordResetResult> {
  const email = emailAddressSchema.parse(options.email);
  const now = options.now ?? new Date();
  const token = createOpaqueToken();
  const tokenHash = digestOpaqueToken(token);
  const expiresAt = new Date(now.getTime() + options.ttlMs);
  const createdBy = boundedIssuer(options.issuer);
  const databaseSession = await options.models.User.db.startSession();
  let result: SelfServicePasswordResetResult = { kind: "missing_account" };

  try {
    await databaseSession.withTransaction(async () => {
      const user = await options.models.User.findOneAndUpdate(
        { email },
        { $inc: { writeFence: 1 } },
        { session: databaseSession, returnDocument: "after" }
      );
      if (user === null) {
        result = { kind: "missing_account" };
        return;
      }

      if (options.deliveryMethod === "email") {
        await options.models.PasswordReset.updateMany(
          {
            userId: user._id,
            deliveryMethod: "email",
            sentAt: null,
            consumedAt: null,
            revokedAt: null
          },
          { $set: { revokedAt: now } },
          { session: databaseSession }
        );
        const cooldownBoundary = new Date(now.getTime() - (options.cooldownMs ?? 0));
        const recentDelivered = await options.models.PasswordReset.findOne(
          {
            userId: user._id,
            deliveryMethod: "email",
            sentAt: { $exists: true, $ne: null },
            consumedAt: null,
            revokedAt: null,
            createdAt: { $gt: cooldownBoundary }
          },
          null,
          { session: databaseSession }
        );
        if (recentDelivered !== null) {
          result = { kind: "cooldown" };
          return;
        }
      }

      await options.models.PasswordReset.updateMany(
        { userId: user._id, consumedAt: null, revokedAt: null },
        { $set: { revokedAt: now } },
        { session: databaseSession }
      );
      const [reset] = await options.models.PasswordReset.create(
        [
          {
            tokenHash,
            purpose: "password_reset",
            userId: user._id,
            expiresAt,
            consumedAt: null,
            revokedAt: null,
            createdBy,
            deliveryMethod: options.deliveryMethod,
            ...(options.deliveryMethod === "email" ? { sentAt: null } : {}),
            createdAt: now
          }
        ],
        { session: databaseSession }
      );
      if (reset === undefined) throw new Error("Password reset creation returned no record.");
      result = {
        kind: "issued",
        id: reset._id.toString(),
        token,
        email,
        expiresAt
      };
    });
  } finally {
    await databaseSession.endSession();
  }

  return result;
}

export async function issuePasswordReset(options: {
  models: CodeLiftModels;
  email: string;
  ttlMs: number;
  issuer: string;
  now?: Date;
}): Promise<IssuedAccessToken> {
  const result = await issuePasswordResetRecord({
    ...options,
    deliveryMethod: "operator",
    cooldownMs: null
  });
  if (result.kind !== "issued") {
    throw new Error("No account matches the normalized email.");
  }
  return { id: result.id, token: result.token, expiresAt: result.expiresAt };
}

export async function issueSelfServicePasswordReset(options: {
  models: CodeLiftModels;
  email: string;
  ttlMs: number;
  cooldownMs: number;
  now?: Date;
}): Promise<SelfServicePasswordResetResult> {
  return issuePasswordResetRecord({
    ...options,
    issuer: "self-service-email",
    deliveryMethod: "email",
    cooldownMs: options.cooldownMs
  });
}
