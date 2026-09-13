import type {
  AuthSessionResponse,
  CsrfResponse,
  OnboardingProfile,
  ProgressDayResponse
} from "@codelift/contracts";
import { fileURLToPath } from "node:url";
import { Types } from "mongoose";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { bootstrapApi, type BootstrappedApi } from "../bootstrap.js";
import {
  issueInvitation,
  issuePasswordReset,
  revokeUnusedInvitation
} from "../account/access-operator.js";
import { AccountService } from "../account/service.js";
import { digestOpaqueToken } from "../account/security.js";
import {
  FakeTransactionalEmailProvider,
  type TransactionalEmailProvider
} from "../account/transactional-email.js";
import type { ApiConfig } from "../config.js";
import type { StructuredRequestLogger } from "../middleware/request-context.js";
import { buildPilotMetrics } from "../metrics/pilot-metrics.js";
import type { ProgressRecord } from "../persistence/models.js";

const canonicalCurriculumPath = fileURLToPath(
  new URL("../../../../codelift_ai_curriculum_seed_v2_2026.json", import.meta.url)
);
const webOrigin = "http://localhost:5173";

const silentLogger: StructuredRequestLogger = {
  info() {
    // Privacy behavior is covered by the request-logging integration tests.
  }
};

function guardedTestUri(): string {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Mongo integration cleanup requires NODE_ENV=test.");
  }
  const uri = process.env.MONGO_TEST_URI;
  if (uri === undefined || uri.trim() === "") {
    throw new Error("Mongo integration tests require an explicit MONGO_TEST_URI.");
  }
  const parsed = new URL(uri);
  const databaseName = parsed.pathname.slice(1);
  if (!databaseName.endsWith("_test") || databaseName === "codelift") {
    throw new Error("Mongo integration database names must end in _test.");
  }
  return uri;
}

function configFor(
  uri: string,
  registrationMode: ApiConfig["registration"]["mode"] = "open"
): ApiConfig {
  return {
    nodeEnv: "test",
    port: 4000,
    trustProxyHops: 0,
    webOrigin,
    curriculumPath: canonicalCurriculumPath,
    jsonBodyLimit: "32kb",
    persistence: {
      mode: "required",
      mongoUri: uri,
      databaseName: new URL(uri).pathname.slice(1),
      serverSelectionTimeoutMs: 3_000
    },
    session: {
      cookieName: "codelift_session",
      secureCookie: false,
      idleTtlMs: 7 * 24 * 60 * 60 * 1_000,
      absoluteTtlMs: 30 * 24 * 60 * 60 * 1_000
    },
    registration: {
      mode: registrationMode,
      invitationTtlMs: 7 * 24 * 60 * 60 * 1_000,
      passwordResetTtlMs: 60 * 60 * 1_000
    },
    email: {
      provider: "disabled",
      from: null,
      replyTo: null,
      requestTimeoutMs: 5_000,
      resendApiKey: null,
      loginCodePepper: null,
      fakeOutboxDir: null
    },
    ai: {
      provider: "mock",
      pythonBaseUrl: "http://127.0.0.1:8000",
      localBaseUrl: "http://127.0.0.1:11434",
      openAiBaseUrl: "https://api.openai.com/v1",
      openAiApiKey: null,
      openAiModel: null,
      timeoutMs: 1_000,
      maxRetries: 0,
      externalEnabled: false,
      agentEnabled: true
    }
  };
}

async function csrf(agent: Agent): Promise<CsrfResponse> {
  const response = await agent.get("/api/v1/auth/csrf");
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
  return response.body as CsrfResponse;
}

async function register(
  agent: Agent,
  email: string,
  password = "Correct horse battery staple!"
): Promise<AuthSessionResponse> {
  const protection = await csrf(agent);
  const response = await agent
    .post("/api/v1/auth/register")
    .set("Origin", webOrigin)
    .set("X-CSRF-Token", protection.csrfToken)
    .send({ email, password });
  expect(response.status).toBe(201);
  return response.body as AuthSessionResponse;
}

function onboardingProfile(
  displayName: string,
  overrides: Partial<OnboardingProfile> = {}
): OnboardingProfile {
  return {
    displayName,
    timezone: "America/Los_Angeles",
    startDate: "2026-07-24",
    commitmentMinutes: 30,
    preferredCodingTime: "20:30",
    routineCue: "the children are asleep",
    codingPlace: "my desk",
    implementationIntention:
      "Today at 20:30, after the children are asleep, I will code at my desk for 30 minutes.",
    whyItMatters: "I want to build useful, reliable AI products.",
    githubUsername: "",
    targetRoles: ["Full-Stack AI Application Engineer"],
    aiPrivacyMode: "local_only",
    themePreference: "system",
    motionPreference: "gentle",
    reviewPreference: "before_mission",
    ...overrides
  };
}

async function onboard(agent: Agent, csrfToken: string, displayName: string) {
  const response = await agent
    .put("/api/v1/me/onboarding")
    .set("Origin", webOrigin)
    .set("X-CSRF-Token", csrfToken)
    .send(onboardingProfile(displayName));
  expect(response.status).toBe(200);
  expect(response.body.user).toMatchObject({
    onboardingComplete: true,
    profile: {
      displayName,
      reviewPreference: "before_mission"
    }
  });
}

describe.sequential("M2 real-Mongo account and progress boundary", () => {
  let runtime: BootstrappedApi;

  beforeAll(async () => {
    runtime = await bootstrapApi({
      config: configFor(guardedTestUri()),
      logger: silentLogger
    });
    expect(runtime.persistence.status).toBe("ready");
    expect(runtime.account.status).toBe("ready");
  }, 20_000);

  beforeEach(async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    await Promise.all([
      runtime.persistence.models.Progress.deleteMany({}),
      runtime.persistence.models.Reflection.deleteMany({}),
      runtime.persistence.models.Session.deleteMany({}),
      runtime.persistence.models.Invitation.deleteMany({}),
      runtime.persistence.models.PasswordReset.deleteMany({}),
      runtime.persistence.models.EmailLoginCode.deleteMany({}),
      runtime.persistence.models.User.deleteMany({}),
      runtime.persistence.models.XpEvent.deleteMany({}),
      runtime.persistence.models.UserAchievement.deleteMany({}),
      runtime.persistence.models.SkillEvidence.deleteMany({}),
      runtime.persistence.models.ReviewItem.deleteMany({}),
      runtime.persistence.models.Misconception.deleteMany({}),
      runtime.persistence.models.ErrorMuseumEntry.deleteMany({}),
      runtime.persistence.models.PortfolioArtifact.deleteMany({}),
      runtime.persistence.models.AiTrace.deleteMany({}),
      runtime.persistence.models.EvalRun.deleteMany({}),
      runtime.persistence.models.IndexedSource.deleteMany({}),
      runtime.persistence.models.AgentRun.deleteMany({}),
      runtime.persistence.models.JobApplication.deleteMany({}),
      runtime.persistence.models.UserActivity.deleteMany({}),
      runtime.persistence.models.PilotAggregate.deleteMany({})
    ]);
    await runtime.persistence.models.FeatureFlag.updateOne(
      { key: "ai-kill-switch" },
      { $set: { enabled: false, updatedBy: "integration-test-reset" } }
    );
  });

  afterAll(async () => {
    if (runtime.persistence.status === "ready") {
      await runtime.persistence.connection.dropDatabase();
    }
    await runtime.close();
  });

  function createEmailTestApp(
    provider: TransactionalEmailProvider,
    timing: { nowMs(): number; sleep(milliseconds: number): Promise<void> }
  ) {
    if (runtime.persistence.status !== "ready" || runtime.account.status !== "ready") {
      throw new Error("The real Mongo account runtime is required.");
    }
    const config = {
      ...configFor(guardedTestUri()),
      email: {
        provider: "fake" as const,
        from: null,
        replyTo: null,
        requestTimeoutMs: 5_000,
        resendApiKey: null,
        loginCodePepper: Buffer.alloc(32, 0xa5),
        fakeOutboxDir: null
      }
    };
    const options = {
      config,
      curriculum: runtime.curriculum,
      account: { ...runtime.account, emailProvider: provider },
      logger: silentLogger,
      emailRequestTiming: timing
    };
    return createApp(options);
  }

  it("requests one delivery-gated reset email while keeping missing accounts generic", async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const models = runtime.persistence.models;
    const provider = new FakeTransactionalEmailProvider();
    const sleeps: number[] = [];
    const emailApp = createEmailTestApp(provider, {
      nowMs: () => 0,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      }
    });
    const email = "reset-request@example.com";
    await register(request.agent(emailApp), email);
    const priorOperatorReset = await issuePasswordReset({
      models,
      email,
      issuer: "integration-test-operator",
      ttlMs: 60 * 60 * 1_000
    });

    const browser = request.agent(emailApp);
    const protection = await csrf(browser);
    const response = await browser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", protection.csrfToken)
      .send({ email });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      message: "If an account exists for that email, we sent a password-reset link."
    });
    expect(provider.messages).toHaveLength(1);
    const message = provider.messages[0];
    expect(message?.purpose).toBe("password-reset");
    if (message?.purpose !== "password-reset") {
      throw new Error("Expected one password-reset message.");
    }
    const resetUrl = new URL(message.resetUrl);
    expect(resetUrl.origin).toBe(webOrigin);
    expect(resetUrl.pathname).toBe("/reset-password");
    expect(resetUrl.search).toBe("");
    expect(new URLSearchParams(resetUrl.hash.slice(1)).get("token")).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const reset = await models.PasswordReset.findOne({ deliveryMethod: "email" }).lean();
    expect(reset).toMatchObject({
      sentAt: expect.any(Date),
      consumedAt: null,
      revokedAt: null,
      createdBy: "self-service-email"
    });
    if (reset === null) throw new Error("Expected one email password reset.");
    expect(reset.expiresAt.getTime() - reset.createdAt.getTime()).toBe(60 * 60 * 1_000);
    expect(await models.PasswordReset.findById(priorOperatorReset.id).lean()).toMatchObject({
      revokedAt: expect.any(Date)
    });
    expect(sleeps).toEqual([750]);

    const missingBrowser = request.agent(emailApp);
    const missingProtection = await csrf(missingBrowser);
    const missing = await missingBrowser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", missingProtection.csrfToken)
      .send({ email: "missing-reset@example.com" });
    expect(missing.status).toBe(202);
    expect(missing.headers["content-type"]).toBe(response.headers["content-type"]);
    expect(missing.body).toEqual(response.body);
    expect(provider.messages).toHaveLength(1);
    expect(sleeps).toEqual([750, 750]);
    expect(
      await models.PilotAggregate.findOne({ event: "password_reset_requested" }).lean()
    ).toMatchObject({ count: 2 });
    expect(
      await models.PilotAggregate.findOne({ event: "password_reset_email_sent" }).lean()
    ).toMatchObject({ count: 1 });
  });

  it.each(["zero-match", "persistence-error"] as const)(
    "fails reset delivery closed after provider acceptance and %s acknowledgement",
    async (failure) => {
      if (runtime.persistence.status !== "ready") {
        throw new Error("The real Mongo runtime is required.");
      }
      const models = runtime.persistence.models;
      const provider = new FakeTransactionalEmailProvider();
      const emailApp = createEmailTestApp(provider, {
        nowMs: () => 0,
        sleep: async () => undefined
      });
      const email = `${failure}-reset@example.com`;
      await register(request.agent(emailApp), email);

      if (runtime.account.status !== "ready") {
        throw new Error("The real Mongo account runtime is required.");
      }
      const service = runtime.account.service;
      const originalAcknowledge = service.acknowledgePasswordResetDelivery.bind(service);
      const acknowledgementSpy = vi.spyOn(service, "acknowledgePasswordResetDelivery");
      if (failure === "zero-match") {
        acknowledgementSpy.mockResolvedValueOnce(false);
      } else {
        acknowledgementSpy.mockImplementationOnce(async (resetId) => {
          expect(await originalAcknowledge(resetId)).toBe(true);
          throw new Error("synthetic post-commit acknowledgement failure");
        });
      }

      const browser = request.agent(emailApp);
      const protection = await csrf(browser);
      const response = await browser
        .post("/api/v1/auth/password-reset/request")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", protection.csrfToken)
        .send({ email });
      acknowledgementSpy.mockRestore();

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        message: "If an account exists for that email, we sent a password-reset link."
      });
      expect(provider.messages).toHaveLength(1);
      const firstMessage = provider.messages[0];
      if (firstMessage?.purpose !== "password-reset") {
        throw new Error("Expected one password-reset message.");
      }
      const firstReset = await models.PasswordReset.findOne({ deliveryMethod: "email" }).lean();
      expect(firstReset).toMatchObject({
        sentAt: failure === "zero-match" ? null : expect.any(Date),
        revokedAt: expect.any(Date)
      });
      expect(
        await models.PilotAggregate.findOne({ event: "password_reset_email_sent" }).lean()
      ).toBeNull();
      expect(
        await models.PilotAggregate.findOne({ event: "password_reset_email_failed" }).lean()
      ).toMatchObject({ count: 1 });

      const rejectedBrowser = request.agent(emailApp);
      const rejectedProtection = await csrf(rejectedBrowser);
      const firstToken = new URLSearchParams(new URL(firstMessage.resetUrl).hash.slice(1)).get(
        "token"
      );
      const rejected = await rejectedBrowser
        .post("/api/v1/auth/reset-password")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", rejectedProtection.csrfToken)
        .send({ token: firstToken, password: "Replacement horse battery staple!" });
      expect(rejected.status).toBe(400);
      expect(provider.messages).toHaveLength(1);

      const retryBrowser = request.agent(emailApp);
      const retryProtection = await csrf(retryBrowser);
      const retry = await retryBrowser
        .post("/api/v1/auth/password-reset/request")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", retryProtection.csrfToken)
        .send({ email });
      expect(retry.status).toBe(202);
      expect(provider.messages).toHaveLength(2);
      expect(
        await models.PasswordReset.countDocuments({
          deliveryMethod: "email",
          sentAt: { $ne: null },
          revokedAt: null
        })
      ).toBe(1);
    }
  );

  it("contains a runtime provider outage to the generic reset-email operation", async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const models = runtime.persistence.models;
    const provider = new FakeTransactionalEmailProvider({ failWith: "unavailable" });
    const emailApp = createEmailTestApp(provider, {
      nowMs: () => 0,
      sleep: async () => undefined
    });
    const email = "provider-outage-reset@example.com";
    await register(request.agent(emailApp), email);
    const browser = request.agent(emailApp);
    const protection = await csrf(browser);

    const response = await browser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", protection.csrfToken)
      .send({ email });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      message: "If an account exists for that email, we sent a password-reset link."
    });
    expect(provider.messages).toHaveLength(1);
    expect(await models.PasswordReset.findOne({ deliveryMethod: "email" }).lean()).toMatchObject({
      sentAt: null,
      revokedAt: expect.any(Date)
    });
    expect(
      await models.PilotAggregate.findOne({ event: "password_reset_email_failed" }).lean()
    ).toMatchObject({ count: 1 });
  });

  it("ends issuance transactions before provider and asynchronous timing work", async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const models = runtime.persistence.models;
    const email = "reset-transaction-boundary@example.com";
    await register(
      request.agent(
        createEmailTestApp(new FakeTransactionalEmailProvider(), {
          nowMs: () => 0,
          sleep: async () => undefined
        })
      ),
      email
    );

    let issuanceSessionEnded = false;
    const originalStartSession = models.User.db.startSession.bind(models.User.db);
    const startSessionSpy = vi
      .spyOn(models.User.db, "startSession")
      .mockImplementation(async () => {
        const session = await originalStartSession();
        const originalEndSession = session.endSession.bind(session);
        session.endSession = async () => {
          await originalEndSession();
          issuanceSessionEnded = true;
        };
        return session;
      });
    const events: string[] = [];
    let releaseFloor: () => void = () => undefined;
    const floorGate = new Promise<void>((resolve) => {
      releaseFloor = resolve;
    });
    let floorStarted: () => void = () => undefined;
    const floorStart = new Promise<void>((resolve) => {
      floorStarted = resolve;
    });
    const provider: TransactionalEmailProvider = {
      async sendPasswordReset() {
        expect(issuanceSessionEnded).toBe(true);
        events.push("provider");
      },
      async sendLoginCode() {
        throw new Error("Unexpected login-code send.");
      }
    };
    const emailApp = createEmailTestApp(provider, {
      nowMs: () => 0,
      sleep: async (milliseconds) => {
        expect(milliseconds).toBe(750);
        expect(issuanceSessionEnded).toBe(true);
        expect(
          await models.PasswordReset.findOne({ deliveryMethod: "email", sentAt: { $ne: null } })
        ).not.toBeNull();
        events.push("floor");
        floorStarted();
        await floorGate;
      }
    });
    const browser = request.agent(emailApp);
    const protection = await csrf(browser);
    const responsePromise = browser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", protection.csrfToken)
      .send({ email })
      .then((response) => response);

    await floorStart;
    let unrelatedTimerRan = false;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        unrelatedTimerRan = true;
        resolve();
      }, 0);
    });
    expect(unrelatedTimerRan).toBe(true);
    expect(events).toEqual(["provider", "floor"]);
    releaseFloor();
    expect((await responsePromise).status).toBe(202);
    startSessionSpy.mockRestore();
  });

  it("enforces reset-request cooldown, IP limits, and disabled capability", async () => {
    const provider = new FakeTransactionalEmailProvider();
    const emailApp = createEmailTestApp(provider, {
      nowMs: () => 0,
      sleep: async () => undefined
    });
    const email = "reset-bounds@example.com";
    await register(request.agent(emailApp), email);

    const browser = request.agent(emailApp);
    const protection = await csrf(browser);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await browser
        .post("/api/v1/auth/password-reset/request")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", protection.csrfToken)
        .send({ email });
      expect(response.status).toBe(202);
    }
    expect(provider.messages).toHaveLength(1);
    const limited = await browser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", protection.csrfToken)
      .send({ email });
    expect(limited.status).toBe(429);

    if (runtime.account.status !== "ready") {
      throw new Error("The real Mongo account runtime is required.");
    }
    const disabledIssueSpy = vi.spyOn(runtime.account.service, "issueSelfServicePasswordReset");
    const disabledBrowser = request.agent(runtime.app);
    const disabledProtection = await csrf(disabledBrowser);
    const disabled = await disabledBrowser
      .post("/api/v1/auth/password-reset/request")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", disabledProtection.csrfToken)
      .send({ email: "missing-disabled@example.com" });
    expect(disabled.status).toBe(503);
    expect(disabled.body).toMatchObject({
      type: "https://codelift.ai/problems/email-self-service-unavailable",
      status: 503
    });
    expect(disabledIssueSpy).not.toHaveBeenCalled();
    disabledIssueSpy.mockRestore();
  });

  it("initializes email-code indexes idempotently without rewriting v0.1 reset records", async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const models = runtime.persistence.models;
    const userId = new Types.ObjectId();
    const legacyResetId = new Types.ObjectId();
    await models.PasswordReset.collection.insertOne({
      _id: legacyResetId,
      tokenHash: "a".repeat(64),
      purpose: "password_reset",
      userId,
      expiresAt: new Date("2026-09-13T06:00:00.000Z"),
      consumedAt: null,
      revokedAt: null,
      createdBy: "v0.1-fixture",
      createdAt: new Date("2026-09-13T05:00:00.000Z")
    });
    const loginCode = await models.EmailLoginCode.create({
      userId,
      purpose: "email_login",
      codeDigest: "b".repeat(64),
      expiresAt: new Date("2026-09-13T05:10:00.000Z"),
      sentAt: null,
      consumedAt: null,
      revokedAt: null,
      failedAttempts: 0
    });

    await models.EmailLoginCode.init();
    await models.EmailLoginCode.createIndexes();
    const indexes = await models.EmailLoginCode.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { userId: 1, purpose: 1, createdAt: -1 } }),
        expect.objectContaining({
          key: { expiresAt: 1 },
          expireAfterSeconds: 7 * 24 * 60 * 60
        })
      ])
    );
    expect(await models.EmailLoginCode.findById(loginCode._id).lean()).not.toHaveProperty(
      "codeDigest"
    );
    expect(
      (await models.EmailLoginCode.findById(loginCode._id).select("+codeDigest").lean())?.codeDigest
    ).toBe("b".repeat(64));

    const legacyReset = await models.PasswordReset.collection.findOne({ _id: legacyResetId });
    expect(legacyReset).not.toHaveProperty("deliveryMethod");
    expect(legacyReset).not.toHaveProperty("sentAt");
  });

  it("accepts v0.1 and operator resets while rejecting an unacknowledged email reset", async () => {
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const models = runtime.persistence.models;
    const emailApp = createEmailTestApp(new FakeTransactionalEmailProvider(), {
      nowMs: () => 0,
      sleep: async () => undefined
    });
    const email = "reset-compatibility@example.com";
    const password = "Correct horse battery staple!";
    const nextPassword = "Replacement horse battery staple!";
    const registered = await register(request.agent(emailApp), email, password);
    const historicalToken = "h".repeat(43);
    await models.PasswordReset.create({
      tokenHash: digestOpaqueToken(historicalToken),
      purpose: "password_reset",
      userId: registered.user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      consumedAt: null,
      revokedAt: null,
      createdBy: "v0.1-fixture"
    });

    const historicalBrowser = request.agent(emailApp);
    const historicalProtection = await csrf(historicalBrowser);
    const historical = await historicalBrowser
      .post("/api/v1/auth/reset-password")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", historicalProtection.csrfToken)
      .send({ token: historicalToken, password: nextPassword });
    expect(historical.status).toBe(204);

    const operator = await issuePasswordReset({
      models,
      email,
      issuer: "integration-test-operator",
      ttlMs: 60 * 60 * 1_000
    });
    expect((await models.PasswordReset.findById(operator.id).lean())?.deliveryMethod).toBe(
      "operator"
    );

    const pendingToken = "p".repeat(43);
    await models.PasswordReset.create({
      tokenHash: digestOpaqueToken(pendingToken),
      purpose: "password_reset",
      userId: registered.user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      consumedAt: null,
      revokedAt: null,
      createdBy: "self-service-email",
      deliveryMethod: "email",
      sentAt: null
    });
    const pendingBrowser = request.agent(emailApp);
    const pendingProtection = await csrf(pendingBrowser);
    const pending = await pendingBrowser
      .post("/api/v1/auth/reset-password")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", pendingProtection.csrfToken)
      .send({ token: pendingToken, password });
    expect(pending.status).toBe(400);
  });

  it("atomically gates invitations and resets passwords without token storage, replay, or surviving sessions", async () => {
    const accessUri = new URL(guardedTestUri());
    accessUri.pathname = "/codelift_m16_access_test";
    const accessRuntime = await bootstrapApi({
      config: configFor(accessUri.toString(), "invite_only"),
      logger: silentLogger
    });
    if (accessRuntime.persistence.status !== "ready") {
      throw new Error("The access test requires MongoDB.");
    }
    const models = accessRuntime.persistence.models;
    const email = "invited-pilot@example.com";
    const password = "Correct horse battery staple!";
    const newPassword = "A newer correct horse battery staple!";

    try {
      const missingInviteBrowser = request.agent(accessRuntime.app);
      const missingProtection = await csrf(missingInviteBrowser);
      const missingInvite = await missingInviteBrowser
        .post("/api/v1/auth/register")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", missingProtection.csrfToken)
        .send({ email, password });
      expect(missingInvite.status).toBe(400);

      const invitation = await issueInvitation({
        models,
        email,
        issuer: "integration-test",
        ttlMs: 60 * 60 * 1_000
      });
      const storedInvitation = await models.Invitation.findById(invitation.id).select("+tokenHash");
      expect(storedInvitation?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(storedInvitation?.tokenHash).not.toContain(invitation.token);

      const wrongEmailBrowser = request.agent(accessRuntime.app);
      const wrongProtection = await csrf(wrongEmailBrowser);
      const wrongEmail = await wrongEmailBrowser
        .post("/api/v1/auth/register")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", wrongProtection.csrfToken)
        .send({
          email: "wrong-invited-pilot@example.com",
          password,
          invitationToken: invitation.token
        });
      expect(wrongEmail.status).toBe(400);
      expect({ ...wrongEmail.body, requestId: "normalized" }).toEqual({
        ...missingInvite.body,
        requestId: "normalized"
      });
      expect(await models.Invitation.countDocuments({ _id: invitation.id, consumedAt: null })).toBe(
        1
      );

      const expiredInvitation = await issueInvitation({
        models,
        email: "expired-pilot@example.com",
        issuer: "integration-test",
        ttlMs: 1,
        now: new Date(Date.now() - 60_000)
      });
      const expiredInvitationBrowser = request.agent(accessRuntime.app);
      const expiredInvitationProtection = await csrf(expiredInvitationBrowser);
      const expiredInvitationResponse = await expiredInvitationBrowser
        .post("/api/v1/auth/register")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", expiredInvitationProtection.csrfToken)
        .send({
          email: "expired-pilot@example.com",
          password,
          invitationToken: expiredInvitation.token
        });
      expect(expiredInvitationResponse.status).toBe(400);
      expect({ ...expiredInvitationResponse.body, requestId: "normalized" }).toEqual({
        ...missingInvite.body,
        requestId: "normalized"
      });

      const invitedBrowser = request.agent(accessRuntime.app);
      const invitedProtection = await csrf(invitedBrowser);
      const registered = await invitedBrowser
        .post("/api/v1/auth/register")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", invitedProtection.csrfToken)
        .send({ email, password, invitationToken: invitation.token });
      expect(registered.status).toBe(201);
      expect(
        await models.Invitation.countDocuments({ _id: invitation.id, consumedAt: { $ne: null } })
      ).toBe(1);

      const replayBrowser = request.agent(accessRuntime.app);
      const replayProtection = await csrf(replayBrowser);
      const replay = await replayBrowser
        .post("/api/v1/auth/register")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", replayProtection.csrfToken)
        .send({ email, password, invitationToken: invitation.token });
      expect(replay.status).toBe(400);
      expect({ ...replay.body, requestId: "normalized" }).toEqual({
        ...missingInvite.body,
        requestId: "normalized"
      });

      const revoked = await issueInvitation({
        models,
        email: "revoked-pilot@example.com",
        issuer: "integration-test",
        ttlMs: 60 * 60 * 1_000
      });
      expect(await revokeUnusedInvitation({ models, invitationId: revoked.id })).toBe(true);
      const revokedBrowser = request.agent(accessRuntime.app);
      const revokedProtection = await csrf(revokedBrowser);
      expect(
        (
          await revokedBrowser
            .post("/api/v1/auth/register")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", revokedProtection.csrfToken)
            .send({
              email: "revoked-pilot@example.com",
              password,
              invitationToken: revoked.token
            })
        ).status
      ).toBe(400);

      const concurrentEmail = "concurrent-pilot@example.com";
      const concurrentInvitation = await issueInvitation({
        models,
        email: concurrentEmail,
        issuer: "integration-test",
        ttlMs: 60 * 60 * 1_000
      });
      const concurrentBrowsers = [
        request.agent(accessRuntime.app),
        request.agent(accessRuntime.app)
      ];
      const concurrentProtection = await Promise.all(concurrentBrowsers.map(csrf));
      const concurrentResults = await Promise.all(
        concurrentBrowsers.map((browser, index) =>
          browser
            .post("/api/v1/auth/register")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", concurrentProtection[index]?.csrfToken ?? "")
            .send({ email: concurrentEmail, password, invitationToken: concurrentInvitation.token })
        )
      );
      expect(concurrentResults.filter((response) => response.status === 201)).toHaveLength(1);
      expect(concurrentResults.filter((response) => response.status === 400)).toHaveLength(1);
      expect(concurrentResults.every((response) => response.status < 500)).toBe(true);
      expect(await models.User.countDocuments({ email: concurrentEmail })).toBe(1);

      const secondSession = request.agent(accessRuntime.app);
      const loginProtection = await csrf(secondSession);
      expect(
        (
          await secondSession
            .post("/api/v1/auth/login")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", loginProtection.csrfToken)
            .send({ email, password })
        ).status
      ).toBe(200);

      const siblingReset = await issuePasswordReset({
        models,
        email,
        issuer: "integration-test-older-link",
        ttlMs: 60 * 60 * 1_000
      });
      const reset = await issuePasswordReset({
        models,
        email,
        issuer: "integration-test",
        ttlMs: 60 * 60 * 1_000
      });
      expect((await models.PasswordReset.findById(siblingReset.id).lean())?.revokedAt).toEqual(
        expect.any(Date)
      );
      const storedReset = await models.PasswordReset.findById(reset.id).select("+tokenHash");
      expect(storedReset?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(storedReset?.tokenHash).not.toContain(reset.token);
      expect(storedReset?.deliveryMethod).toBe("operator");
      expect(storedReset?.sentAt).toBeUndefined();

      const resetBrowser = request.agent(accessRuntime.app);
      const resetProtection = await csrf(resetBrowser);
      const resetResponse = await resetBrowser
        .post("/api/v1/auth/reset-password")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", resetProtection.csrfToken)
        .send({ token: reset.token, password: newPassword });
      expect(resetResponse.status).toBe(204);
      expect((await resetBrowser.get("/api/v1/me")).body).toEqual({ authenticated: false });
      expect((await invitedBrowser.get("/api/v1/me")).body).toEqual({ authenticated: false });
      expect((await secondSession.get("/api/v1/me")).body).toEqual({ authenticated: false });

      const siblingResetProtection = await csrf(resetBrowser);
      expect(
        (
          await resetBrowser
            .post("/api/v1/auth/reset-password")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", siblingResetProtection.csrfToken)
            .send({ token: siblingReset.token, password: newPassword })
        ).status
      ).toBe(400);

      const replayResetProtection = await csrf(resetBrowser);
      expect(
        (
          await resetBrowser
            .post("/api/v1/auth/reset-password")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", replayResetProtection.csrfToken)
            .send({ token: reset.token, password: newPassword })
        ).status
      ).toBe(400);

      const expiredReset = await issuePasswordReset({
        models,
        email,
        issuer: "integration-test",
        ttlMs: 1,
        now: new Date(Date.now() - 60_000)
      });
      const expiredProtection = await csrf(resetBrowser);
      expect(
        (
          await resetBrowser
            .post("/api/v1/auth/reset-password")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", expiredProtection.csrfToken)
            .send({ token: expiredReset.token, password: newPassword })
        ).status
      ).toBe(400);

      const freshSession = request.agent(accessRuntime.app);
      const freshProtection = await csrf(freshSession);
      const freshLogin = await freshSession
        .post("/api/v1/auth/login")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", freshProtection.csrfToken)
        .send({ email, password: newPassword });
      expect(freshLogin.status).toBe(200);
      await issueInvitation({
        models,
        email,
        issuer: "integration-test-unused-before-deletion",
        ttlMs: 60 * 60 * 1_000
      });
      expect(
        (
          await freshSession
            .delete("/api/v1/me")
            .set("Origin", webOrigin)
            .set("X-CSRF-Token", freshLogin.body.csrfToken)
            .send({ password: newPassword, confirmation: "DELETE" })
        ).status
      ).toBe(204);
      expect(
        await models.Invitation.countDocuments({ consumedByUserId: registered.body.user.id })
      ).toBe(0);
      expect(await models.Invitation.countDocuments({ email })).toBe(0);
      expect(await models.PasswordReset.countDocuments({ userId: registered.body.user.id })).toBe(
        0
      );

      const rateLimitedBrowser = request.agent(accessRuntime.app);
      const rateProtection = await csrf(rateLimitedBrowser);
      // Four reset requests above already count against the IP-scoped limit of ten.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await rateLimitedBrowser
          .post("/api/v1/auth/reset-password")
          .set("Origin", webOrigin)
          .set("X-CSRF-Token", rateProtection.csrfToken)
          .send({ token: "x".repeat(43), password: newPassword });
        expect(response.status).toBe(400);
      }
      const rateLimited = await rateLimitedBrowser
        .post("/api/v1/auth/reset-password")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", rateProtection.csrfToken)
        .send({ token: "x".repeat(43), password: newPassword });
      expect(rateLimited.status).toBe(429);
    } finally {
      await accessRuntime.persistence.connection.dropDatabase();
      await accessRuntime.close();
    }
  }, 45_000);

  it("completes register, onboard, Core evidence/reflection, resume, and deletion", async () => {
    const agent = request.agent(runtime.app);
    const password = "Correct horse battery staple!";
    const authenticated = await register(agent, "MATHEW@example.com", password);
    expect(authenticated.user.email).toBe("mathew@example.com");

    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const storedUser = await runtime.persistence.models.User.findOne({
      email: "mathew@example.com"
    }).select("+passwordHash");
    if (storedUser === null) {
      throw new Error("Registration did not persist the expected user.");
    }
    const storedSession = await runtime.persistence.models.Session.findOne({
      userId: storedUser._id
    });
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);
    expect(storedUser.passwordHash).not.toContain(password);
    expect(storedSession?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedSession?.csrfHash).toMatch(/^[0-9a-f]{64}$/);

    await onboard(agent, authenticated.csrfToken, "Mathew");

    const today = await agent.get("/api/v1/me/today");
    expect(today.status).toBe(200);
    expect(today.body).toMatchObject({
      selection: "next_incomplete",
      day: {
        dayNumber: 1,
        title: "Define the developer identity and learning contract"
      },
      progress: {
        status: "not_started",
        selectedMode: null
      }
    });

    const started = await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send({
        intent: "start",
        mode: "core",
        idempotencyKey: "core-start-day-1"
      });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({
      status: "in_progress",
      selectedMode: "core"
    });

    const evidencePayload = {
      kind: "test_name",
      label: "Curriculum contract test",
      value: "contracts parse the canonical Day 1 mission",
      idempotencyKey: "core-evidence-day-1"
    };
    const evidence = await agent
      .post("/api/v1/progress/1/evidence")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send(evidencePayload);
    const replayedEvidence = await agent
      .post("/api/v1/progress/1/evidence")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send(evidencePayload);
    expect(evidence.status).toBe(200);
    expect(replayedEvidence.status).toBe(200);
    expect((replayedEvidence.body as ProgressDayResponse).evidence).toHaveLength(1);

    const reflectionPayload = {
      confused: "I had to separate a blueprint from a runtime contract.",
      mentalModelChanged: "Validation is an executable trust boundary.",
      retrieveLater: "Why must unknown input stay unknown until parsed?",
      idempotencyKey: "core-reflection-day-1"
    };
    const reflection = await agent
      .put("/api/v1/progress/1/reflection")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .send(reflectionPayload);
    expect(reflection.status).toBe(200);

    const logout = await agent
      .post("/api/v1/auth/logout")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken);
    expect(logout.status).toBe(204);
    expect((await agent.get("/api/v1/me")).body).toEqual({ authenticated: false });

    const loginProtection = await csrf(agent);
    const login = await agent
      .post("/api/v1/auth/login")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", loginProtection.csrfToken)
      .send({ email: "mathew@example.com", password });
    expect(login.status).toBe(200);
    const resumedCsrf = (login.body as AuthSessionResponse).csrfToken;

    const resumed = await agent.get("/api/v1/me/today");
    expect(resumed.body).toMatchObject({
      progress: {
        status: "in_progress",
        selectedMode: "core",
        evidence: [evidencePayload],
        reflection: {
          confused: reflectionPayload.confused,
          mentalModelChanged: reflectionPayload.mentalModelChanged,
          retrieveLater: reflectionPayload.retrieveLater
        }
      }
    });

    const complete = await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", resumedCsrf)
      .send({
        intent: "complete",
        mode: "core",
        idempotencyKey: "core-complete-day-1",
        expectedVersion: resumed.body.progress.version
      });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe("core_completed");

    await agent
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", resumedCsrf)
      .send({
        title: "Deletion cascade evidence",
        dayNumber: 1,
        content:
          "This private indexed source must be removed with every derived chunk when the learner deletes the account.",
        idempotencyKey: "deletion-cascade-note"
      })
      .expect(200);
    await agent
      .post("/api/v1/coach/explain")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", resumedCsrf)
      .send({
        action: "explain",
        dayNumber: 1,
        learnerText: "Keep the deletion trace privacy-minimized.",
        allowExternal: false
      })
      .expect(200);
    expect(await runtime.persistence.models.IndexedSource.countDocuments({})).toBe(1);
    expect(await runtime.persistence.models.AiTrace.countDocuments({})).toBeGreaterThan(0);

    const deletion = await agent
      .delete("/api/v1/me")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", resumedCsrf)
      .send({ password, confirmation: "DELETE" });
    expect(deletion.status).toBe(204);
    expect(await runtime.persistence.models.User.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.Session.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.Progress.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.Reflection.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.IndexedSource.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.AiTrace.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.XpEvent.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.ReviewItem.countDocuments({})).toBe(0);
    expect(await runtime.persistence.models.SkillEvidence.countDocuments({})).toBe(0);
    expect((await agent.get("/api/v1/curriculum/1")).status).toBe(200);
  }, 30_000);

  it("exports only the authenticated owner source and derived data without hashes or internal fields", async () => {
    const owner = request.agent(runtime.app);
    const other = request.agent(runtime.app);
    const ownerAuth = await register(owner, "export-owner@example.com");
    const otherAuth = await register(other, "export-other@example.com");
    await onboard(owner, ownerAuth.csrfToken, "Export Owner");
    await onboard(other, otherAuth.csrfToken, "Export Other");
    if (runtime.persistence.status !== "ready") throw new Error("MongoDB is required.");
    const ownerUser = await runtime.persistence.models.User.findOne({
      email: "export-owner@example.com"
    });
    const otherUser = await runtime.persistence.models.User.findOne({
      email: "export-other@example.com"
    });
    if (ownerUser === null || otherUser === null) throw new Error("Export users were not created.");

    await runtime.persistence.models.Reflection.create({
      userId: ownerUser._id,
      dayNumber: 1,
      confused: "owner-private-reflection",
      mentalModelChanged: "owner-model-change",
      retrieveLater: "owner-retrieval",
      weeklySummary: "",
      monthlyRetrospective: "",
      operationKeys: ["owner-export-reflection"],
      completedAt: null
    });
    await runtime.persistence.models.Reflection.create({
      userId: otherUser._id,
      dayNumber: 1,
      confused: "other-private-reflection",
      mentalModelChanged: "other-model-change",
      retrieveLater: "other-retrieval",
      weeklySummary: "",
      monthlyRetrospective: "",
      operationKeys: ["other-export-reflection"],
      completedAt: null
    });
    await runtime.persistence.models.IndexedSource.create({
      userId: ownerUser._id,
      title: "Owner source",
      dayNumber: 1,
      content: "owner-indexed-source",
      contentHash: "a".repeat(64),
      version: 1,
      chunks: [
        {
          chunkId: "owner-chunk",
          text: "owner-derived-chunk",
          ordinal: 0,
          contentHash: "b".repeat(64),
          embedding: [0.1, 0.2]
        }
      ],
      operationKeys: ["owner-export-index"]
    });
    await runtime.persistence.models.Invitation.create({
      tokenHash: "c".repeat(64),
      purpose: "registration",
      email: ownerUser.email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      consumedAt: new Date(),
      revokedAt: null,
      consumedByUserId: ownerUser._id,
      createdBy: "export-regression"
    });
    await runtime.persistence.models.Misconception.create({
      userId: ownerUser._id,
      sourceDayNumber: 1,
      reviewItemId: ownerUser._id,
      text: "owner-export-misconception",
      corrected: false,
      correctedAt: null
    });

    const exported = await owner.get("/api/v1/me/export");
    expect(exported.status).toBe(200);
    expect(exported.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(exported.headers["cache-control"]).toBe("no-store");
    expect(exported.body.schemaVersion).toBe("codelift.account-export.v1");
    const serialized = JSON.stringify(exported.body);
    expect(serialized).toContain("owner-private-reflection");
    expect(serialized).toContain("owner-indexed-source");
    expect(serialized).toContain("owner-derived-chunk");
    expect(serialized).toContain("owner-export-misconception");
    expect(serialized).not.toContain("other-private-reflection");
    expect(serialized).not.toContain("export-other@example.com");
    expect(serialized).not.toMatch(
      /passwordHash|tokenHash|csrfHash|contentHash|inputHash|"_id"|"userId"|consumedByUserId|reviewItemId/
    );
  });

  it("reports only thresholded aggregate pilot metrics without private learner fields", async () => {
    if (runtime.persistence.status !== "ready") throw new Error("MongoDB is required.");
    const models = runtime.persistence.models;
    const since = new Date("2026-08-01T00:00:00.000Z");
    const until = new Date("2026-09-01T00:00:00.000Z");
    const users = await models.User.create(
      Array.from({ length: 5 }, (_, index) => ({
        email: `private-metric-${index}@example.com`,
        passwordHash: `private-password-hash-${index}`,
        profile: onboardingProfile(`Private metric learner ${index}`, {
          whyItMatters: `private career reason ${index}`
        }),
        onboardedAt: new Date(`2026-08-0${index + 2}T00:30:00.000Z`),
        schemaVersion: 1,
        createdAt: new Date(`2026-08-0${index + 2}T00:00:00.000Z`),
        updatedAt: new Date(`2026-08-0${index + 2}T00:00:00.000Z`)
      }))
    );
    for (const [index, userRecord] of users.entries()) {
      await issueInvitation({
        models,
        email: userRecord.email,
        issuer: "metrics-integration-test",
        ttlMs: 60 * 60 * 1_000,
        now: new Date(`2026-08-0${index + 2}T00:00:00.000Z`)
      });
      await models.Progress.create({
        userId: userRecord._id,
        dayNumber: 1,
        status: index % 2 === 0 ? "core_completed" : "recovery_completed",
        selectedMode: index % 2 === 0 ? "core" : "recovery",
        evidence: [
          {
            kind: "text_explanation",
            label: "private evidence label",
            value: `private evidence ${index}`,
            idempotencyKey: `metric-evidence-${index}`,
            createdAt: new Date("2026-08-08T00:00:00.000Z")
          }
        ],
        operationKeys: [],
        version: 1,
        startedAt: new Date("2026-08-07T00:00:00.000Z"),
        completedAt: new Date("2026-08-08T00:00:00.000Z"),
        statusReason: null,
        rescheduledFor: null,
        estimateMinutes: 30,
        actualMinutes: 30,
        timerSeconds: 0,
        timerState: "paused",
        subtasks: []
      });
    }

    const report = await buildPilotMetrics(models, {
      since,
      until,
      minimumCohortSize: 5
    });
    expect(report.suppressed).toBe(false);
    if (report.suppressed) throw new Error("The five-user aggregate should not be suppressed.");
    expect(report.funnel).toMatchObject({ invited: 5, registered: 5, onboarded: 5 });
    expect(report.completion).toMatchObject({ core: 3, recovery: 2 });
    const serialized = JSON.stringify(report);
    for (const privateValue of [
      "private-metric",
      "Private metric learner",
      "private career reason",
      "private evidence",
      "password",
      "reflection",
      "token"
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(
      (
        await buildPilotMetrics(models, {
          since,
          until,
          minimumCohortSize: 6
        })
      ).suppressed
    ).toBe(true);
  });

  it("requires UTC-midnight boundaries for deterministic daily pilot metrics", async () => {
    if (runtime.persistence.status !== "ready") throw new Error("MongoDB is required.");
    await expect(
      buildPilotMetrics(runtime.persistence.models, {
        since: new Date("2026-08-01T00:01:00.000Z"),
        until: new Date("2026-09-01T00:00:00.000Z"),
        minimumCohortSize: 5
      })
    ).rejects.toThrow("UTC midnight");
  });

  it("keeps every pilot metric inside the exclusive fixed UTC observation window", async () => {
    if (runtime.persistence.status !== "ready") throw new Error("MongoDB is required.");
    const models = runtime.persistence.models;
    const since = new Date("2026-08-01T00:00:00.000Z");
    const until = new Date("2026-09-01T00:00:00.000Z");
    const users = await models.User.create(
      Array.from({ length: 5 }, (_, index) => ({
        email: `closed-window-${index}@example.com`,
        passwordHash: `closed-window-password-hash-${index}`,
        profile: index === 0 ? onboardingProfile(`Window learner ${index}`) : null,
        onboardedAt: index === 0 ? new Date("2026-08-02T00:30:00.000Z") : null,
        schemaVersion: 1,
        createdAt: new Date(`2026-08-0${index + 2}T00:00:00.000Z`),
        updatedAt: new Date(`2026-08-0${index + 2}T00:00:00.000Z`)
      }))
    );
    const [user0, user1, user2, user3, user4] = users;
    if (
      user0 === undefined ||
      user1 === undefined ||
      user2 === undefined ||
      user3 === undefined ||
      user4 === undefined
    ) {
      throw new Error("Expected five closed-window users.");
    }

    const progressFixture = (
      overrides: Pick<
        ProgressRecord,
        | "userId"
        | "status"
        | "selectedMode"
        | "startedAt"
        | "completedAt"
        | "createdAt"
        | "updatedAt"
      >
    ): ProgressRecord => ({
      dayNumber: 1,
      evidence: [],
      operationKeys: [],
      version: 1,
      statusReason: null,
      rescheduledFor: null,
      estimateMinutes: 30,
      actualMinutes: 30,
      timerSeconds: 0,
      timerState: "paused",
      subtasks: [],
      ...overrides
    });
    await models.Progress.create([
      progressFixture({
        userId: user0._id,
        status: "core_completed",
        selectedMode: "core",
        startedAt: new Date("2026-08-02T01:00:00.000Z"),
        completedAt: new Date("2026-08-04T00:00:00.000Z"),
        createdAt: new Date("2026-08-02T01:00:00.000Z"),
        updatedAt: new Date("2026-08-04T00:00:00.000Z")
      }),
      progressFixture({
        userId: user1._id,
        status: "recovery_completed",
        selectedMode: "recovery",
        startedAt: new Date("2026-08-03T01:00:00.000Z"),
        completedAt: new Date("2026-08-10T00:01:00.000Z"),
        createdAt: new Date("2026-08-03T01:00:00.000Z"),
        updatedAt: new Date("2026-08-10T00:01:00.000Z")
      }),
      progressFixture({
        userId: user2._id,
        status: "core_completed",
        selectedMode: "core",
        startedAt: until,
        completedAt: until,
        createdAt: until,
        updatedAt: until
      }),
      progressFixture({
        userId: user3._id,
        status: "recovery_completed",
        selectedMode: "recovery",
        startedAt: new Date("2026-08-06T01:00:00.000Z"),
        completedAt: new Date("2026-08-12T00:00:00.000Z"),
        createdAt: new Date("2026-08-06T01:00:00.000Z"),
        updatedAt: new Date("2026-10-01T00:00:00.000Z")
      })
    ]);
    await models.Reflection.create([
      {
        userId: user0._id,
        dayNumber: 1,
        operationKeys: [],
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
        updatedAt: new Date("2026-08-03T00:00:00.000Z")
      },
      {
        userId: user2._id,
        dayNumber: 1,
        operationKeys: [],
        createdAt: until,
        updatedAt: until
      }
    ]);
    await models.AiTrace.create([
      {
        userId: user0._id,
        feature: "coach",
        provider: "mock",
        outcome: "success" as const,
        promptVersion: "v1",
        latencyMs: 2,
        estimatedCostUsd: 0,
        inputHash: "a".repeat(64),
        citationCount: 0,
        metadata: {},
        createdAt: new Date("2026-08-31T23:59:59.999Z")
      },
      {
        userId: user0._id,
        feature: "coach",
        provider: "mock",
        outcome: "error" as const,
        promptVersion: "v1",
        latencyMs: 2,
        estimatedCostUsd: 0,
        inputHash: "b".repeat(64),
        citationCount: 0,
        metadata: {},
        createdAt: until
      }
    ]);
    await models.PilotAggregate.create([
      { date: "2026-08-31", event: "account_export_succeeded", count: 1 },
      { date: "2026-09-01", event: "account_deletion_succeeded", count: 1 }
    ]);
    await models.UserActivity.create({
      userId: user0._id,
      date: "2026-09-01",
      firstSeenAt: until,
      lastSeenAt: until
    });

    const report = await buildPilotMetrics(models, { since, until, minimumCohortSize: 5 });
    expect(report.suppressed).toBe(false);
    if (report.suppressed) throw new Error("The five-user aggregate should not be suppressed.");
    expect(report.funnel).toEqual({
      invited: 0,
      registered: 5,
      onboarded: 1,
      firstMissionStarted: 3,
      firstValidCompletion: 1
    });
    expect(report.completion).toEqual({
      core: 1,
      recovery: 0,
      averageMinutesToFirstValidCompletion: 2_880
    });
    expect(report.return).toEqual({ nextDay: 0, sevenDay: 0 });
    expect(report.reliability).toMatchObject({
      persistedSaveRecords: 4,
      aiInteractionCount: 1,
      aiErrorRate: 0,
      providerFallbackRate: 0,
      estimatedProviderCostUsd: 0
    });
    expect(report.lifecycle).toEqual({ exportSuccesses: 1, deletionSuccesses: 0 });

    await models.User.updateOne(
      { _id: user4._id },
      {
        $set: {
          profile: onboardingProfile("Late onboarding"),
          onboardedAt: new Date("2026-09-02T00:00:00.000Z")
        }
      }
    );
    await models.Progress.create(
      progressFixture({
        userId: user4._id,
        status: "core_completed",
        selectedMode: "core",
        startedAt: new Date("2026-09-02T00:00:00.000Z"),
        completedAt: new Date("2026-09-02T00:30:00.000Z"),
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
        updatedAt: new Date("2026-09-02T00:30:00.000Z")
      })
    );
    await models.FeatureFlag.updateOne(
      { key: "ai-kill-switch" },
      { $set: { enabled: true, updatedBy: "post-window-test" } }
    );

    expect(await buildPilotMetrics(models, { since, until, minimumCohortSize: 5 })).toEqual(report);
  });

  it("counts genuine read-only D1 and D7 activity by UTC calendar day and owns its lifecycle", async () => {
    if (runtime.persistence.status !== "ready") throw new Error("MongoDB is required.");
    const models = runtime.persistence.models;
    let now = new Date("2026-08-01T23:59:00.000Z");
    const accounts = await AccountService.create({
      models,
      curriculum: runtime.curriculum,
      sessionConfig: configFor(guardedTestUri()).session,
      registrationConfig: configFor(guardedTestUri()).registration,
      now: () => now
    });
    let returningSession: Awaited<ReturnType<AccountService["register"]>> | undefined;

    for (let index = 0; index < 5; index += 1) {
      const protection = await accounts.issueCsrf(null);
      const identity = await accounts.verifyCsrf(protection.sessionToken, protection.csrfToken);
      const registered = await accounts.register(
        identity,
        `read-only-return-${index}@example.com`,
        "Correct horse battery staple!"
      );
      if (index === 0) returningSession = registered;
    }
    if (returningSession === undefined) throw new Error("Expected one returning session.");
    await models.User.collection.updateMany(
      { email: /^read-only-return-/ },
      {
        $set: {
          createdAt: new Date("2026-08-01T23:59:00.000Z"),
          updatedAt: new Date("2026-08-01T23:59:00.000Z")
        }
      }
    );

    now = new Date("2026-08-02T00:01:00.000Z");
    expect(await accounts.me(returningSession.sessionToken)).not.toBeNull();
    now = new Date("2026-08-08T00:01:00.000Z");
    const returning = await accounts.authenticate(returningSession.sessionToken);

    const report = await buildPilotMetrics(models, {
      since: new Date("2026-08-01T00:00:00.000Z"),
      until: new Date("2026-08-09T00:00:00.000Z"),
      minimumCohortSize: 5
    });
    expect(report.suppressed).toBe(false);
    if (report.suppressed) throw new Error("The five-user aggregate should not be suppressed.");
    expect(report.return).toEqual({ nextDay: 1, sevenDay: 1 });

    const exported = await accounts.exportAccount(returning.identity.userId ?? "");
    const authenticatedActivity = (
      exported.sourceRecords as typeof exported.sourceRecords & {
        authenticatedActivity?: Array<Record<string, unknown>>;
      }
    ).authenticatedActivity;
    expect(authenticatedActivity).toHaveLength(3);
    expect(JSON.stringify(authenticatedActivity)).not.toMatch(/userId|email|private|password/i);

    await accounts.deleteAccount(returning.identity, "Correct horse battery staple!", "DELETE");
    const activityModel = (
      models as typeof models & {
        UserActivity: { countDocuments(filter: { userId: string }): Promise<number> };
      }
    ).UserActivity;
    expect(await activityModel.countDocuments({ userId: returning.identity.userId ?? "" })).toBe(0);
  });

  it("persists editable profile and review settings across a session reload", async () => {
    const agent = request.agent(runtime.app);
    const auth = await register(agent, "settings@example.com");
    await onboard(agent, auth.csrfToken, "Settings Learner");
    const updatedProfile = onboardingProfile("Settings Learner Updated", {
      preferredCodingTime: "21:15",
      routineCue: "after the evening review",
      codingPlace: "the quiet desk",
      implementationIntention:
        "At 21:15 I will make one evidence-backed change before opening another task.",
      whyItMatters: "I want each return to produce durable engineering evidence.",
      githubUsername: "settings-learner",
      targetRoles: ["Full-Stack AI Application Engineer", "Applied AI Engineer"],
      aiPrivacyMode: "ask_before_external",
      themePreference: "dark",
      motionPreference: "reduced",
      reviewPreference: "after_mission"
    });

    const update = await agent
      .put("/api/v1/me/onboarding")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send(updatedProfile);
    expect(update.status).toBe(200);
    expect(update.body.user.profile).toEqual(updatedProfile);

    const reloaded = await agent.get("/api/v1/me");
    expect(reloaded.status).toBe(200);
    expect(reloaded.body).toMatchObject({
      authenticated: true,
      user: {
        email: "settings@example.com",
        profile: updatedProfile
      }
    });
  }, 30_000);

  it("enforces Origin, CSRF, generic credentials, and account isolation", async () => {
    const userA = request.agent(runtime.app);
    const userB = request.agent(runtime.app);
    const authA = await register(userA, "a@example.com");
    const authB = await register(userB, "b@example.com");
    await onboard(userA, authA.csrfToken, "Learner A");
    await onboard(userB, authB.csrfToken, "Learner B");

    const missingCsrf = await userA.put("/api/v1/progress/1/status").set("Origin", webOrigin).send({
      intent: "start",
      mode: "core",
      idempotencyKey: "missing-csrf-start"
    });
    const wrongOrigin = await userA
      .put("/api/v1/progress/1/status")
      .set("Origin", "https://untrusted.example")
      .set("X-CSRF-Token", authA.csrfToken)
      .send({
        intent: "start",
        mode: "core",
        idempotencyKey: "wrong-origin-start"
      });
    expect(missingCsrf.status).toBe(403);
    expect(wrongOrigin.status).toBe(403);

    await userA
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", authA.csrfToken)
      .send({
        intent: "start",
        mode: "core",
        idempotencyKey: "isolated-start-a"
      })
      .expect(200);

    const todayB = await userB.get("/api/v1/me/today");
    expect(todayB.body.progress).toMatchObject({
      status: "not_started",
      evidence: []
    });

    const wrongPasswordAgent = request.agent(runtime.app);
    const wrongProtection = await csrf(wrongPasswordAgent);
    const wrongPassword = await wrongPasswordAgent
      .post("/api/v1/auth/login")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", wrongProtection.csrfToken)
      .send({ email: "a@example.com", password: "Incorrect password value!" });
    const missingUserAgent = request.agent(runtime.app);
    const missingProtection = await csrf(missingUserAgent);
    const missingUser = await missingUserAgent
      .post("/api/v1/auth/login")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", missingProtection.csrfToken)
      .send({ email: "missing@example.com", password: "Incorrect password value!" });
    expect(wrongPassword.status).toBe(401);
    expect(missingUser.status).toBe(401);
    expect({
      ...wrongPassword.body,
      requestId: "request-id"
    }).toEqual({
      ...missingUser.body,
      requestId: "request-id"
    });

    const staleSession = await request(runtime.app)
      .get("/api/v1/me")
      .set("Cookie", "codelift_session=stale-session-token");
    expect(staleSession.status).toBe(200);
    expect(staleSession.body).toEqual({ authenticated: false });
    expect(staleSession.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
  }, 30_000);

  it("records Recovery distinctly and rejects completion without evidence/reflection", async () => {
    const agent = request.agent(runtime.app);
    const auth = await register(agent, "recovery@example.com");
    await onboard(agent, auth.csrfToken, "Returning Learner");

    await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        intent: "start",
        mode: "recovery",
        idempotencyKey: "recovery-start-day-1"
      })
      .expect(200);

    const premature = await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        intent: "complete",
        mode: "recovery",
        idempotencyKey: "recovery-premature-day-1"
      });
    expect(premature.status).toBe(409);
    expect(premature.body.type).toContain("completion-evidence-required");

    await agent
      .post("/api/v1/progress/1/evidence")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        kind: "text_explanation",
        label: "Five-minute return",
        value: "I opened the shell lesson and explained one command.",
        idempotencyKey: "recovery-evidence-day-1"
      })
      .expect(200);

    const missingReflection = await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        intent: "complete",
        mode: "recovery",
        idempotencyKey: "recovery-no-reflection-day-1"
      });
    expect(missingReflection.status).toBe(409);
    expect(missingReflection.body.type).toContain("completion-reflection-required");

    await agent
      .put("/api/v1/progress/1/reflection")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        confused: "The flags were unfamiliar.",
        mentalModelChanged: "A command is a program plus arguments.",
        retrieveLater: "What does the current directory change?",
        idempotencyKey: "recovery-reflection-day-1"
      })
      .expect(200);

    const complete = await agent
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        intent: "complete",
        mode: "recovery",
        idempotencyKey: "recovery-complete-day-1"
      });
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({
      status: "recovery_completed",
      selectedMode: "recovery"
    });
    const [firstDashboard, secondDashboard] = await Promise.all([
      agent.get("/api/v1/dashboard"),
      agent.get("/api/v1/dashboard")
    ]);
    expect(firstDashboard.status).toBe(200);
    expect(secondDashboard.status).toBe(200);
    expect(firstDashboard.body.summary.xp).toBe(5);
    expect(secondDashboard.body.summary.xp).toBe(5);
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    expect(await runtime.persistence.models.XpEvent.countDocuments({})).toBe(1);
  }, 30_000);

  it("serves the learning workspace, tenant-scoped RAG, coach fallback, planner approval, and local evals", async () => {
    const learner = request.agent(runtime.app);
    const otherLearner = request.agent(runtime.app);
    const auth = await register(learner, "workspace@example.com");
    const otherAuth = await register(otherLearner, "other-workspace@example.com");
    await onboard(learner, auth.csrfToken, "Workspace Learner");
    await onboard(otherLearner, otherAuth.csrfToken, "Other Learner");

    const dashboard = await learner.get("/api/v1/dashboard").expect(200);
    expect(dashboard.body.journey).toHaveLength(365);
    expect(dashboard.body.summary).toMatchObject({
      currentDayNumber: 1,
      coreCompletions: 0,
      recoveryWins: 0,
      xp: 0
    });

    const roadmap = await learner.get("/api/v1/roadmap").expect(200);
    expect(roadmap.body.milestones).toHaveLength(12);
    expect(roadmap.body.sevenDayPreview).toHaveLength(7);

    const catchUp = await learner
      .post("/api/v1/progress/catch-up-plan")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        strategy: "calendar_catch_up",
        reason: "",
        idempotencyKey: "workspace-catch-up"
      })
      .expect(200);
    expect(catchUp.body.maxCoreMissionsPerDay).toBe(1);
    expect(
      new Set(catchUp.body.items.map((item: { scheduledDate: string }) => item.scheduledDate)).size
    ).toBe(catchUp.body.items.length);

    expect((await learner.get("/api/v1/tasks/1").expect(200)).body).toMatchObject({
      dayNumber: 1,
      status: "not_started",
      estimateMinutes: 30,
      subtasks: [],
      nextSubtask: null
    });
    const taskPayload = {
      status: "opened",
      estimateMinutes: 30,
      actualMinutes: 8,
      timerSeconds: 480,
      timerState: "paused",
      rescheduledFor: null,
      subtasks: [
        {
          id: "workspace-subtask-one",
          title: "Write the failing boundary test",
          estimateMinutes: 10,
          actualMinutes: 8,
          completed: false
        }
      ],
      idempotencyKey: "workspace-task-plan"
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const task = await learner
        .put("/api/v1/tasks/1")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", auth.csrfToken)
        .send(taskPayload)
        .expect(200);
      expect(task.body).toMatchObject({
        status: "opened",
        actualMinutes: 8,
        nextSubtask: { id: "workspace-subtask-one" }
      });
      expect(task.body.subtasks).toHaveLength(1);
    }
    const taskBackedStart = await learner
      .put("/api/v1/progress/1/status")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        intent: "start",
        mode: "core",
        idempotencyKey: "workspace-task-backed-start"
      })
      .expect(200);
    expect(taskBackedStart.body).toMatchObject({
      status: "in_progress",
      selectedMode: "core"
    });
    expect(taskBackedStart.body.evidence).toEqual([]);

    await learner
      .put("/api/v1/reflections/periodic/7")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        weeklySummary:
          "I created one validated vertical slice and corrected one trust-boundary misconception.",
        monthlyRetrospective: "",
        idempotencyKey: "workspace-weekly-reflection"
      })
      .expect(200);
    expect(
      (await learner.get("/api/v1/reflections/periodic").expect(200)).body.reflections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayNumber: 7,
          weeklySummary: expect.stringContaining("vertical slice")
        })
      ])
    );

    const jobPayload = {
      company: "Example Product Lab",
      role: "Full-Stack AI Application Engineer",
      status: "researching",
      evidenceLinks: ["https://example.com/portfolio"],
      nextAction: "Map the role requirements to two evidence-backed artifacts.",
      idempotencyKey: "workspace-job-application"
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await learner
        .post("/api/v1/career/applications")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", auth.csrfToken)
        .send(jobPayload)
        .expect(201);
    }
    const applications = await learner.get("/api/v1/career/applications").expect(200);
    expect(applications.body.applications).toHaveLength(1);
    expect(applications.body.applications[0]).toMatchObject({
      company: "Example Product Lab",
      status: "researching"
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await otherLearner
        .post("/api/v1/progress/catch-up-plan")
        .set("Origin", webOrigin)
        .set("X-CSRF-Token", otherAuth.csrfToken)
        .send({
          strategy: "intentionally_skip",
          reason: "This topic is already demonstrated in linked portfolio evidence.",
          idempotencyKey: "other-workspace-intentional-skip"
        })
        .expect(200);
    }
    const skippedDashboard = await otherLearner.get("/api/v1/dashboard").expect(200);
    expect(skippedDashboard.body.summary).toMatchObject({
      currentDayNumber: 2,
      intentionalSkips: 1,
      coreCompletions: 0,
      recoveryWins: 0
    });

    const note = await learner
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        title: "Runtime validation boundary",
        dayNumber: 1,
        content:
          "Runtime validation keeps network values unknown until a schema proves every required field. A malformed response must become a visible error state, not invented curriculum.",
        idempotencyKey: "workspace-note-one"
      })
      .expect(200);
    expect(note.body.source).toMatchObject({ version: 1, chunkCount: 1 });

    const otherNote = await otherLearner
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", otherAuth.csrfToken)
      .send({
        title: "Private other-tenant phrase",
        dayNumber: 2,
        content: "The private phrase is lunar-tenant-only and must never cross accounts.",
        idempotencyKey: "other-workspace-note"
      })
      .expect(200);

    const supported = await learner
      .post("/api/v1/search/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ question: "Why keep network values unknown until validation?", topK: 5 })
      .expect(200);
    expect(supported.body).toMatchObject({
      abstained: false,
      generated: false,
      retrievalMode: "hybrid_mock"
    });
    expect(supported.body.citations[0].sourceTitle).toBe("Runtime validation boundary");
    expect(supported.body.citations.length).toBeLessThanOrEqual(2);
    expect(supported.body.statements[0].citationChunkIds).toEqual(
      supported.body.citations.map((citation: { chunkId: string }) => citation.chunkId)
    );

    const cedarNote = await learner
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        title: "Cedar canary",
        dayNumber: 1,
        content:
          "The Cedar canary latency budget is 240 milliseconds. The canary cohort uses purple tags and remains tenant-private.",
        idempotencyKey: "workspace-cedar-note"
      })
      .expect(200);

    const cedarSupported = await learner
      .post("/api/v1/search/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ question: "What is the Cedar canary latency budget?", topK: 5 })
      .expect(200);
    expect(cedarSupported.body).toMatchObject({ abstained: false, generated: false });
    expect(cedarSupported.body.answer).toContain("240 milliseconds");
    expect(cedarSupported.body.citations).toEqual([
      expect.objectContaining({ sourceId: cedarNote.body.source.id, sourceTitle: "Cedar canary" })
    ]);

    const zephyrUnsupported = await learner
      .post("/api/v1/search/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ question: "What is the launch date of the Zephyr lunar colony?", topK: 5 })
      .expect(200);
    expect(zephyrUnsupported.body).toMatchObject({
      abstained: true,
      generated: false,
      citations: [],
      statements: [expect.objectContaining({ support: "unsupported", citationChunkIds: [] })]
    });

    const isolated = await learner
      .post("/api/v1/search/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ question: "What is the lunar-tenant-only private phrase?", topK: 5 })
      .expect(200);
    expect(isolated.body.abstained).toBe(true);
    expect(JSON.stringify(isolated.body)).not.toContain("lunar-tenant-only");

    const coach = await learner
      .post("/api/v1/coach/explain")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        action: "explain",
        dayNumber: 1,
        learnerText: "I think validation is a trust boundary.",
        allowExternal: false
      })
      .expect(200);
    expect(coach.body).toMatchObject({
      generated: true,
      provider: "mock"
    });
    expect(coach.body.evidenceBoundary).toContain("does not claim understanding");

    const plan = await learner
      .post("/api/v1/planner/week")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        weekStart: "2026-07-27",
        availableMinutes: 210,
        priorities: ["retrieval", "portfolio evidence"],
        idempotencyKey: "workspace-plan"
      })
      .expect(201);
    expect(plan.body).toMatchObject({
      mode: "deterministic_workflow",
      status: "awaiting_approval",
      terminalReason: "awaiting_human_approval"
    });
    expect(plan.body.actions).toHaveLength(7);
    expect(new Set(plan.body.actions.map((item: { date: string }) => item.date)).size).toBe(7);

    const approved = await learner
      .post(`/api/v1/planner/${plan.body.id}/approve`)
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        note: "",
        expectedStatus: "awaiting_approval",
        idempotencyKey: "workspace-plan-approval"
      })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: "approved",
      terminalReason: "approved_by_human"
    });

    await learner
      .post("/api/v1/errors")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        title: "Trusted an unparsed payload",
        dayNumber: 1,
        bug: "The UI read unknown JSON directly.",
        hypothesis: "A runtime schema is missing.",
        evidence: "A malformed fixture rendered instead of failing closed.",
        fix: "Parse with the shared strict schema.",
        test: "malformed payload returns a contract error",
        lesson: "Static types do not validate network bytes.",
        tags: ["validation", "http"],
        idempotencyKey: "workspace-error"
      })
      .expect(201);
    expect((await learner.get("/api/v1/errors").expect(200)).body.entries).toHaveLength(1);

    const portfolio = await learner.get("/api/v1/portfolio").expect(200);
    expect(portfolio.body.artifacts.length).toBeGreaterThanOrEqual(12);
    expect(portfolio.body.artifacts[0]).toMatchObject({
      status: "not_started"
    });

    const evaluated = await learner
      .post("/api/v1/evals/local")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .expect(201);
    expect(evaluated.body.run).toMatchObject({
      datasetVersion: "local-behavior-v2",
      evaluatorVersion: "behavioral-evaluator-v2.0.0",
      passed: true,
      score: 1,
      criticalFailures: [],
      negativeControlsPassed: true
    });
    expect(evaluated.body.run.datasetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(evaluated.body.run.cases.length).toBeGreaterThanOrEqual(30);
    expect(
      evaluated.body.run.cases.every(
        (entry: { input: object; observed: object; assertions: object[] }) =>
          Object.keys(entry.input).length > 0 &&
          Object.keys(entry.observed).length > 0 &&
          entry.assertions.length > 0
      )
    ).toBe(true);

    const persistedEvalRuns = await learner.get("/api/v1/evals/runs").expect(200);
    expect(persistedEvalRuns.body.runs[0]).toMatchObject({
      id: evaluated.body.run.id,
      datasetHash: evaluated.body.run.datasetHash,
      evaluatorVersion: "behavioral-evaluator-v2.0.0",
      providerConfig: evaluated.body.run.providerConfig,
      passingScore: 1,
      criticalFailures: [],
      negativeControlsPassed: true
    });
    expect(persistedEvalRuns.body.runs[0].cases[0]).toMatchObject({
      caseId: evaluated.body.run.cases[0].caseId,
      input: evaluated.body.run.cases[0].input,
      expectedBehavior: evaluated.body.run.cases[0].expectedBehavior,
      observed: evaluated.body.run.cases[0].observed,
      assertions: evaluated.body.run.cases[0].assertions
    });

    const operations = await learner.get("/api/v1/ai/operations").expect(200);
    expect(operations.body.capabilities.map((item: { provider: string }) => item.provider)).toEqual(
      expect.arrayContaining(["mock", "python_mock", "local", "openai"])
    );
    expect(operations.body.traces.length).toBeGreaterThanOrEqual(3);

    const deleteOtherTenantNote = await learner
      .delete(`/api/v1/notes/${otherNote.body.source.id}`)
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken);
    expect(deleteOtherTenantNote.status).toBe(404);
  }, 30_000);

  it("deletes an owner's indexed source and embedded chunks without crossing tenants", async () => {
    const owner = request.agent(runtime.app);
    const ownerAuth = await register(owner, "note-delete-owner@example.com");
    await onboard(owner, ownerAuth.csrfToken, "Note owner");
    const other = request.agent(runtime.app);
    const otherAuth = await register(other, "note-delete-other@example.com");
    await onboard(other, otherAuth.csrfToken, "Other note owner");

    const ownerNote = await owner
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({
        title: "Owner validation boundary",
        dayNumber: 1,
        content:
          "Runtime validation keeps unknown network data outside the trusted application boundary.",
        idempotencyKey: "owner-note-for-source-delete"
      })
      .expect(200);
    const otherNote = await other
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", otherAuth.csrfToken)
      .send({
        title: "Other tenant source",
        dayNumber: 2,
        content: "This tenant-owned chunk must survive another account's source deletion.",
        idempotencyKey: "other-note-for-source-delete"
      })
      .expect(200);

    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const ownerSourceBeforeDelete = await runtime.persistence.models.IndexedSource.findById(
      ownerNote.body.source.id
    ).lean();
    if (ownerSourceBeforeDelete === null) {
      throw new Error("The owner source must exist before its deletion boundary is exercised.");
    }
    expect(ownerSourceBeforeDelete.chunks.length).toBeGreaterThan(0);
    const ownerChunkIds = ownerSourceBeforeDelete.chunks.map((chunk) => chunk.chunkId);

    await other
      .delete(`/api/v1/notes/${ownerNote.body.source.id}`)
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", otherAuth.csrfToken)
      .expect(404);
    expect(
      await runtime.persistence.models.IndexedSource.countDocuments({
        _id: ownerNote.body.source.id,
        userId: ownerSourceBeforeDelete.userId
      })
    ).toBe(1);

    await owner
      .delete(`/api/v1/notes/${ownerNote.body.source.id}`)
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .expect(204);

    expect(
      await runtime.persistence.models.IndexedSource.findById(ownerNote.body.source.id)
    ).toBeNull();
    expect(
      await runtime.persistence.models.IndexedSource.countDocuments({
        userId: ownerSourceBeforeDelete.userId,
        "chunks.chunkId": { $in: ownerChunkIds }
      })
    ).toBe(0);
    expect((await owner.get("/api/v1/notes").expect(200)).body.sources).toEqual([]);

    const unsupportedAfterDelete = await owner
      .post("/api/v1/search/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ question: "Why keep unknown network data outside the boundary?", topK: 5 })
      .expect(200);
    expect(unsupportedAfterDelete.body).toMatchObject({ abstained: true, citations: [] });

    const otherSources = await other.get("/api/v1/notes").expect(200);
    expect(otherSources.body.sources).toEqual([
      expect.objectContaining({
        id: otherNote.body.source.id,
        title: "Other tenant source",
        chunkCount: 1
      })
    ]);
  }, 30_000);

  it("provides protected development Admin diagnostics, controls, scenarios, and scoped reset", async () => {
    await request(runtime.app).get("/api/v1/admin/overview").expect(401);

    const owner = request.agent(runtime.app);
    const ownerAuth = await register(owner, "admin-owner@example.com");
    await onboard(owner, ownerAuth.csrfToken, "Development owner");
    const other = request.agent(runtime.app);
    const otherAuth = await register(other, "admin-other@example.com");
    await onboard(other, otherAuth.csrfToken, "Other development owner");

    await owner
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({
        title: "Admin reset owner note",
        dayNumber: 1,
        content: "This owner-scoped source and its embedded chunk should be reset.",
        idempotencyKey: "admin-reset-owner-note"
      })
      .expect(200);
    const otherNote = await other
      .put("/api/v1/notes")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", otherAuth.csrfToken)
      .send({
        title: "Admin reset other note",
        dayNumber: 2,
        content: "This other tenant source must survive the owner's demo reset.",
        idempotencyKey: "admin-reset-other-note"
      })
      .expect(200);
    await owner
      .post("/api/v1/errors")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({
        title: "Admin reset error fixture",
        dayNumber: 1,
        bug: "A deterministic fixture failed.",
        hypothesis: "The boundary rejected it.",
        evidence: "The strict schema returned an issue.",
        fix: "Keep the explicit failure state.",
        test: "admin reset removes the current account fixture",
        lesson: "Development resets must remain tenant scoped.",
        tags: ["admin", "reset"],
        idempotencyKey: "admin-reset-error-fixture"
      })
      .expect(201);

    const overview = await owner.get("/api/v1/admin/overview?dayNumber=2").expect(200);
    expect(overview.body).toMatchObject({
      developmentOnly: true,
      curriculum: {
        schemaVersion: "2.0.0",
        documentVersion: 2,
        dayCount: 365,
        milestoneCount: 12,
        preview: { dayNumber: 2 },
        quality: {
          missing: expect.any(Array),
          duplicates: expect.any(Array)
        }
      },
      resources: {
        total: expect.any(Number),
        statusCounts: {
          source_verified: expect.any(Number),
          reachable: expect.any(Number),
          unknown: expect.any(Number),
          unreachable: expect.any(Number)
        }
      },
      reset: {
        confirmationPhrase: "RESET DEMO DATA",
        scope: "current_account_product_data"
      }
    });
    expect(overview.body.resources.total).toBeGreaterThanOrEqual(88);
    expect(overview.body.resources.items).toHaveLength(overview.body.resources.total);
    expect(overview.body.seeds.migrations.map((entry: { status: string }) => entry.status)).toEqual(
      ["applied", "applied", "applied"]
    );
    expect(overview.body.featureFlags.map((entry: { key: string }) => entry.key)).toEqual(
      expect.arrayContaining(["ai-kill-switch", "bounded-planner", "external-ai"])
    );
    expect(overview.body.mockScenarios.map((entry: { key: string }) => entry.key)).toEqual(
      expect.arrayContaining(["timeout", "schema_error", "rag_no_evidence"])
    );
    expect(overview.body.visualStates).toHaveLength(18);

    await owner
      .put("/api/v1/admin/feature-flags/ai-kill-switch")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ enabled: true, confirmation: "wrong phrase" })
      .expect(422);
    const enabledKillSwitch = await owner
      .put("/api/v1/admin/feature-flags/ai-kill-switch")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ enabled: true, confirmation: "UPDATE DEVELOPMENT FLAG" })
      .expect(200);
    expect(enabledKillSwitch.body).toMatchObject({ key: "ai-kill-switch", enabled: true });

    const timeoutScenario = await owner
      .post("/api/v1/admin/mock-scenarios")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ scenario: "timeout" })
      .expect(200);
    expect(timeoutScenario.body).toMatchObject({
      scenario: "timeout",
      outcome: "timeout",
      generated: false
    });
    expect(timeoutScenario.body.trace).toEqual(
      expect.arrayContaining(["reach_deadline", "use_deterministic_fallback"])
    );

    await owner
      .post("/api/v1/admin/reset-demo-data")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ confirmation: "DELETE EVERYTHING" })
      .expect(422);
    const reset = await owner
      .post("/api/v1/admin/reset-demo-data")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", ownerAuth.csrfToken)
      .send({ confirmation: "RESET DEMO DATA" })
      .expect(200);
    expect(reset.body).toMatchObject({
      reset: true,
      scope: "current_account_product_data",
      preserved: ["account", "profile", "active_session", "global_seed_data"]
    });
    expect(reset.body.deletedRecords).toBeGreaterThanOrEqual(2);
    expect((await owner.get("/api/v1/notes").expect(200)).body.sources).toEqual([]);
    expect((await owner.get("/api/v1/errors").expect(200)).body.entries).toEqual([]);
    expect((await owner.get("/api/v1/me").expect(200)).body).toMatchObject({
      authenticated: true,
      user: { email: "admin-owner@example.com" }
    });
    expect((await other.get("/api/v1/notes").expect(200)).body.sources).toEqual([
      expect.objectContaining({ id: otherNote.body.source.id, title: "Admin reset other note" })
    ]);

    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    expect(await runtime.persistence.models.CurriculumDay.countDocuments()).toBe(365);
    expect(await runtime.persistence.models.Resource.countDocuments()).toBeGreaterThanOrEqual(88);
    expect(
      await runtime.persistence.models.FeatureFlag.findOne({ key: "ai-kill-switch" }).lean()
    ).toMatchObject({ enabled: true });
  }, 30_000);

  it("unlocks the persisted bounded graph after Month 11 and honors the global kill switch", async () => {
    const learner = request.agent(runtime.app);
    const auth = await register(learner, "agent-graph@example.com");
    await onboard(learner, auth.csrfToken, "Graph learner");
    if (runtime.persistence.status !== "ready") {
      throw new Error("The real Mongo runtime is required.");
    }
    const user = await runtime.persistence.models.User.findOne({
      email: "agent-graph@example.com"
    }).lean();
    if (user === null) throw new Error("The graph test user was not persisted.");
    await runtime.persistence.models.Progress.insertMany(
      Array.from({ length: 308 }, (_, index) => ({
        userId: user._id,
        dayNumber: index + 1,
        status: "intentionally_skipped",
        selectedMode: null,
        statusReason: "Bounded graph unlock fixture."
      }))
    );

    const boundedRequest = {
      weekStart: "2026-08-03",
      availableMinutes: 90,
      priorities: ["typed state", "retrieval"],
      idempotencyKey: "month-eleven-agent-plan"
    };
    const bounded = await learner
      .post("/api/v1/planner/week")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send(boundedRequest)
      .expect(201);
    expect(bounded.body).toMatchObject({
      mode: "bounded_agent",
      status: "awaiting_approval",
      terminalReason: "awaiting_human_approval"
    });
    expect(bounded.body.trace).toEqual(
      expect.arrayContaining([
        expect.stringContaining("gather_progress"),
        expect.stringContaining("search_notes"),
        expect.stringContaining("validate_plan"),
        expect.stringContaining("Human review required")
      ])
    );
    const stored = await runtime.persistence.models.AgentRun.findById(bounded.body.id).lean();
    expect(stored?.graphVersion).toBe("planner-graph-v1");
    expect(stored?.graphState.checkpoints.length).toBeGreaterThanOrEqual(6);
    expect(stored?.graphState.toolCallKeys).toHaveLength(4);
    const replayed = await learner
      .post("/api/v1/planner/week")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send(boundedRequest)
      .expect(201);
    expect(replayed.body.id).toBe(bounded.body.id);
    expect(
      await runtime.persistence.models.AgentRun.countDocuments({
        userId: user._id,
        operationKeys: boundedRequest.idempotencyKey
      })
    ).toBe(1);

    const revised = await learner
      .post(`/api/v1/planner/${bounded.body.id}/revise`)
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        note: "Emphasize retrieval evidence.",
        expectedStatus: "awaiting_approval",
        idempotencyKey: "month-eleven-agent-revision"
      })
      .expect(200);
    expect(revised.body).toMatchObject({
      mode: "bounded_agent",
      status: "awaiting_approval",
      terminalReason: "awaiting_human_approval"
    });
    expect(
      revised.body.actions.some((action: { rationale: string }) =>
        action.rationale.includes("Emphasize retrieval evidence")
      )
    ).toBe(true);

    await runtime.persistence.models.FeatureFlag.updateOne(
      { key: "ai-kill-switch" },
      { $set: { enabled: true, updatedBy: "bounded-graph-integration-test" } }
    );
    const killed = await learner
      .post("/api/v1/planner/week")
      .set("Origin", webOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({
        weekStart: "2026-08-10",
        availableMinutes: 90,
        priorities: ["authorization"],
        idempotencyKey: "month-eleven-killed-plan"
      })
      .expect(201);
    expect(killed.body.mode).toBe("deterministic_workflow");
    expect(killed.body.trace.join(" ")).toContain(
      "global AI kill switch prevented bounded-agent execution"
    );
  }, 30_000);
});
