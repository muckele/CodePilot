import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { buildAccountAccessUrl } from "../account/access-operator.js";
import { loadApiConfig } from "../config.js";

const productionEnvironment = {
  NODE_ENV: "production",
  WEB_ORIGIN: "https://pilot.example.test",
  TRUST_PROXY_HOPS: "1",
  PERSISTENCE_MODE: "required",
  MONGO_URI: "mongodb+srv://cluster.example.test/codelift"
} as const;

describe("API M2 configuration", () => {
  it("lets the seed CLI consume the same secret-file boundary without injecting a default URI", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/seed/cli.ts", "validate"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: { PATH: process.env.PATH, MONGO_URI_FILE: "/nonexistent/codelift-fixture-secret" },
      encoding: "utf8"
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "MONGO_URI_FILE must be an absolute, readable, nonempty secret file"
    );
    expect(result.stderr).not.toContain("Set only one");
  });
  it("loads an authenticated Mongo URI from a bounded secret file without changing the environment", () => {
    const directory = mkdtempSync(join(tmpdir(), "codelift-config-"));
    const path = join(directory, "mongo-uri");
    const uri =
      "mongodb://fixture:synthetic@mongodb:27017/codelift?replicaSet=rs0&authSource=codelift";
    try {
      writeFileSync(path, `${uri}\n`, { mode: 0o600 });
      const environment = { MONGO_URI_FILE: path };
      expect(loadApiConfig(environment).persistence.mongoUri).toBe(uri);
      expect(environment).toEqual({ MONGO_URI_FILE: path });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed for ambiguous, missing, empty, oversized, or invalid Mongo secret files", () => {
    const directory = mkdtempSync(join(tmpdir(), "codelift-config-"));
    const path = join(directory, "mongo-uri");
    try {
      expect(() => loadApiConfig({ MONGO_URI: "mongodb://fixture", MONGO_URI_FILE: path })).toThrow(
        "MONGO_URI"
      );
      expect(() => loadApiConfig({ MONGO_URI_FILE: path })).toThrow("MONGO_URI_FILE");
      expect(() => loadApiConfig({ MONGO_URI_FILE: "relative-secret" })).toThrow("MONGO_URI_FILE");
      expect(() => loadApiConfig({ MONGO_URI_FILE: directory })).toThrow("MONGO_URI_FILE");
      for (const content of [
        "",
        " ",
        "x".repeat(8193),
        "https://synthetic:private@example.invalid"
      ]) {
        writeFileSync(path, content, { mode: 0o600 });
        expect(() => loadApiConfig({ MONGO_URI_FILE: path })).toThrow(/MONGO_URI/);
        try {
          loadApiConfig({ MONGO_URI_FILE: path });
        } catch (error) {
          expect(String(error)).not.toContain("synthetic:private");
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([
    ["invite" as const, "invite", "i".repeat(43)],
    ["password_reset" as const, "token", "r".repeat(43)]
  ])("keeps %s bearer links out of the HTTP request target", (purpose, parameter, token) => {
    const url = new URL(buildAccountAccessUrl("https://pilot.example.test", purpose, token));

    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get(parameter)).toBe(token);
  });

  it("keeps local persistence optional and uses a non-Secure development cookie", () => {
    const config = loadApiConfig({ NODE_ENV: "development" });

    expect(config.persistence).toMatchObject({
      mode: "optional",
      mongoUri: null,
      databaseName: "codelift"
    });
    expect(config.session).toMatchObject({
      cookieName: "codelift_session",
      secureCookie: false
    });
    expect(config.trustProxyHops).toBe(0);
    expect(config.registration.mode).toBe("open");
    expect(config.email).toEqual({
      provider: "disabled",
      from: null,
      replyTo: null,
      requestTimeoutMs: 5_000,
      resendApiKey: null,
      loginCodePepper: null,
      fakeOutboxDir: null
    });
  });

  it("enables the network-free fake provider only with test-safe state", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const config = loadApiConfig({
        NODE_ENV: "test",
        REGISTRATION_MODE: "closed",
        EMAIL_PROVIDER: "fake"
      });

      expect(config.email).toMatchObject({
        provider: "fake",
        from: null,
        replyTo: null,
        requestTimeoutMs: 5_000,
        resendApiKey: null,
        fakeOutboxDir: null
      });
      expect(config.email.loginCodePepper).toBeInstanceOf(Buffer);
      expect(config.email.loginCodePepper).toHaveLength(32);
      expect(
        loadApiConfig({
          NODE_ENV: "test",
          REGISTRATION_MODE: "closed",
          EMAIL_PROVIDER: "fake",
          EMAIL_REQUEST_TIMEOUT_MS: "1000"
        }).email.requestTimeoutMs
      ).toBe(1_000);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("loads valid Resend files without making provider reachability a startup dependency", () => {
    const directory = mkdtempSync(join(tmpdir(), "codelift-email-config-"));
    const apiKeyPath = join(directory, "resend-key");
    const pepperPath = join(directory, "login-code-pepper");
    const apiKey = `re_${"a".repeat(29)}`;
    const pepper = Buffer.alloc(32, 7);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      writeFileSync(apiKeyPath, `${apiKey}\n`, { mode: 0o600 });
      writeFileSync(pepperPath, `${pepper.toString("base64url")}\n`, { mode: 0o600 });

      const config = loadApiConfig({
        ...productionEnvironment,
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "security@pilot.example.test",
        EMAIL_REPLY_TO: "support@pilot.example.test",
        RESEND_API_KEY_FILE: apiKeyPath,
        EMAIL_LOGIN_CODE_PEPPER_FILE: pepperPath,
        EMAIL_REQUEST_TIMEOUT_MS: "10000"
      });

      expect(config.email).toEqual({
        provider: "resend",
        from: "security@pilot.example.test",
        replyTo: "support@pilot.example.test",
        requestTimeoutMs: 10_000,
        resendApiKey: apiKey,
        loginCodePepper: pepper,
        fakeOutboxDir: null
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed for unsupported email providers and direct secrets", () => {
    expect(() => loadApiConfig({ EMAIL_PROVIDER: "smtp" })).toThrow("EMAIL_PROVIDER");
    expect(() =>
      loadApiConfig({
        ...productionEnvironment,
        EMAIL_PROVIDER: "fake"
      })
    ).toThrow("EMAIL_PROVIDER=fake");
    expect(() => loadApiConfig({ RESEND_API_KEY: "re_synthetic-not-a-secret" })).toThrow(
      "RESEND_API_KEY_FILE"
    );
    expect(() => loadApiConfig({ EMAIL_LOGIN_CODE_PEPPER: "synthetic" })).toThrow(
      "EMAIL_LOGIN_CODE_PEPPER_FILE"
    );
  });

  it("fails closed for incomplete or malformed Resend configuration without exposing values", () => {
    const directory = mkdtempSync(join(tmpdir(), "codelift-email-config-"));
    const apiKeyPath = join(directory, "resend-key");
    const pepperPath = join(directory, "login-code-pepper");
    const validKey = `re_${"a".repeat(29)}`;
    const validPepper = Buffer.alloc(32, 11).toString("base64url");
    try {
      writeFileSync(apiKeyPath, validKey, { mode: 0o600 });
      writeFileSync(pepperPath, validPepper, { mode: 0o600 });
      const base = {
        ...productionEnvironment,
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "security@pilot.example.test",
        RESEND_API_KEY_FILE: apiKeyPath,
        EMAIL_LOGIN_CODE_PEPPER_FILE: pepperPath
      };

      for (const [overrides, message] of [
        [{ EMAIL_FROM: undefined }, "EMAIL_FROM"],
        [{ EMAIL_FROM: "CodeLift AI <security@pilot.example.test>" }, "EMAIL_FROM"],
        [{ EMAIL_REPLY_TO: "not-an-email" }, "EMAIL_REPLY_TO"],
        [{ RESEND_API_KEY_FILE: undefined }, "RESEND_API_KEY_FILE"],
        [{ RESEND_API_KEY_FILE: "relative-key" }, "RESEND_API_KEY_FILE"],
        [{ EMAIL_LOGIN_CODE_PEPPER_FILE: undefined }, "EMAIL_LOGIN_CODE_PEPPER_FILE"],
        [{ EMAIL_LOGIN_CODE_PEPPER_FILE: "relative-pepper" }, "EMAIL_LOGIN_CODE_PEPPER_FILE"],
        [{ EMAIL_REQUEST_TIMEOUT_MS: "999" }, "EMAIL_REQUEST_TIMEOUT_MS"],
        [{ EMAIL_REQUEST_TIMEOUT_MS: "10001" }, "EMAIL_REQUEST_TIMEOUT_MS"],
        [{ EMAIL_REQUEST_TIMEOUT_MS: "1.5" }, "EMAIL_REQUEST_TIMEOUT_MS"]
      ] as const) {
        expect(() => loadApiConfig({ ...base, ...overrides })).toThrow(message);
      }

      for (const invalidKey of [
        "",
        "re_short",
        `xx_${"a".repeat(29)}`,
        `re_${"a".repeat(510)}`,
        `re_${"a".repeat(20)} whitespace`
      ]) {
        writeFileSync(apiKeyPath, invalidKey, { mode: 0o600 });
        expect(() => loadApiConfig(base)).toThrow("RESEND_API_KEY_FILE");
        try {
          loadApiConfig(base);
        } catch (error) {
          if (invalidKey !== "") {
            expect(String(error)).not.toContain(invalidKey);
          }
        }
      }

      writeFileSync(apiKeyPath, validKey, { mode: 0o600 });
      for (const invalidPepper of [
        "",
        Buffer.alloc(31, 1).toString("base64url"),
        Buffer.alloc(33, 1).toString("base64url"),
        `${validPepper}=`,
        `${validPepper}\n${validPepper}`
      ]) {
        writeFileSync(pepperPath, invalidPepper, { mode: 0o600 });
        expect(() => loadApiConfig(base)).toThrow("EMAIL_LOGIN_CODE_PEPPER_FILE");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("accepts only a test fake outbox under the operating-system temporary directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "codelift-email-outbox-"));
    try {
      expect(
        loadApiConfig({
          NODE_ENV: "test",
          REGISTRATION_MODE: "closed",
          EMAIL_PROVIDER: "fake",
          EMAIL_FAKE_OUTBOX_DIR: directory
        }).email.fakeOutboxDir
      ).toBe(directory);
      expect(() =>
        loadApiConfig({
          NODE_ENV: "development",
          EMAIL_PROVIDER: "fake",
          EMAIL_FAKE_OUTBOX_DIR: directory
        })
      ).toThrow("EMAIL_FAKE_OUTBOX_DIR");
      expect(() =>
        loadApiConfig({
          NODE_ENV: "test",
          REGISTRATION_MODE: "closed",
          EMAIL_PROVIDER: "disabled",
          EMAIL_FAKE_OUTBOX_DIR: directory
        })
      ).toThrow("EMAIL_FAKE_OUTBOX_DIR");
      expect(() =>
        loadApiConfig({
          NODE_ENV: "test",
          REGISTRATION_MODE: "closed",
          EMAIL_PROVIDER: "fake",
          EMAIL_FAKE_OUTBOX_DIR: "relative-outbox"
        })
      ).toThrow("EMAIL_FAKE_OUTBOX_DIR");
      expect(() =>
        loadApiConfig({
          NODE_ENV: "test",
          REGISTRATION_MODE: "closed",
          EMAIL_PROVIDER: "fake",
          EMAIL_FAKE_OUTBOX_DIR: "/var/lib/codelift/outbox"
        })
      ).toThrow("EMAIL_FAKE_OUTBOX_DIR");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("defaults production registration to invite-only and enforces the private-pilot boundary", () => {
    const config = loadApiConfig({
      NODE_ENV: "production",
      WEB_ORIGIN: "https://pilot.example.test",
      TRUST_PROXY_HOPS: "1",
      PERSISTENCE_MODE: "required",
      MONGO_URI: "mongodb+srv://cluster.example.test/codelift"
    });

    expect(config.persistence.mode).toBe("required");
    expect(config.registration.mode).toBe("invite_only");
    expect(config.session).toMatchObject({
      cookieName: "__Host-codelift_session",
      secureCookie: true
    });
  });

  it("accepts a bounded Mongo configuration without logging or rewriting credentials", () => {
    const config = loadApiConfig({
      NODE_ENV: "test",
      REGISTRATION_MODE: "closed",
      PERSISTENCE_MODE: "required",
      MONGO_URI: "mongodb://user:password@127.0.0.1:27018/codelift_test?replicaSet=rs0",
      MONGO_DB_NAME: "codelift_test"
    });

    expect(config.persistence).toMatchObject({
      mode: "required",
      mongoUri: "mongodb://user:password@127.0.0.1:27018/codelift_test?replicaSet=rs0",
      databaseName: "codelift_test"
    });
  });

  it("enables only an explicitly configured number of trusted reverse proxies", () => {
    expect(loadApiConfig({ TRUST_PROXY_HOPS: "1" }).trustProxyHops).toBe(1);
    expect(() => loadApiConfig({ TRUST_PROXY_HOPS: "-1" })).toThrow("TRUST_PROXY_HOPS");
    expect(() => loadApiConfig({ TRUST_PROXY_HOPS: "3" })).toThrow("TRUST_PROXY_HOPS");
  });

  it("requires production to declare its exact trusted reverse-proxy count", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        WEB_ORIGIN: "https://pilot.example.test",
        PERSISTENCE_MODE: "required",
        MONGO_URI: "mongodb+srv://cluster.example.test/codelift"
      })
    ).toThrow("TRUST_PROXY_HOPS is required in production");
  });

  it("requires tests to select their registration policy explicitly", () => {
    expect(() => loadApiConfig({ NODE_ENV: "test" })).toThrow("REGISTRATION_MODE");
    expect(loadApiConfig({ NODE_ENV: "test", REGISTRATION_MODE: "open" }).registration.mode).toBe(
      "open"
    );
  });

  it.each([
    [{}, "WEB_ORIGIN"],
    [{ WEB_ORIGIN: "http://pilot.example.test" }, "HTTPS"],
    [{ WEB_ORIGIN: "http://127.0.0.1:8080" }, "HTTPS"],
    [{ WEB_ORIGIN: "https://pilot.example.test", PERSISTENCE_MODE: "optional" }, "required"],
    [{ WEB_ORIGIN: "https://pilot.example.test", PERSISTENCE_MODE: "required" }, "MONGO_URI"]
  ])("fails production closed for an incomplete launch profile", (overrides, message) => {
    expect(() => loadApiConfig({ NODE_ENV: "production", ...overrides })).toThrow(message);
  });

  it("permits HTTP only for loopback development and test origins", () => {
    expect(
      loadApiConfig({ NODE_ENV: "development", WEB_ORIGIN: "http://localhost:5173" }).webOrigin
    ).toBe("http://localhost:5173");
    expect(
      loadApiConfig({
        NODE_ENV: "test",
        REGISTRATION_MODE: "closed",
        WEB_ORIGIN: "http://[::1]:5173"
      }).webOrigin
    ).toBe("http://[::1]:5173");
    expect(() =>
      loadApiConfig({ NODE_ENV: "development", WEB_ORIGIN: "http://example.test" })
    ).toThrow("loopback");
  });

  it("keeps open production registration unavailable until verified email recovery exists", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        WEB_ORIGIN: "https://pilot.example.test",
        TRUST_PROXY_HOPS: "1",
        PERSISTENCE_MODE: "required",
        MONGO_URI: "mongodb+srv://cluster.example.test/codelift",
        REGISTRATION_MODE: "open"
      })
    ).toThrow("verified email");
  });

  it.each([
    [{ AI_PROVIDER: "python_mock" }, "AI_PROVIDER=mock"],
    [{ AI_PROVIDER: "local" }, "AI_PROVIDER=mock"],
    [{ AI_EXTERNAL_ENABLED: "true" }, "AI_EXTERNAL_ENABLED=false"],
    [{ AI_AGENT_ENABLED: "true" }, "AI_AGENT_ENABLED=false"],
    [
      {
        AI_PROVIDER: "openai",
        AI_EXTERNAL_ENABLED: "true",
        OPENAI_MODEL: "approved-model",
        OPENAI_API_KEY: "test-only-key"
      },
      "AI_PROVIDER=mock"
    ]
  ])("rejects unsafe production AI configuration", (overrides, message) => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        WEB_ORIGIN: "https://pilot.example.test",
        TRUST_PROXY_HOPS: "1",
        PERSISTENCE_MODE: "required",
        MONGO_URI: "mongodb+srv://cluster.example.test/codelift",
        ...overrides
      })
    ).toThrow(message);
  });

  it.each([
    [{ AI_PROVIDER: "openai" }, "AI_EXTERNAL_ENABLED"],
    [{ AI_PROVIDER: "openai", AI_EXTERNAL_ENABLED: "true" }, "OPENAI_MODEL"],
    [
      { AI_PROVIDER: "openai", AI_EXTERNAL_ENABLED: "true", OPENAI_MODEL: "approved-model" },
      "OPENAI_API_KEY"
    ]
  ])("rejects an incomplete external AI configuration", (overrides, message) => {
    expect(() => loadApiConfig({ NODE_ENV: "development", ...overrides })).toThrow(message);
  });

  it("rejects plaintext transport for the credential-bearing external provider", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "development",
        AI_PROVIDER: "openai",
        AI_EXTERNAL_ENABLED: "true",
        OPENAI_MODEL: "approved-model",
        OPENAI_API_KEY: "test-only-key",
        OPENAI_BASE_URL: "http://provider.example.test/v1"
      })
    ).toThrow("OPENAI_BASE_URL must use HTTPS");

    expect(
      loadApiConfig({
        NODE_ENV: "development",
        AI_PROVIDER: "openai",
        AI_EXTERNAL_ENABLED: "true",
        OPENAI_MODEL: "approved-model",
        OPENAI_API_KEY: "test-only-key",
        OPENAI_BASE_URL: "https://provider.example.test/v1",
        AI_PYTHON_BASE_URL: "http://127.0.0.1:8000",
        AI_LOCAL_BASE_URL: "http://127.0.0.1:11434"
      }).ai
    ).toMatchObject({
      openAiBaseUrl: "https://provider.example.test/v1",
      pythonBaseUrl: "http://127.0.0.1:8000",
      localBaseUrl: "http://127.0.0.1:11434"
    });
  });

  it.each([
    [{ PERSISTENCE_MODE: "memory" }, "PERSISTENCE_MODE"],
    [{ MONGO_URI: "https://database.example" }, "MONGO_URI"],
    [{ MONGO_DB_NAME: "invalid database" }, "MONGO_DB_NAME"]
  ])("rejects invalid persistence settings without a fallback", (environment, message) => {
    expect(() => loadApiConfig(environment)).toThrow(message);
  });
});
