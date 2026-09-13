import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  FakeTransactionalEmailProvider,
  TransactionalEmailError,
  opaqueProviderIdempotencyKey,
  renderLoginCodeEmail,
  renderPasswordResetEmail
} from "../account/transactional-email.js";
import { ResendTransactionalEmailProvider } from "../account/resend-email.js";

const recipient = "learner@example.test";
const resetUrl = `https://pilot.example.test/reset-password#token=${"r".repeat(43)}`;
const resetExpiry = new Date("2026-09-13T06:00:00.000Z");
const codeExpiry = new Date("2026-09-13T05:10:00.000Z");

describe("transactional email content", () => {
  it("renders fixed, local password-reset content in text and minimal HTML", () => {
    const message = renderPasswordResetEmail({ resetUrl, expiresAt: resetExpiry });

    expect(message.subject).toBe("Reset your CodeLift AI password");
    for (const body of [message.text, message.html]) {
      expect(body).toContain("CodeLift AI");
      expect(body).toContain("password reset");
      expect(body).toContain(resetUrl);
      expect(body).toContain("one hour");
      expect(body).toContain("ignore this email");
    }
  });

  it("renders exactly one six-digit, single-use sign-in code per body", () => {
    const message = renderLoginCodeEmail({ code: "001204", expiresAt: codeExpiry });

    expect(message.subject).toBe("Your CodeLift AI sign-in code");
    for (const body of [message.text, message.html]) {
      expect(body.match(/001204/g)).toHaveLength(1);
      expect(body).toContain("ten minutes");
      expect(body).toContain("single-use");
      expect(body).toContain("ignore this email");
    }
    expect(() => renderLoginCodeEmail({ code: "12345x", expiresAt: codeExpiry })).toThrow();
    expect(() =>
      renderPasswordResetEmail({ resetUrl: "javascript:alert(1)", expiresAt: resetExpiry })
    ).toThrow();
  });
});

describe("fake transactional email provider", () => {
  it("captures structured calls without network and can fail deterministically", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new FakeTransactionalEmailProvider();
    const passwordReset = {
      to: recipient,
      resetUrl,
      expiresAt: resetExpiry,
      idempotencyKey: opaqueProviderIdempotencyKey("password-reset", "64f000000000000000000001")
    };
    await provider.sendPasswordReset(passwordReset);

    expect(provider.messages).toEqual([{ purpose: "password-reset", ...passwordReset }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const failing = new FakeTransactionalEmailProvider({ failWith: "unavailable" });
    await expect(
      failing.sendLoginCode({
        to: recipient,
        code: "001204",
        expiresAt: codeExpiry,
        idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f000000000000000000002")
      })
    ).rejects.toMatchObject({
      name: "TransactionalEmailError",
      reason: "unavailable",
      message: "Transactional email delivery failed."
    });
    expect(failing.messages).toHaveLength(1);
  });

  it("writes only synthetic test messages as atomic private outbox files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codelift-email-outbox-provider-"));
    try {
      const provider = new FakeTransactionalEmailProvider({
        nodeEnv: "test",
        outboxDir: directory
      });
      await provider.sendLoginCode({
        to: "e2e-email-code-0123456789ab@example.test",
        code: "001204",
        expiresAt: codeExpiry,
        idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f000000000000000000002")
      });

      const files = await readdir(directory);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^[a-f0-9-]+\.json$/u);
      expect(files.some((file) => file.includes(".tmp"))).toBe(false);
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      const messagePath = join(directory, files[0] ?? "missing");
      expect((await stat(messagePath)).mode & 0o777).toBe(0o600);
      const message = JSON.parse(await readFile(messagePath, "utf8")) as Record<string, unknown>;
      expect(message).toEqual({
        version: 1,
        purpose: "email-login-code",
        to: "e2e-email-code-0123456789ab@example.test",
        code: "001204",
        expiresAt: codeExpiry.toISOString()
      });
      expect(JSON.stringify(message)).not.toContain("64f000000000000000000002");
      expect(JSON.stringify(message)).not.toContain("codelift-v1-");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not publish an outbox record when the fake provider rejects delivery", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codelift-email-outbox-provider-"));
    try {
      const provider = new FakeTransactionalEmailProvider({
        failWith: "unavailable",
        nodeEnv: "test",
        outboxDir: directory
      });

      await expect(
        provider.sendLoginCode({
          to: "e2e-email-code-0123456789ab@example.test",
          code: "001204",
          expiresAt: codeExpiry,
          idempotencyKey: opaqueProviderIdempotencyKey(
            "email-login-code",
            "64f000000000000000000002"
          )
        })
      ).rejects.toMatchObject({ reason: "unavailable" });
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses an outbox outside test mode or for a non-synthetic recipient", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codelift-email-outbox-provider-"));
    try {
      expect(
        () =>
          new FakeTransactionalEmailProvider({
            nodeEnv: "production",
            outboxDir: directory
          })
      ).toThrow("test mode");

      const provider = new FakeTransactionalEmailProvider({
        nodeEnv: "test",
        outboxDir: directory
      });
      await expect(
        provider.sendPasswordReset({
          to: recipient,
          resetUrl,
          expiresAt: resetExpiry,
          idempotencyKey: opaqueProviderIdempotencyKey("password-reset", "64f000000000000000000001")
        })
      ).rejects.toThrow("synthetic");
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("opaque provider idempotency", () => {
  it("is stable and purpose-bound without exposing internal or user identifiers", () => {
    const recordId = "64f0000000000000000000a1";
    const otherRecordId = "64f0000000000000000000a2";
    const userId = "64f0000000000000000000b1";
    const sessionId = "64f0000000000000000000c1";
    const resetToken = "reset-token-must-not-be-metadata";
    const loginCode = "001204";
    const email = recipient;

    const key = opaqueProviderIdempotencyKey("password-reset", recordId);
    expect(key).toBe(opaqueProviderIdempotencyKey("password-reset", recordId));
    expect(key).toMatch(/^codelift-v1-[A-Za-z0-9_-]{43}$/);
    expect(key).toHaveLength(55);
    expect(key).not.toBe(opaqueProviderIdempotencyKey("email-login-code", recordId));
    expect(key).not.toBe(opaqueProviderIdempotencyKey("password-reset", otherRecordId));
    for (const forbidden of [
      recordId,
      otherRecordId,
      userId,
      sessionId,
      resetToken,
      loginCode,
      email
    ]) {
      expect(key).not.toContain(forbidden);
    }
  });
});

describe("Resend transactional email adapter", () => {
  it("constructs without network and sends one bounded password-reset request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    const provider = new ResendTransactionalEmailProvider({
      apiKey: `re_${"a".repeat(29)}`,
      from: "security@pilot.example.test",
      replyTo: "support@pilot.example.test",
      timeoutMs: 5_000,
      fetch: fetchMock
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const recordId = "64f0000000000000000000a1";
    const userId = "64f0000000000000000000b1";
    const sessionId = "64f0000000000000000000c1";
    const idempotencyKey = opaqueProviderIdempotencyKey("password-reset", recordId);
    await provider.sendPasswordReset({
      to: recipient,
      resetUrl,
      expiresAt: resetExpiry,
      idempotencyKey
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = new Headers(request?.headers);
    expect(request?.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer re_${"a".repeat(29)}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("user-agent")).toBe("codelift-api/0.1.1");
    expect(headers.get("idempotency-key")).toBe(idempotencyKey);
    expect(request?.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "CodeLift AI <security@pilot.example.test>",
      to: [recipient],
      reply_to: "support@pilot.example.test",
      subject: "Reset your CodeLift AI password"
    });
    const serializedRequest = JSON.stringify({ headers: Object.fromEntries(headers), body });
    expect(serializedRequest).not.toContain(recordId);
    expect(serializedRequest).not.toContain(userId);
    expect(serializedRequest).not.toContain(sessionId);
  });

  it("omits reply-to and sends the fixed login-code content", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const provider = new ResendTransactionalEmailProvider({
      apiKey: `re_${"b".repeat(29)}`,
      from: "security@pilot.example.test",
      replyTo: null,
      timeoutMs: 5_000,
      fetch: fetchMock
    });
    await provider.sendLoginCode({
      to: recipient,
      code: "001204",
      expiresAt: codeExpiry,
      idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f0000000000000000000d1")
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("reply_to");
    expect(body).toMatchObject({
      to: [recipient],
      subject: "Your CodeLift AI sign-in code"
    });
    expect(String(body.text).match(/001204/g)).toHaveLength(1);
    expect(String(body.html).match(/001204/g)).toHaveLength(1);
  });

  it.each([
    [400, "rejected"],
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [500, "unavailable"]
  ] as const)("maps HTTP %s to a sanitized %s failure without retry", async (status, reason) => {
    const bodyRead = vi.fn();
    const fetchMock = vi.fn(async () =>
      Object.assign(new Response("private provider response", { status }), { text: bodyRead })
    );
    const provider = new ResendTransactionalEmailProvider({
      apiKey: `re_${"c".repeat(29)}`,
      from: "security@pilot.example.test",
      replyTo: null,
      timeoutMs: 5_000,
      fetch: fetchMock
    });

    const delivery = provider.sendLoginCode({
      to: recipient,
      code: "001204",
      expiresAt: codeExpiry,
      idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f0000000000000000000e1")
    });
    await expect(delivery).rejects.toEqual(new TransactionalEmailError(reason));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyRead).not.toHaveBeenCalled();
    try {
      await delivery;
    } catch (error) {
      expect(String(error)).toBe("TransactionalEmailError: Transactional email delivery failed.");
      expect(JSON.stringify(error)).not.toContain("private provider response");
      expect(JSON.stringify(error)).not.toContain(recipient);
      expect(JSON.stringify(error)).not.toContain("001204");
      expect(JSON.stringify(error)).not.toContain("re_ccc");
    }
  });

  it("maps thrown network errors and provider timeouts without retry or payload leakage", async () => {
    const networkFetch = vi.fn(async () => {
      throw new Error(`socket failed for ${recipient} with 001204`);
    });
    const networkProvider = new ResendTransactionalEmailProvider({
      apiKey: `re_${"d".repeat(29)}`,
      from: "security@pilot.example.test",
      replyTo: null,
      timeoutMs: 5_000,
      fetch: networkFetch
    });
    await expect(
      networkProvider.sendLoginCode({
        to: recipient,
        code: "001204",
        expiresAt: codeExpiry,
        idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f0000000000000000000f1")
      })
    ).rejects.toEqual(new TransactionalEmailError("unavailable"));
    expect(networkFetch).toHaveBeenCalledTimes(1);

    const timeoutFetch = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true
          });
        })
    );
    const timeoutProvider = new ResendTransactionalEmailProvider({
      apiKey: `re_${"e".repeat(29)}`,
      from: "security@pilot.example.test",
      replyTo: null,
      timeoutMs: 10,
      fetch: timeoutFetch
    });
    await expect(
      timeoutProvider.sendLoginCode({
        to: recipient,
        code: "001204",
        expiresAt: codeExpiry,
        idempotencyKey: opaqueProviderIdempotencyKey("email-login-code", "64f000000000000000000101")
      })
    ).rejects.toEqual(new TransactionalEmailError("timeout"));
    expect(timeoutFetch).toHaveBeenCalledTimes(1);
  });
});
