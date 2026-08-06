import type {
  AuthSessionResponse,
  CsrfResponse,
  OnboardingProfile,
  ProgressDayResponse
} from "@codelift/contracts";
import { fileURLToPath } from "node:url";
import request, { type Agent } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bootstrapApi, type BootstrappedApi } from "../bootstrap.js";
import type { ApiConfig } from "../config.js";
import type { StructuredRequestLogger } from "../middleware/request-context.js";

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

function configFor(uri: string): ApiConfig {
  return {
    nodeEnv: "test",
    port: 4000,
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
      runtime.persistence.models.JobApplication.deleteMany({})
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
