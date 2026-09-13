import process from "node:process";

import { loadApiConfig } from "../config.js";
import { closePersistence, initializePersistence } from "../persistence/runtime.js";
import {
  buildAccountAccessUrl,
  issueInvitation,
  issuePasswordReset,
  revokeUnusedInvitation
} from "./access-operator.js";

function option(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (required && (value === undefined || value.startsWith("--"))) {
    throw new Error(`--${name} is required.`);
  }
  return value;
}

function safeBaseUrl(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("--base-url must use HTTPS, except for local loopback development.");
  }
  if (
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("--base-url must be an origin without credentials, query, or fragment.");
  }
  return parsed.origin;
}

const action = process.argv[2];
if (
  action !== "issue-invite" &&
  action !== "revoke-invite" &&
  action !== "issue-reset" &&
  action !== "invalidate-email-login-codes"
) {
  throw new Error(
    "Action must be issue-invite, revoke-invite, issue-reset, or invalidate-email-login-codes."
  );
}

const config = loadApiConfig({
  ...process.env,
  REGISTRATION_MODE: process.env.REGISTRATION_MODE ?? "closed",
  PERSISTENCE_MODE: "required",
  MONGO_URI:
    process.env.MONGO_URI ??
    "mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true"
});
const persistence = await initializePersistence(config.persistence);
if (persistence.status !== "ready") {
  throw new Error("MongoDB is required for operator account-access commands.");
}

try {
  if (action === "invalidate-email-login-codes") {
    const result = await persistence.models.EmailLoginCode.deleteMany({ consumedAt: null });
    process.stdout.write(`${JSON.stringify({ action, deleted: result.deletedCount })}\n`);
  } else if (action === "revoke-invite") {
    const revoked = await revokeUnusedInvitation({
      models: persistence.models,
      invitationId: option("id") ?? ""
    });
    process.stdout.write(`${JSON.stringify({ action, revoked })}\n`);
  } else {
    const baseUrl = safeBaseUrl(option("base-url") ?? config.webOrigin);
    const email = option("email") ?? "";
    const issuer = option("issuer", false) ?? "operator-cli";
    const issued =
      action === "issue-invite"
        ? await issueInvitation({
            models: persistence.models,
            email,
            issuer,
            ttlMs: config.registration.invitationTtlMs
          })
        : await issuePasswordReset({
            models: persistence.models,
            email,
            issuer,
            ttlMs: config.registration.passwordResetTtlMs
          });
    process.stdout.write(
      `${JSON.stringify({
        action,
        id: issued.id,
        expiresAt: issued.expiresAt.toISOString(),
        url: buildAccountAccessUrl(
          baseUrl,
          action === "issue-invite" ? "invite" : "password_reset",
          issued.token
        )
      })}\n`
    );
  }
} finally {
  await closePersistence(persistence);
}
