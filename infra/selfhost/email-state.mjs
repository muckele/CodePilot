import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const environmentNames = new Set([
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_REQUEST_TIMEOUT_MS",
  "RESEND_API_KEY_HOST_FILE",
  "EMAIL_LOGIN_CODE_PEPPER_HOST_FILE"
]);
const directSecretNames = new Set(["RESEND_API_KEY", "EMAIL_LOGIN_CODE_PEPPER"]);

function paths(root) {
  return {
    environment: join(root, "ops", "compose.env"),
    key: join(root, "secrets", "resend-api-key"),
    pepper: join(root, "secrets", "email-login-code-pepper"),
    rollback: join(root, "secrets", "resend-api-key.rollback")
  };
}

function privateRegularFile(path, expectedUid = process.getuid()) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch {
    throw new Error("Required protected email state file is unavailable.");
  }
  if (metadata.isSymbolicLink()) throw new Error("Email secret files must not be symlinks.");
  if (!metadata.isFile()) throw new Error("Email secret files must be regular files.");
  if (metadata.uid !== expectedUid)
    throw new Error("Email secret files must have the operator owner.");
  if ((metadata.mode & 0o777) !== 0o600) throw new Error("Email secret files must use mode 0600.");
  return metadata;
}

function decodeEnvironmentValue(raw) {
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function readEnvironment(root) {
  const { environment } = paths(root);
  privateRegularFile(environment);
  const text = readFileSync(environment, "utf8");
  const values = new Map();
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) throw new Error("Invalid protected Compose environment state.");
    if (values.has(match[1])) throw new Error("Duplicate protected Compose environment setting.");
    values.set(match[1], decodeEnvironmentValue(match[2]));
  }
  for (const name of directSecretNames) {
    if (values.has(name))
      throw new Error("Email state contains an unsupported direct secret value.");
  }
  return { text, values };
}

function environmentValue(value) {
  if (value.includes("\n") || value.includes("\r") || value.includes("'")) {
    throw new Error("Invalid protected Compose environment value.");
  }
  return /^[A-Za-z0-9_@.:/+,-]+$/u.test(value) ? value : `'${value}'`;
}

function writePrivateAtomic(path, content) {
  const temporary = `${path}.${randomBytes(12).toString("hex")}.tmp`;
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function writeEnvironment(root, values) {
  const { environment } = paths(root);
  const current = readEnvironment(root)
    .text.split("\n")
    .filter((line) => {
      const name = /^([A-Z][A-Z0-9_]*)=/u.exec(line)?.[1];
      return name === undefined || (!environmentNames.has(name) && !directSecretNames.has(name));
    })
    .filter((line, index, lines) => line !== "" || index < lines.length - 1);
  const emailLines = [
    ["EMAIL_PROVIDER", values.provider],
    ["EMAIL_FROM", values.from],
    ...(values.replyTo === null ? [] : [["EMAIL_REPLY_TO", values.replyTo]]),
    ["EMAIL_REQUEST_TIMEOUT_MS", String(values.requestTimeoutMs)],
    ["RESEND_API_KEY_HOST_FILE", values.keyHostFile],
    ["EMAIL_LOGIN_CODE_PEPPER_HOST_FILE", values.pepperHostFile]
  ].map(([name, value]) => `${name}=${environmentValue(value)}`);
  writePrivateAtomic(environment, `${[...current, ...emailLines].join("\n")}\n`);
}

function normalizedMailbox(value, name) {
  if (
    typeof value !== "string" ||
    value !== value.trim().toLowerCase() ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u.test(
      value
    )
  ) {
    throw new Error(`${name} must be one normalized bare mailbox address.`);
  }
  return value;
}

function boundedTimeout(value) {
  const timeout = Number(value);
  if (
    !/^[0-9]+$/u.test(String(value)) ||
    !Number.isInteger(timeout) ||
    timeout < 1000 ||
    timeout > 10000
  ) {
    throw new Error(
      "Email request timeout must be an integer from 1000 through 10000 milliseconds."
    );
  }
  return timeout;
}

function validResendKey(value) {
  return (
    value.length >= 16 &&
    value.length <= 512 &&
    /^re_[\x21-\x7e]+$/u.test(value) &&
    !/\s/u.test(value)
  );
}

function readResendKey(path, expectedUid) {
  const metadata = privateRegularFile(path, expectedUid);
  if (metadata.size > 513) throw new Error("Resend key file must contain one bounded value.");
  const raw = readFileSync(path, "utf8");
  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error("Resend key file must contain one single-line value.");
  }
  if (!validResendKey(value))
    throw new Error("Resend key file must contain one bounded Resend key.");
  return value;
}

export function validateResendKeySource(path, expectedUid = process.getuid()) {
  if (!isAbsolute(path)) throw new Error("Resend key source must be an absolute path.");
  const resolvedPath = resolve(path);
  const repositoryRelative = relative(repositoryRoot, resolvedPath);
  if (
    repositoryRelative === "" ||
    (!repositoryRelative.startsWith("..") && !isAbsolute(repositoryRelative))
  ) {
    throw new Error("Resend key source must remain outside the repository.");
  }
  return readResendKey(resolvedPath, expectedUid);
}

function readPepper(path) {
  const metadata = privateRegularFile(path);
  if (metadata.size !== 43)
    throw new Error("Email login-code pepper must encode exactly 32 bytes.");
  const value = readFileSync(path, "utf8");
  const decoded = Buffer.from(value, "base64url");
  if (
    !/^[A-Za-z0-9_-]{43}$/u.test(value) ||
    decoded.length !== 32 ||
    decoded.toString("base64url") !== value
  ) {
    throw new Error("Email login-code pepper must encode exactly 32 bytes.");
  }
  return value;
}

function defaultEnvironment() {
  return {
    provider: "disabled",
    from: "disabled@localhost",
    replyTo: null,
    requestTimeoutMs: 5000,
    keyHostFile: "/dev/null",
    pepperHostFile: "/dev/null"
  };
}

export function prepareEmailState(root) {
  const target = paths(root);
  const { values } = readEnvironment(root);
  const hasAnySetting = [...environmentNames].some((name) => values.has(name));
  if (!hasAnySetting) {
    if (existsSync(target.key) || existsSync(target.pepper) || existsSync(target.rollback)) {
      throw new Error("Existing email secret files have no consistent protected configuration.");
    }
    writeEnvironment(root, defaultEnvironment());
  }
  return validateEmailState(root);
}

export function validateEmailState(root) {
  const target = paths(root);
  const { values } = readEnvironment(root);
  const provider = values.get("EMAIL_PROVIDER");
  if (provider !== "disabled" && provider !== "resend") {
    throw new Error("Production email provider must be disabled or resend; fake is forbidden.");
  }
  const requestTimeoutMs = boundedTimeout(values.get("EMAIL_REQUEST_TIMEOUT_MS"));
  const rotationPending = existsSync(target.rollback);
  if (provider === "disabled") {
    if (existsSync(target.key) || existsSync(target.pepper) || rotationPending) {
      throw new Error("Disabled email state must not retain provider or pepper secret files.");
    }
    if (
      values.get("RESEND_API_KEY_HOST_FILE") !== "/dev/null" ||
      values.get("EMAIL_LOGIN_CODE_PEPPER_HOST_FILE") !== "/dev/null"
    ) {
      throw new Error("Disabled email state must use non-secret null mounts.");
    }
    return { provider, from: null, replyTo: null, requestTimeoutMs, rotationPending: false };
  }

  const from = normalizedMailbox(values.get("EMAIL_FROM"), "EMAIL_FROM");
  const replyToValue = values.get("EMAIL_REPLY_TO");
  const replyTo =
    replyToValue === undefined ? null : normalizedMailbox(replyToValue, "EMAIL_REPLY_TO");
  if (
    values.get("RESEND_API_KEY_HOST_FILE") !== target.key ||
    values.get("EMAIL_LOGIN_CODE_PEPPER_HOST_FILE") !== target.pepper
  ) {
    throw new Error("Configured email state must mount only the exact operator secret files.");
  }
  readResendKey(target.key);
  readPepper(target.pepper);
  if (rotationPending) readResendKey(target.rollback);
  return { provider, from, replyTo, requestTimeoutMs, rotationPending };
}

export function configureEmailState({
  root,
  from,
  replyTo = null,
  keyFile,
  requestTimeoutMs = 5000
}) {
  const current = prepareEmailState(root);
  const key = validateResendKeySource(keyFile);
  const normalizedFrom = normalizedMailbox(from, "EMAIL_FROM");
  const normalizedReplyTo = replyTo === null ? null : normalizedMailbox(replyTo, "EMAIL_REPLY_TO");
  const timeout = boundedTimeout(requestTimeoutMs);
  const target = paths(root);

  if (current.provider === "resend") {
    if (current.rotationPending)
      throw new Error("Finish or roll back the pending email key rotation first.");
    if (readResendKey(target.key) !== key) {
      throw new Error("Use email key rotation to replace a configured provider key.");
    }
    if (
      current.from === normalizedFrom &&
      current.replyTo === normalizedReplyTo &&
      current.requestTimeoutMs === timeout
    ) {
      return { changed: false, ...current };
    }
    writeEnvironment(root, {
      provider: "resend",
      from: normalizedFrom,
      replyTo: normalizedReplyTo,
      requestTimeoutMs: timeout,
      keyHostFile: target.key,
      pepperHostFile: target.pepper
    });
    return { changed: true, ...validateEmailState(root) };
  }

  try {
    writePrivateAtomic(target.key, key);
    writePrivateAtomic(target.pepper, randomBytes(32).toString("base64url"));
    writeEnvironment(root, {
      provider: "resend",
      from: normalizedFrom,
      replyTo: normalizedReplyTo,
      requestTimeoutMs: timeout,
      keyHostFile: target.key,
      pepperHostFile: target.pepper
    });
  } catch (error) {
    if (existsSync(target.key)) unlinkSync(target.key);
    if (existsSync(target.pepper)) unlinkSync(target.pepper);
    throw error;
  }
  return { changed: true, ...validateEmailState(root) };
}

export function rotateEmailKey({ root, keyFile }) {
  const current = validateEmailState(root);
  if (current.provider !== "resend") throw new Error("Email key rotation requires resend mode.");
  if (current.rotationPending) throw new Error("An email key rotation is already pending.");
  const target = paths(root);
  const replacement = validateResendKeySource(keyFile);
  const active = readResendKey(target.key);
  if (replacement === active) return { changed: false, ...current };
  try {
    writeFileSync(target.rollback, active, { mode: 0o600, flag: "wx" });
    writePrivateAtomic(target.key, replacement);
  } catch (error) {
    if (existsSync(target.rollback)) unlinkSync(target.rollback);
    throw error;
  }
  return { changed: true, ...validateEmailState(root) };
}

export function finalizeEmailKeyRotation(root) {
  const current = validateEmailState(root);
  if (current.provider !== "resend" || !current.rotationPending) {
    throw new Error("No email key rotation is pending finalization.");
  }
  unlinkSync(paths(root).rollback);
  return validateEmailState(root);
}

export function rollbackEmailKey(root) {
  const current = validateEmailState(root);
  if (current.provider !== "resend" || !current.rotationPending) {
    throw new Error("No email key rotation is pending rollback.");
  }
  const target = paths(root);
  writePrivateAtomic(target.key, readResendKey(target.rollback));
  unlinkSync(target.rollback);
  return validateEmailState(root);
}

export function rotateEmailPepper({ root, invalidateActiveCodes = false }) {
  if (!invalidateActiveCodes) {
    throw new Error("Pepper rotation requires explicit --invalidate-active-codes authorization.");
  }
  const current = validateEmailState(root);
  if (current.provider !== "resend") throw new Error("Pepper rotation requires resend mode.");
  if (current.rotationPending)
    throw new Error("Finish or roll back the pending email key rotation first.");
  writePrivateAtomic(paths(root).pepper, randomBytes(32).toString("base64url"));
  return validateEmailState(root);
}

export function disableEmailState(root) {
  const current = prepareEmailState(root);
  if (current.provider === "disabled") return { changed: false, ...current };
  if (current.rotationPending)
    throw new Error("Finish or roll back the pending email key rotation first.");
  const target = paths(root);
  unlinkSync(target.key);
  unlinkSync(target.pepper);
  writeEnvironment(root, defaultEnvironment());
  return { changed: true, ...validateEmailState(root) };
}
