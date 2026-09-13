import mongoose, { Types } from "mongoose";
import { afterEach, describe, expect, it } from "vitest";

import { createModels } from "../persistence/models.js";

const connections: mongoose.Connection[] = [];

afterEach(async () => {
  await Promise.all(connections.splice(0).map((connection) => connection.destroy()));
});

function modelsForTest() {
  const connection = mongoose.createConnection();
  connections.push(connection);
  return createModels(connection);
}

describe("self-service account access models", () => {
  it("defines a purpose-specific hidden login-code record with bounded state", async () => {
    const models = modelsForTest();
    const model = models.EmailLoginCode;

    expect(model.collection.collectionName).toBe("emaillogincodes");
    expect(model.schema.path("codeDigest").options).toMatchObject({
      required: true,
      select: false,
      match: /^[0-9a-f]{64}$/
    });
    expect(model.schema.path("purpose").options).toMatchObject({
      required: true,
      enum: ["email_login"]
    });
    expect(model.schema.path("failedAttempts").options).toMatchObject({
      required: true,
      default: 0,
      min: 0,
      max: 5
    });

    const record = new model({
      userId: new Types.ObjectId(),
      purpose: "email_login",
      codeDigest: "a".repeat(64),
      expiresAt: new Date("2026-09-13T05:10:00.000Z"),
      sentAt: null,
      consumedAt: null,
      revokedAt: null,
      failedAttempts: 0
    });
    await expect(record.validate()).resolves.toBeUndefined();
    expect(record.toObject()).not.toHaveProperty("email");
    expect(record.toObject()).not.toHaveProperty("code");
    expect(record.toObject()).not.toHaveProperty("providerMessageId");
  });

  it("declares the account lookup and seven-day post-expiry cleanup indexes", () => {
    const indexes = modelsForTest().EmailLoginCode.schema.indexes();

    expect(indexes).toContainEqual([{ userId: 1, purpose: 1, createdAt: -1 }, expect.any(Object)]);
    expect(indexes).toContainEqual([
      { expiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 7 * 24 * 60 * 60 })
    ]);
  });

  it("extends password resets without rewriting historical or operator records", async () => {
    const model = modelsForTest().PasswordReset;
    const base = {
      tokenHash: "b".repeat(64),
      purpose: "password_reset" as const,
      userId: new Types.ObjectId(),
      expiresAt: new Date("2026-09-13T06:00:00.000Z"),
      consumedAt: null,
      revokedAt: null,
      createdBy: "unit-test"
    };

    const historical = new model(base);
    await expect(historical.validate()).resolves.toBeUndefined();
    expect(historical.deliveryMethod).toBeUndefined();
    expect(historical.sentAt).toBeUndefined();

    const operator = new model({ ...base, tokenHash: "c".repeat(64), deliveryMethod: "operator" });
    await expect(operator.validate()).resolves.toBeUndefined();
    expect(operator.sentAt).toBeUndefined();

    const pendingEmail = new model({
      ...base,
      tokenHash: "d".repeat(64),
      deliveryMethod: "email",
      sentAt: null
    });
    await expect(pendingEmail.validate()).resolves.toBeUndefined();
    expect(pendingEmail.sentAt).toBeNull();
  });

  it("allows only fixed zero-label account-access metric events", () => {
    const values = modelsForTest().PilotAggregate.schema.path("event").options.enum;

    expect(values).toEqual([
      "account_export_succeeded",
      "account_deletion_succeeded",
      "password_reset_requested",
      "password_reset_email_sent",
      "password_reset_email_failed",
      "email_login_code_requested",
      "email_login_code_email_sent",
      "email_login_code_email_failed",
      "email_login_code_succeeded",
      "email_login_code_failed"
    ]);
  });
});
