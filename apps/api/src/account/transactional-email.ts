import { createHash } from "node:crypto";
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

  constructor(options: { failWith?: TransactionalEmailFailureReason } = {}) {
    this.#failWith = options.failWith ?? null;
  }

  get messages(): readonly TransactionalEmailMessage[] {
    return this.#messages;
  }

  async sendPasswordReset(input: PasswordResetEmailInput): Promise<void> {
    this.#messages.push({ purpose: "password-reset", ...input });
    this.#finish();
  }

  async sendLoginCode(input: LoginCodeEmailInput): Promise<void> {
    this.#messages.push({ purpose: "email-login-code", ...input });
    this.#finish();
  }

  clear(): void {
    this.#messages.length = 0;
  }

  #finish(): void {
    if (this.#failWith !== null) {
      throw new TransactionalEmailError(this.#failWith);
    }
  }
}

export class DisabledTransactionalEmailProvider implements TransactionalEmailProvider {
  async sendPasswordReset(_input: PasswordResetEmailInput): Promise<void> {
    throw new TransactionalEmailError("unavailable");
  }

  async sendLoginCode(_input: LoginCodeEmailInput): Promise<void> {
    throw new TransactionalEmailError("unavailable");
  }
}
