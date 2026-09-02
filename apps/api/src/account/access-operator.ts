import { emailAddressSchema } from "@codelift/contracts";
import { Types } from "mongoose";

import type { CodeLiftModels } from "../persistence/models.js";
import { createOpaqueToken, digestOpaqueToken } from "./security.js";

export interface IssuedAccessToken {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: Date;
}

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

export async function issuePasswordReset(options: {
  models: CodeLiftModels;
  email: string;
  ttlMs: number;
  issuer: string;
  now?: Date;
}): Promise<IssuedAccessToken> {
  const email = emailAddressSchema.parse(options.email);
  const now = options.now ?? new Date();
  const token = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + options.ttlMs);
  const createdBy = boundedIssuer(options.issuer);
  const databaseSession = await options.models.User.db.startSession();
  let resetId: string | null = null;

  try {
    await databaseSession.withTransaction(async () => {
      const user = await options.models.User.findOneAndUpdate(
        { email },
        { $inc: { writeFence: 1 } },
        { session: databaseSession, returnDocument: "after" }
      );
      if (user === null) {
        throw new Error("No account matches the normalized email.");
      }

      await options.models.PasswordReset.updateMany(
        { userId: user._id, consumedAt: null, revokedAt: null },
        { $set: { revokedAt: now } },
        { session: databaseSession }
      );
      const [reset] = await options.models.PasswordReset.create(
        [
          {
            tokenHash: digestOpaqueToken(token),
            purpose: "password_reset",
            userId: user._id,
            expiresAt,
            consumedAt: null,
            revokedAt: null,
            createdBy
          }
        ],
        { session: databaseSession }
      );
      if (reset === undefined) throw new Error("Password reset creation returned no record.");
      resetId = reset._id.toString();
    });
  } finally {
    await databaseSession.endSession();
  }

  if (resetId === null) throw new Error("Password reset creation did not complete.");
  return { id: resetId, token, expiresAt };
}
