import type { OnboardingProfile } from "@codelift/contracts";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AccountService } from "../account/service.js";
import { issuePasswordReset } from "../account/access-operator.js";
import { createOpaqueToken, digestOpaqueToken, hashPassword } from "../account/security.js";
import type { AiConfig, PersistenceConfig } from "../config.js";
import { initializeCurriculum, type CurriculumRuntime } from "../curriculum/runtime.js";
import { LearningService } from "../learning/service.js";
import {
  closePersistence,
  initializePersistence,
  type PersistenceRuntime
} from "../persistence/runtime.js";

const curriculumPath = fileURLToPath(
  new URL("../../../../codelift_ai_curriculum_seed_v2_2026.json", import.meta.url)
);
const password = "Correct horse battery staple!";
const noteSourceLimit = 100;

const profile: OnboardingProfile = {
  displayName: "Security regression learner",
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
  reviewPreference: "before_mission"
};

const aiConfig: AiConfig = {
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
};

function guardedPersistenceConfig(): PersistenceConfig {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Security regression cleanup requires NODE_ENV=test.");
  }
  const rawUri = process.env.MONGO_TEST_URI;
  if (rawUri === undefined || rawUri.trim() === "") {
    throw new Error("Security regression tests require MONGO_TEST_URI.");
  }
  const uri = new URL(rawUri);
  uri.pathname = "/codelift_security_regressions_test";
  return {
    mode: "required",
    mongoUri: uri.toString(),
    databaseName: "codelift_security_regressions_test",
    serverSelectionTimeoutMs: 3_000
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe.sequential("M16 security regression boundaries", () => {
  let persistence: Extract<PersistenceRuntime, { status: "ready" }>;
  let curriculum: Extract<CurriculumRuntime, { status: "ready" }>;
  let accounts: AccountService;
  let learning: LearningService;

  beforeAll(async () => {
    const initializedCurriculum = await initializeCurriculum(curriculumPath);
    if (initializedCurriculum.status !== "ready") {
      throw new Error("The canonical curriculum must be ready for security regression tests.");
    }
    curriculum = initializedCurriculum;

    const initializedPersistence = await initializePersistence(guardedPersistenceConfig());
    if (initializedPersistence.status !== "ready") {
      throw new Error("The Mongo replica set must be ready for security regression tests.");
    }
    persistence = initializedPersistence;
    accounts = await AccountService.create({
      models: persistence.models,
      curriculum,
      sessionConfig: {
        cookieName: "codelift_session",
        secureCookie: false,
        idleTtlMs: 7 * 24 * 60 * 60 * 1_000,
        absoluteTtlMs: 30 * 24 * 60 * 60 * 1_000
      },
      registrationConfig: {
        mode: "open",
        invitationTtlMs: 7 * 24 * 60 * 60 * 1_000,
        passwordResetTtlMs: 60 * 60 * 1_000
      }
    });
    learning = new LearningService({ models: persistence.models, curriculum, aiConfig });
  }, 60_000);

  beforeEach(async () => {
    await persistence.connection.dropDatabase();
    await Promise.all(Object.values(persistence.models).map((model) => model.createIndexes()));
  }, 60_000);

  afterAll(async () => {
    if (persistence !== undefined) {
      await persistence.connection.dropDatabase();
      await closePersistence(persistence);
    }
  });

  async function createUser(email: string) {
    return persistence.models.User.create({
      email,
      passwordHash: await hashPassword(password),
      profile,
      schemaVersion: 1
    });
  }

  it("never leaves terminal progress with an incomplete concurrent reflection", async () => {
    const user = await createUser("reflection-race@example.com");
    await persistence.models.Progress.create({
      userId: user._id,
      dayNumber: 1,
      status: "in_progress",
      selectedMode: "core",
      evidence: [
        {
          kind: "test_name",
          label: "Regression test",
          value: "reflection completion race",
          idempotencyKey: "reflection-race-evidence",
          createdAt: new Date()
        }
      ],
      operationKeys: ["reflection-race-start"],
      version: 1,
      startedAt: new Date(),
      completedAt: null,
      statusReason: null,
      rescheduledFor: null
    });
    await persistence.models.Reflection.create({
      userId: user._id,
      dayNumber: 1,
      confused: "A complete answer.",
      mentalModelChanged: "A complete model change.",
      retrieveLater: "A complete retrieval cue.",
      operationKeys: ["reflection-race-complete"]
    });

    await Promise.allSettled([
      accounts.saveReflection(user.id, 1, {
        confused: "",
        mentalModelChanged: "",
        retrieveLater: "",
        idempotencyKey: "reflection-race-partial"
      }),
      accounts.updateStatus(user.id, 1, {
        intent: "complete",
        mode: "core",
        expectedVersion: 1,
        idempotencyKey: "reflection-race-finish"
      })
    ]);

    const [progress, reflection] = await Promise.all([
      persistence.models.Progress.findOne({ userId: user._id, dayNumber: 1 }).lean(),
      persistence.models.Reflection.findOne({ userId: user._id, dayNumber: 1 }).lean()
    ]);
    const terminal = progress?.status === "core_completed";
    const completeReflection =
      (reflection?.confused.trim().length ?? 0) > 0 &&
      (reflection?.mentalModelChanged.trim().length ?? 0) > 0 &&
      (reflection?.retrieveLater.trim().length ?? 0) > 0;
    expect(terminal && !completeReflection).toBe(false);
  });

  it("revokes replacement and sibling password-reset credentials", async () => {
    const user = await createUser("reset-lifecycle@example.com");
    const first = await issuePasswordReset({
      models: persistence.models,
      email: user.email,
      ttlMs: 60 * 60 * 1_000,
      issuer: "security-regression-first"
    });
    const replacement = await issuePasswordReset({
      models: persistence.models,
      email: user.email,
      ttlMs: 60 * 60 * 1_000,
      issuer: "security-regression-replacement"
    });
    expect((await persistence.models.PasswordReset.findById(first.id).lean())?.revokedAt).toEqual(
      expect.any(Date)
    );

    const siblingToken = createOpaqueToken();
    const sibling = await persistence.models.PasswordReset.create({
      tokenHash: digestOpaqueToken(siblingToken),
      purpose: "password_reset",
      userId: user._id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      consumedAt: null,
      revokedAt: null,
      createdBy: "security-regression-sibling"
    });
    await accounts.resetPassword(replacement.token, "A newer correct horse battery staple!");
    expect(
      (await persistence.models.PasswordReset.findById(sibling._id).lean())?.revokedAt
    ).toEqual(expect.any(Date));
    await expect(
      accounts.resetPassword(siblingToken, "An attacker-selected replacement password!")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a stale-password login when reset wins after verification", async () => {
    const user = await createUser("reset-login-race@example.com");
    const replacementPassword = "A replacement password for the login race!";
    const reset = await issuePasswordReset({
      models: persistence.models,
      email: user.email,
      ttlMs: 60 * 60 * 1_000,
      issuer: "security-regression-login-race"
    });
    const authorityWriteEntered = deferred();
    const releaseAuthorityWrite = deferred();
    const userModel = persistence.models.User as unknown as {
      updateOne: (...argumentsValue: unknown[]) => Promise<unknown>;
    };
    const originalUpdateOne = userModel.updateOne.bind(userModel);
    let blocked = false;
    userModel.updateOne = async (...argumentsValue: unknown[]) => {
      const update = argumentsValue[1] as { $inc?: { writeFence?: number } } | undefined;
      if (!blocked && update?.$inc?.writeFence === 1) {
        blocked = true;
        authorityWriteEntered.resolve();
        await releaseAuthorityWrite.promise;
      }
      return originalUpdateOne(...argumentsValue);
    };

    try {
      const staleLogin = accounts.login(
        { sessionId: "000000000000000000000001", userId: null },
        user.email,
        password
      );
      const staleLoginRejected = expect(staleLogin).rejects.toMatchObject({ status: 401 });
      await authorityWriteEntered.promise;
      await accounts.resetPassword(reset.token, replacementPassword);
      releaseAuthorityWrite.resolve();
      await staleLoginRejected;
    } finally {
      userModel.updateOne = originalUpdateOne;
      releaseAuthorityWrite.resolve();
    }

    expect(await persistence.models.Session.countDocuments({ userId: user._id })).toBe(0);
    await expect(
      accounts.login(
        { sessionId: "000000000000000000000002", userId: null },
        user.email,
        replacementPassword
      )
    ).resolves.toMatchObject({ user: { email: user.email } });
  });

  it("rejects stale-password deletion when reset wins after verification", async () => {
    const user = await createUser("reset-deletion-race@example.com");
    const replacementPassword = "A replacement password for the deletion race!";
    await persistence.models.Progress.create({
      userId: user._id,
      dayNumber: 1,
      status: "not_started",
      selectedMode: null,
      evidence: [],
      operationKeys: [],
      version: 0,
      startedAt: null,
      completedAt: null,
      statusReason: null,
      rescheduledFor: null
    });
    const reset = await issuePasswordReset({
      models: persistence.models,
      email: user.email,
      ttlMs: 60 * 60 * 1_000,
      issuer: "security-regression-deletion-race"
    });
    const authorityWriteEntered = deferred();
    const releaseAuthorityWrite = deferred();
    const userModel = persistence.models.User as unknown as {
      updateOne: (...argumentsValue: unknown[]) => Promise<unknown>;
    };
    const originalUpdateOne = userModel.updateOne.bind(userModel);
    let blocked = false;
    userModel.updateOne = async (...argumentsValue: unknown[]) => {
      const update = argumentsValue[1] as { $inc?: { writeFence?: number } } | undefined;
      if (!blocked && update?.$inc?.writeFence === 1) {
        blocked = true;
        authorityWriteEntered.resolve();
        await releaseAuthorityWrite.promise;
      }
      return originalUpdateOne(...argumentsValue);
    };

    try {
      const staleDeletion = accounts.deleteAccount(
        { sessionId: "000000000000000000000003", userId: user.id },
        password,
        "DELETE"
      );
      const staleDeletionRejected = expect(staleDeletion).rejects.toMatchObject({ status: 401 });
      await authorityWriteEntered.promise;
      await accounts.resetPassword(reset.token, replacementPassword);
      releaseAuthorityWrite.resolve();
      await staleDeletionRejected;
    } finally {
      userModel.updateOne = originalUpdateOne;
      releaseAuthorityWrite.resolve();
    }

    expect(await persistence.models.User.countDocuments({ _id: user._id })).toBe(1);
    expect(await persistence.models.Progress.countDocuments({ userId: user._id })).toBe(1);
    await expect(
      accounts.login(
        { sessionId: "000000000000000000000004", userId: null },
        user.email,
        replacementPassword
      )
    ).resolves.toMatchObject({ user: { email: user.email } });
  });

  it("rejects note creation after the owner reaches the private corpus source cap", async () => {
    const user = await createUser("note-cap@example.com");
    await persistence.models.IndexedSource.insertMany(
      Array.from({ length: noteSourceLimit }, (_, index) => ({
        userId: user._id,
        title: `Bounded note ${index + 1}`,
        dayNumber: null,
        content: `Bounded source ${index + 1}`,
        contentHash: index.toString(16).padStart(64, "0"),
        version: 1,
        chunks: [
          {
            chunkId: `chunk-${index + 1}`,
            text: `Bounded source ${index + 1}`,
            ordinal: 0,
            contentHash: index.toString(16).padStart(64, "0"),
            embedding: [0]
          }
        ],
        operationKeys: [`bounded-note-${index + 1}`]
      }))
    );

    await expect(
      learning.saveNote(user.id, {
        title: "One source too many",
        dayNumber: null,
        content: "This valid note must be rejected before it exceeds the account quota.",
        idempotencyKey: "bounded-note-overflow"
      })
    ).rejects.toMatchObject({ status: 413 });
    expect(await persistence.models.IndexedSource.countDocuments({ userId: user._id })).toBe(
      noteSourceLimit
    );
  });

  it("serializes concurrent note creates at the private corpus source cap", async () => {
    const user = await createUser("note-cap-race@example.com");
    await persistence.models.IndexedSource.insertMany(
      Array.from({ length: noteSourceLimit - 1 }, (_, index) => ({
        userId: user._id,
        title: `Concurrent bounded note ${index + 1}`,
        dayNumber: null,
        content: `Concurrent bounded source ${index + 1}`,
        contentHash: (index + 2_000).toString(16).padStart(64, "0"),
        version: 1,
        chunks: [
          {
            chunkId: `concurrent-chunk-${index + 1}`,
            text: `Concurrent bounded source ${index + 1}`,
            ordinal: 0,
            contentHash: (index + 2_000).toString(16).padStart(64, "0"),
            embedding: [0]
          }
        ],
        operationKeys: [`concurrent-bounded-note-${index + 1}`]
      }))
    );

    const results = await Promise.allSettled([
      learning.saveNote(user.id, {
        title: "Concurrent note A",
        dayNumber: null,
        content: "Only one concurrent source may consume the final quota slot.",
        idempotencyKey: "concurrent-note-cap-a"
      }),
      learning.saveNote(user.id, {
        title: "Concurrent note B",
        dayNumber: null,
        content: "The other concurrent source must fail closed at the quota.",
        idempotencyKey: "concurrent-note-cap-b"
      })
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await persistence.models.IndexedSource.countDocuments({ userId: user._id })).toBe(
      noteSourceLimit
    );
  });

  it("stops an oversized account export at a bounded collection cursor", async () => {
    const user = await createUser("bounded-export@example.com");
    await persistence.models.AiTrace.insertMany(
      Array.from({ length: 1_001 }, (_, index) => ({
        userId: user._id,
        feature: `bounded-export-${index}`,
        provider: "mock",
        outcome: "success",
        promptVersion: "security-regression-v1",
        latencyMs: 1,
        estimatedCostUsd: 0,
        inputHash: index.toString(16).padStart(64, "0"),
        citationCount: 0,
        metadata: {}
      }))
    );

    await expect(accounts.exportAccount(user.id)).rejects.toMatchObject({ status: 413 });
  });

  it("deletion fences a coach trace that was authenticated before deletion began", async () => {
    const user = await createUser("deletion-race@example.com");
    const traceCreateEntered = deferred();
    const releaseTraceCreate = deferred();
    const traceModel = persistence.models.AiTrace as unknown as {
      create: (...argumentsValue: unknown[]) => Promise<unknown>;
    };
    const originalCreate = traceModel.create.bind(traceModel);
    traceModel.create = async (...argumentsValue: unknown[]) => {
      traceCreateEntered.resolve();
      await releaseTraceCreate.promise;
      return originalCreate(...argumentsValue);
    };

    try {
      const coach = learning.coach(user.id, {
        action: "explain",
        dayNumber: 1,
        learnerText: "Keep this authenticated write inside the deletion boundary.",
        allowExternal: false
      });
      await traceCreateEntered.promise;

      const deletion = accounts.deleteAccount(
        { sessionId: "000000000000000000000000", userId: user.id },
        password,
        "DELETE"
      );
      await Promise.race([deletion, delay(200)]);
      releaseTraceCreate.resolve();
      await Promise.allSettled([coach, deletion]);
    } finally {
      traceModel.create = originalCreate;
      releaseTraceCreate.resolve();
    }

    expect(await persistence.models.User.countDocuments({ _id: user._id })).toBe(0);
    expect(await persistence.models.AiTrace.countDocuments({ userId: user._id })).toBe(0);
  });

  it("resumes one stale interrupted planner decision claim with the original payload", async () => {
    let nowMs = Date.parse("2026-09-02T08:00:00.000Z");
    const resumableLearning = new LearningService({
      models: persistence.models,
      curriculum,
      aiConfig,
      now: () => new Date(nowMs)
    });
    const user = await createUser("planner-resume@example.com");
    const run = await resumableLearning.createPlan(user.id, {
      weekStart: "2026-09-07",
      availableMinutes: 90,
      priorities: ["durable decisions"],
      idempotencyKey: "planner-resume-create"
    });
    const request = {
      note: "",
      expectedStatus: "awaiting_approval" as const,
      idempotencyKey: "planner-resume-approve"
    };
    const collection = persistence.models.AgentRun.collection as unknown as {
      findOneAndUpdate: (...argumentsValue: unknown[]) => Promise<unknown>;
    };
    const originalFindOneAndUpdate = collection.findOneAndUpdate.bind(collection);
    let interrupted = false;
    collection.findOneAndUpdate = async (...argumentsValue: unknown[]) => {
      const update = argumentsValue[1] as
        | {
            $addToSet?: { operationKeys?: unknown };
            $set?: { status?: unknown };
          }
        | undefined;
      const result = await originalFindOneAndUpdate(...argumentsValue);
      if (
        !interrupted &&
        update?.$set?.status === "running" &&
        update.$addToSet?.operationKeys === request.idempotencyKey
      ) {
        interrupted = true;
        throw new Error("Simulated interruption after the planner decision claim committed.");
      }
      return result;
    };

    try {
      await expect(
        resumableLearning.decidePlan(user.id, run.id, request, "approve")
      ).rejects.toThrow("Simulated interruption");
    } finally {
      collection.findOneAndUpdate = originalFindOneAndUpdate;
    }

    expect(interrupted).toBe(true);
    const interruptedRun = await persistence.models.AgentRun.findById(run.id)
      .select("+decisionClaim")
      .lean();
    const durableClaim = (
      interruptedRun as unknown as {
        decisionClaim?: {
          action: string;
          idempotencyKey: string;
          note: string;
          ownerId: string;
          checkpointId: string | null;
          leasedAt: Date;
          leaseExpiresAt: Date;
        } | null;
      } | null
    )?.decisionClaim;
    expect(interruptedRun?.status).toBe("running");
    expect(durableClaim).toMatchObject({
      action: "approve",
      idempotencyKey: request.idempotencyKey,
      note: request.note
    });
    expect(durableClaim?.ownerId).toMatch(/^[a-f0-9]{24}$/u);
    expect(durableClaim?.checkpointId).toBe(`${run.id}:validate_plan:1`);
    expect(durableClaim?.leasedAt).toEqual(new Date(nowMs));
    expect(durableClaim?.leaseExpiresAt.getTime()).toBeGreaterThan(nowMs);

    nowMs += 10 * 60 * 1_000;
    await expect(
      resumableLearning.decidePlan(
        user.id,
        run.id,
        { ...request, note: "Do not replace the original claimed payload." },
        "approve"
      )
    ).rejects.toMatchObject({ status: 409 });

    const finalized = await resumableLearning.decidePlan(user.id, run.id, request, "approve");
    expect(finalized.status).toBe("approved");
    expect(await resumableLearning.decidePlan(user.id, run.id, request, "approve")).toEqual(
      finalized
    );

    const stored = await persistence.models.AgentRun.findById(run.id)
      .select("+decisionClaim")
      .lean();
    expect(stored?.operationKeys.filter((key) => key === request.idempotencyKey)).toHaveLength(1);
    expect(
      stored?.graphState.decisionKeys.filter((key) => key === request.idempotencyKey)
    ).toHaveLength(1);
    expect(
      stored?.graphState.trace.filter((event) => event.kind === "human_decision")
    ).toHaveLength(1);
    expect((stored as unknown as { decisionClaim?: unknown } | null)?.decisionClaim).toBeNull();
  });

  it("allows only one authoritative concurrent planner decision", async () => {
    const user = await createUser("planner-race@example.com");
    const run = await learning.createPlan(user.id, {
      weekStart: "2026-09-07",
      availableMinutes: 90,
      priorities: ["state integrity"],
      idempotencyKey: "planner-race-create"
    });

    const results = await Promise.allSettled([
      learning.decidePlan(
        user.id,
        run.id,
        {
          note: "Approve the proposal.",
          expectedStatus: "awaiting_approval",
          idempotencyKey: "planner-race-approve"
        },
        "approve"
      ),
      learning.decidePlan(
        user.id,
        run.id,
        {
          note: "Revise the proposal.",
          expectedStatus: "awaiting_approval",
          idempotencyKey: "planner-race-revise"
        },
        "revise"
      )
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const stored = await persistence.models.AgentRun.findById(run.id).lean();
    expect(stored?.operationKeys).toHaveLength(2);
    expect(stored?.status).toMatch(/^(approved|awaiting_approval)$/);
  });
});
