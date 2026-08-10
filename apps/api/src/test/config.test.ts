import { describe, expect, it } from "vitest";

import { loadApiConfig } from "../config.js";

describe("API M2 configuration", () => {
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
  });

  it("defaults production persistence to required and enforces __Host cookie semantics", () => {
    const config = loadApiConfig({ NODE_ENV: "production" });

    expect(config.persistence.mode).toBe("required");
    expect(config.session).toMatchObject({
      cookieName: "__Host-codelift_session",
      secureCookie: true
    });
  });

  it("accepts a bounded Mongo configuration without logging or rewriting credentials", () => {
    const config = loadApiConfig({
      NODE_ENV: "test",
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

  it.each([
    [{ PERSISTENCE_MODE: "memory" }, "PERSISTENCE_MODE"],
    [{ MONGO_URI: "https://database.example" }, "MONGO_URI"],
    [{ MONGO_DB_NAME: "invalid database" }, "MONGO_DB_NAME"]
  ])("rejects invalid persistence settings without a fallback", (environment, message) => {
    expect(() => loadApiConfig(environment)).toThrow(message);
  });
});
