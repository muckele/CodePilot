import type { EmailConfig } from "../config.js";
import {
  TransactionalEmailError,
  renderLoginCodeEmail,
  renderPasswordResetEmail,
  type LoginCodeEmailInput,
  type PasswordResetEmailInput,
  type RenderedTransactionalEmail,
  type TransactionalEmailFailureReason,
  type TransactionalEmailProvider
} from "./transactional-email.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ResendTransactionalEmailProviderOptions {
  readonly apiKey: string;
  readonly from: string;
  readonly replyTo: string | null;
  readonly timeoutMs: number;
  readonly fetch?: FetchLike;
}

function responseFailureReason(status: number): TransactionalEmailFailureReason {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "rejected";
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export class ResendTransactionalEmailProvider implements TransactionalEmailProvider {
  readonly #apiKey: string;
  readonly #from: string;
  readonly #replyTo: string | null;
  readonly #timeoutMs: number;
  readonly #fetch: FetchLike;

  constructor(options: ResendTransactionalEmailProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#from = options.from;
    this.#replyTo = options.replyTo;
    this.#timeoutMs = options.timeoutMs;
    this.#fetch = options.fetch ?? fetch;
  }

  async sendPasswordReset(input: PasswordResetEmailInput): Promise<void> {
    await this.#send(input.to, input.idempotencyKey, renderPasswordResetEmail(input));
  }

  async sendLoginCode(input: LoginCodeEmailInput): Promise<void> {
    await this.#send(input.to, input.idempotencyKey, renderLoginCodeEmail(input));
  }

  async #send(
    to: string,
    idempotencyKey: string,
    message: RenderedTransactionalEmail
  ): Promise<void> {
    const body = {
      from: `CodeLift AI <${this.#from}>`,
      to: [to],
      ...(this.#replyTo === null ? {} : { reply_to: this.#replyTo }),
      subject: message.subject,
      text: message.text,
      html: message.html
    };

    let response: Response;
    try {
      response = await this.#fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "codelift-api/0.1.1",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.#timeoutMs)
      });
    } catch (error) {
      throw new TransactionalEmailError(isTimeoutError(error) ? "timeout" : "unavailable");
    }

    if (!response.ok) {
      throw new TransactionalEmailError(responseFailureReason(response.status));
    }
  }
}

export function createResendTransactionalEmailProvider(
  config: EmailConfig,
  fetchImplementation?: FetchLike
): ResendTransactionalEmailProvider {
  if (
    config.provider !== "resend" ||
    config.resendApiKey === null ||
    config.from === null ||
    config.loginCodePepper === null
  ) {
    throw new Error("Resend provider requires validated static email configuration.");
  }
  return new ResendTransactionalEmailProvider({
    apiKey: config.resendApiKey,
    from: config.from,
    replyTo: config.replyTo,
    timeoutMs: config.requestTimeoutMs,
    ...(fetchImplementation === undefined ? {} : { fetch: fetchImplementation })
  });
}
