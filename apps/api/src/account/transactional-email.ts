import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { accountAccessTokenSchema, emailLoginCodeSchema } from "@codelift/contracts";

export type TransactionalEmailFailureReason =
  "timeout" | "rejected" | "rate_limited" | "unauthorized" | "unavailable";

export class TransactionalEmailError extends Error {
  readonly reason: TransactionalEmailFailureReason;

  constructor(reason: TransactionalEmailFailureReason) {
    super("Transactional email delivery failed.");
    this.name = "TransactionalEmailError";
    this.reason = reason;
  }
}

export interface PasswordResetEmailInput {
  readonly to: string;
  readonly resetUrl: string;
  readonly expiresAt: Date;
  readonly idempotencyKey: string;
}

export interface LoginCodeEmailInput {
  readonly to: string;
  readonly code: string;
  readonly expiresAt: Date;
  readonly idempotencyKey: string;
}

export interface TransactionalEmailProvider {
  sendPasswordReset(input: PasswordResetEmailInput): Promise<void>;
  sendLoginCode(input: LoginCodeEmailInput): Promise<void>;
}

export interface RenderedTransactionalEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export type TransactionalEmailMessage =
  | ({ readonly purpose: "password-reset" } & PasswordResetEmailInput)
  | ({ readonly purpose: "email-login-code" } & LoginCodeEmailInput);

export type FakeTransactionalEmailOutboxRecord =
  | {
      readonly version: 1;
      readonly purpose: "password-reset";
      readonly to: string;
      readonly resetUrl: string;
      readonly expiresAt: string;
    }
  | {
      readonly version: 1;
      readonly purpose: "email-login-code";
      readonly to: string;
      readonly code: string;
      readonly expiresAt: string;
    };

const syntheticOutboxRecipient = /^e2e-[a-z0-9][a-z0-9-]*-[a-f0-9]{12}@example\.test$/u;

function assertValidExpiry(expiresAt: Date): void {
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
    throw new Error("Transactional email expiry must be a valid date.");
  }
}

function validatedResetUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Password reset URL must be an absolute HTTP or HTTPS URL.");
  }
  const parameters = new URLSearchParams(url.hash.slice(1));
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/reset-password" ||
    url.search !== "" ||
    parameters.size !== 1 ||
    !accountAccessTokenSchema.safeParse(parameters.get("token")).success
  ) {
    throw new Error("Password reset URL did not match the internal access-link contract.");
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPasswordResetEmail(input: {
  resetUrl: string;
  expiresAt: Date;
}): RenderedTransactionalEmail {
  assertValidExpiry(input.expiresAt);
  const resetLink = validatedResetUrl(input.resetUrl);
  const expiresAt = input.expiresAt.toISOString();
  return {
    subject: "Reset your CodeLift AI password",
    text: [
      "A password reset was requested for your CodeLift AI account.",
      "",
      `Reset your password: ${resetLink}`,
      "",
      `This one-time link expires in one hour (${expiresAt}).`,
      "If you did not request this password reset, you can ignore this email."
    ].join("\n"),
    html: [
      "<p>A password reset was requested for your CodeLift AI account.</p>",
      `<p><a href="${escapeHtml(resetLink)}">Reset your password</a></p>`,
      `<p>This one-time link expires in one hour (${escapeHtml(expiresAt)}).</p>`,
      "<p>If you did not request this password reset, you can ignore this email.</p>"
    ].join("")
  };
}

export function renderLoginCodeEmail(input: {
  code: string;
  expiresAt: Date;
}): RenderedTransactionalEmail {
  const code = emailLoginCodeSchema.parse(input.code);
  assertValidExpiry(input.expiresAt);
  const expiresAt = input.expiresAt.toISOString();
  return {
    subject: "Your CodeLift AI sign-in code",
    text: [
      "Use this CodeLift AI sign-in code:",
      "",
      code,
      "",
      `This single-use code expires in ten minutes (${expiresAt}).`,
      "If you did not request this sign-in code, you can ignore this email."
    ].join("\n"),
    html: [
      "<p>Use this CodeLift AI sign-in code:</p>",
      `<p><strong>${code}</strong></p>`,
      `<p>This single-use code expires in ten minutes (${escapeHtml(expiresAt)}).</p>`,
      "<p>If you did not request this sign-in code, you can ignore this email.</p>"
    ].join("")
  };
}

export function opaqueProviderIdempotencyKey(
  purpose: "password-reset" | "email-login-code",
  recordIdHex: string
): string {
  if (!/^[0-9a-f]{24}$/i.test(recordIdHex)) {
    throw new Error("Provider idempotency requires one internal record identifier.");
  }
  const digest = createHash("sha256")
    .update("codelift:email-idempotency:v1\0", "utf8")
    .update(purpose, "utf8")
    .update("\0", "utf8")
    .update(recordIdHex.toLowerCase(), "utf8")
    .digest("base64url");
  return `codelift-v1-${digest}`;
}

export class FakeTransactionalEmailProvider implements TransactionalEmailProvider {
  readonly #messages: TransactionalEmailMessage[] = [];
  readonly #failWith: TransactionalEmailFailureReason | null;
  readonly #outboxDir: string | null;

  constructor(
    options: {
      failWith?: TransactionalEmailFailureReason;
      nodeEnv?: string;
      outboxDir?: string | null;
    } = {}
  ) {
    this.#failWith = options.failWith ?? null;
    this.#outboxDir = options.outboxDir ?? null;
    if (this.#outboxDir !== null) {
      if (options.nodeEnv !== "test") {
        throw new Error("The fake email outbox is available only in test mode.");
      }
      const resolvedOutbox = resolve(this.#outboxDir);
      const resolvedTemporaryRoot = resolve(tmpdir());
      const relativePath = relative(resolvedTemporaryRoot, resolvedOutbox);
      if (
        !isAbsolute(this.#outboxDir) ||
        relativePath === "" ||
        relativePath === ".." ||
        relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
        isAbsolute(relativePath)
      ) {
        throw new Error("The fake email outbox must be a private temporary test directory.");
      }
    }
  }

  get messages(): readonly TransactionalEmailMessage[] {
    return this.#messages;
  }

  async sendPasswordReset(input: PasswordResetEmailInput): Promise<void> {
    this.#messages.push({ purpose: "password-reset", ...input });
    this.#finish();
    await this.#writeOutbox({
      version: 1,
      purpose: "password-reset",
      to: input.to,
      resetUrl: input.resetUrl,
      expiresAt: input.expiresAt.toISOString()
    });
  }

  async sendLoginCode(input: LoginCodeEmailInput): Promise<void> {
    this.#messages.push({ purpose: "email-login-code", ...input });
    this.#finish();
    await this.#writeOutbox({
      version: 1,
      purpose: "email-login-code",
      to: input.to,
      code: input.code,
      expiresAt: input.expiresAt.toISOString()
    });
  }

  clear(): void {
    this.#messages.length = 0;
  }

  #finish(): void {
    if (this.#failWith !== null) {
      throw new TransactionalEmailError(this.#failWith);
    }
  }

  async #writeOutbox(message: FakeTransactionalEmailOutboxRecord): Promise<void> {
    if (this.#outboxDir === null) return;
    if (!syntheticOutboxRecipient.test(message.to)) {
      throw new Error("The fake email outbox accepts only synthetic test recipients.");
    }

    await mkdir(this.#outboxDir, { recursive: true, mode: 0o700 });
    await chmod(this.#outboxDir, 0o700);
    const [directory, resolvedDirectory, resolvedTemporaryRoot] = await Promise.all([
      lstat(this.#outboxDir),
      realpath(this.#outboxDir),
      realpath(tmpdir())
    ]);
    const relativePath = relative(resolvedTemporaryRoot, resolvedDirectory);
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      relativePath === "" ||
      relativePath === ".." ||
      relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error("The fake email outbox is not a private temporary directory.");
    }

    const identifier = randomUUID();
    const temporaryPath = join(this.#outboxDir, `.${identifier}.tmp`);
    const finalPath = join(this.#outboxDir, `${identifier}.json`);
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      file = await open(temporaryPath, "wx", 0o600);
      await file.writeFile(`${JSON.stringify(message)}\n`, "utf8");
      await file.sync();
      await file.close();
      file = undefined;
      await rename(temporaryPath, finalPath);
    } catch (error: unknown) {
      await file?.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

export class DisabledTransactionalEmailProvider implements TransactionalEmailProvider {
  async sendPasswordReset(): Promise<void> {
    throw new TransactionalEmailError("unavailable");
  }

  async sendLoginCode(): Promise<void> {
    throw new TransactionalEmailError("unavailable");
  }
}
