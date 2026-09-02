import { describe, expect, it } from "vitest";

import { buildAccountAccessUrl } from "../account/access-operator.js";
import { loadApiConfig } from "../config.js";

describe("API M2 configuration", () => {
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
