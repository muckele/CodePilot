import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

export const E2E_BASE_URL = process.env.CODELIFT_E2E_BASE_URL ?? "http://127.0.0.1:5173";
export const E2E_API_URL = process.env.CODELIFT_E2E_API_URL ?? "http://127.0.0.1:4000";
export const E2E_MONGO_URI =
  process.env.CODELIFT_E2E_MONGO_URI ??
  "mongodb://127.0.0.1:27018/codelift_e2e_test?replicaSet=rs0&directConnection=true";

const outboxIdentity = createHash("sha256")
  .update(`${process.cwd()}\0${E2E_MONGO_URI}`, "utf8")
  .digest("hex")
  .slice(0, 16);

export const E2E_EMAIL_OUTBOX_DIR =
  process.env.CODELIFT_E2E_EMAIL_OUTBOX_DIR ??
  join(tmpdir(), `codelift-email-outbox-${outboxIdentity}`);

export function guardedE2eDatabaseName(uri = E2E_MONGO_URI): string {
  const databaseName = new URL(uri).pathname.slice(1);
  if (!/^[A-Za-z0-9_-]+_e2e_test$/u.test(databaseName)) {
    throw new Error("Playwright Mongo database names must end in _e2e_test.");
  }
  return databaseName;
}

export const E2E_DATABASE_NAME = guardedE2eDatabaseName();

export function guardedE2eEmailOutboxPath(candidate = E2E_EMAIL_OUTBOX_DIR): string {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The Playwright email outbox requires NODE_ENV=test.");
  }
  if (process.env.EMAIL_PROVIDER !== undefined && process.env.EMAIL_PROVIDER !== "fake") {
    throw new Error("The Playwright email outbox refuses non-fake email providers.");
  }
  if (
    process.env.RESEND_API_KEY !== undefined ||
    process.env.RESEND_API_KEY_FILE !== undefined ||
    process.env.EMAIL_FROM !== undefined
  ) {
    throw new Error("The Playwright email outbox refuses Resend/provider configuration.");
  }

  const temporaryRoot = resolve(tmpdir());
  const resolved = resolve(candidate);
  const relativePath = relative(temporaryRoot, resolved);
  if (
    !isAbsolute(candidate) ||
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error("The Playwright email outbox must be an absolute private temporary path.");
  }
  return resolved;
}
