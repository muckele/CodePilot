import { describe, expect, it } from "vitest";

import { buildAccountOperatorEnvironment } from "../account/operator-environment.js";

describe("account operator environment", () => {
  it("preserves a secret-file Mongo configuration without synthesizing a conflicting URI", () => {
    const environment = buildAccountOperatorEnvironment({
      NODE_ENV: "production",
      MONGO_URI_FILE: "/run/secrets/mongo-uri"
    });

    expect(environment).toMatchObject({
      NODE_ENV: "production",
      MONGO_URI_FILE: "/run/secrets/mongo-uri",
      REGISTRATION_MODE: "closed",
      PERSISTENCE_MODE: "required"
    });
    expect(environment.MONGO_URI).toBeUndefined();
  });

  it("uses the loopback development fallback only when neither Mongo input exists", () => {
    expect(buildAccountOperatorEnvironment({}).MONGO_URI).toBe(
      "mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true"
    );
    expect(
      buildAccountOperatorEnvironment({ MONGO_URI: "mongodb://mongodb:27017/codelift" }).MONGO_URI
    ).toBe("mongodb://mongodb:27017/codelift");
  });
});
