import type { CurriculumDayResponse } from "@codelift/contracts";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { bootstrapApi } from "../bootstrap.js";
import type { ApiConfig } from "../config.js";
import type { CurriculumRuntime } from "../curriculum/runtime.js";
import type { RequestLogRecord, StructuredRequestLogger } from "../middleware/request-context.js";

const canonicalCurriculumPath = fileURLToPath(
  new URL("../../../../codelift_ai_curriculum_seed_v2_2026.json", import.meta.url)
);
const invalidCurriculumPath = fileURLToPath(
  new URL("./fixtures/invalid-curriculum.json", import.meta.url)
);

const expectedDayOne: CurriculumDayResponse = {
  dayNumber: 1,
  weekNumber: 1,
  monthNumber: 1,
  phaseTitle: "Developer Reset and Web Foundations",
  weekTitle: "Environment, identity, shell, and Git",
  modeLabel: "Concept and first example",
  title: "Define the developer identity and learning contract",
  learningSeed:
    "Turn the year goal into a process goal: return for 30 minutes, produce one small artifact, and record evidence. Review how the curriculum and repository will work.",
  buildTask:
    "Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.",
  corePrinciple:
    "Systems improve when goals are observable and work is decomposed into repeatable state transitions.",
  retrievalQuestion: "What observable evidence proves that today counted?",
  tinyArtifact:
    "Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.",
  recoveryTask:
    "Open the first resource, write three bullets explaining “Define the developer identity and learning contract,” then make one tiny edit, example, or test toward today’s build task.",
  optionalStretchSeed:
    "Add one meaningful edge-case test, diagram annotation, benchmark comparison, or three-sentence teach-back connected to today’s principle.",
  coreSchedule: [
    {
      label: "Preview",
      minutes: 3
    },
    {
      label: "Focused resource",
      minutes: 10
    },
    {
      label: "Example or code",
      minutes: 12
    },
    {
      label: "Closed-note recall and commit",
      minutes: 5
    }
  ],
  skillTags: ["git", "shell", "developer-tools", "professional-practice"],
  resourceIds: ["odinFoundations", "missing2026"],
  resourceLinks: [
    {
      id: "odinFoundations",
      provider: "The Odin Project",
      title: "Foundations",
      url: "https://www.theodinproject.com/paths/foundations/courses/foundations",
      type: "course",
      topicHint:
        "Find the git, shell, and developer-tools material needed to create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table. Stop when the artifact is ready for inspection: “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
      lastCheckedStatus: "source_verified"
    },
    {
      id: "missing2026",
      provider: "MIT Missing Semester",
      title: "2026 Course Index",
      url: "https://missing.csail.mit.edu/2026/",
      type: "course",
      topicHint:
        "Find the git, shell, and developer-tools material needed to create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table. Stop when the artifact is ready for inspection: “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
      lastCheckedStatus: "source_verified"
    }
  ],
  prerequisiteDayNumbers: [],
  learningObjective:
    "Build evidence for “Define the developer identity and learning contract.” Complete “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table,” then verify the result against the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
  whyItMattersForAIEngineering:
    "AI-enabled products depend on git, shell, and developer-tools. Here, “Systems improve when goals are observable and work is decomposed into repeatable state transitions” becomes concrete through the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
  mentalModel:
    "Connect concept, action, and evidence: Turn the year goal into a process goal: return for 30 minutes, produce one small artifact, and record evidence. Review how the curriculum and repository will work; then create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table; finally inspect the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
  commonMistake:
    "During Environment, identity, shell, and Git, do not treat “What observable evidence proves that today counted?” as answered until the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” demonstrates the result and you can relate it to “Systems improve when goals are observable and work is decomposed into repeatable state transitions.”",
  recoveryMinutes: 5,
  optionalStretchMinutes: 10,
  knowledgeChecks: [
    {
      id: "day-1-recall",
      kind: "recall",
      prompt:
        "Within Environment, identity, shell, and Git, what observable evidence proves that today counted? Ground the answer in “Systems improve when goals are observable and work is decomposed into repeatable state transitions” and cite the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
      hint: "Start from the Environment, identity, shell, and Git evidence in the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” before reopening the resource.",
      explanation:
        "For Environment, identity, shell, and Git, a complete answer connects “What observable evidence proves that today counted?” to this principle: Systems improve when goals are observable and work is decomposed into repeatable state transitions."
    },
    {
      id: "day-1-application",
      kind: "application",
      prompt:
        "Apply git: alter one constraint in “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” and predict how the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” should expose the difference.",
      hint: "Use the action “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” and inspect the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.”",
      explanation:
        "For Environment, identity, shell, and Git, the altered constraint must produce a specific, testable difference in the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table”; otherwise the prediction is not observable."
    },
    {
      id: "day-1-explanation",
      kind: "explanation",
      prompt:
        "Compare “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” with a shortcut that ignores “Systems improve when goals are observable and work is decomposed into repeatable state transitions.” Why would the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” reveal the tradeoff?",
      hint: "For Environment, identity, shell, and Git, use “Systems improve when goals are observable and work is decomposed into repeatable state transitions” to compare the reliable path with the shortcut.",
      explanation:
        "Connect concept, action, and evidence: Turn the year goal into a process goal: return for 30 minutes, produce one small artifact, and record evidence. Review how the curriculum and repository will work; then create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table; finally inspect the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.” Explain the tradeoff using the actual build evidence, without claiming that one choice is universally correct."
    }
  ],
  teachBackPrompt:
    "Teach define the developer identity and learning contract in three sentences: explain “Systems improve when goals are observable and work is decomposed into repeatable state transitions,” describe how you will create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table, and point to the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” as evidence.",
  retrievalPrompts: [
    "For Environment, identity, shell, and Git, what observable evidence proves that today counted? Connect the answer to “Systems improve when goals are observable and work is decomposed into repeatable state transitions.”",
    "Which part of the artifact “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” proves that “Systems improve when goals are observable and work is decomposed into repeatable state transitions” held during Environment, identity, shell, and Git?",
    "How would the result change if you replaced “Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table” with the shortcut described in the common mistake?"
  ],
  acceptableEvidenceTypes: [
    "commit_url",
    "test_name",
    "screenshot_url",
    "demo_url",
    "text_explanation",
    "local_artifact_path"
  ],
  portfolioMilestone:
    "A reproducible development workspace and a public learning repository with a clear goal."
};

const silentLogger: StructuredRequestLogger = {
  info() {
    // Integration tests inspect HTTP behavior unless a test supplies a recorder.
  }
};

function testConfig(curriculumPath: string, nodeEnv: ApiConfig["nodeEnv"] = "test"): ApiConfig {
  return {
    nodeEnv,
    port: 4000,
    trustProxyHops: 0,
    webOrigin: "http://localhost:5173",
    curriculumPath,
    jsonBodyLimit: "32kb",
    persistence: {
      mode: "optional",
      mongoUri: null,
      databaseName: "codelift_test",
      serverSelectionTimeoutMs: 100
    },
    session: {
      cookieName: "codelift_session",
      secureCookie: false,
      idleTtlMs: 7 * 24 * 60 * 60 * 1000,
      absoluteTtlMs: 30 * 24 * 60 * 60 * 1000
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
      agentEnabled: false
    }
  };
}

describe("M1 API integration", () => {
  let app: Awaited<ReturnType<typeof bootstrapApi>>["app"];

  beforeAll(async () => {
    ({ app } = await bootstrapApi({
      config: testConfig(canonicalCurriculumPath),
      logger: silentLogger
    }));
  });

  it("keeps process health independent from curriculum readiness", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api"
    });
    expect(response.body).not.toHaveProperty("curriculum");
  });

  it("reports honest degraded readiness when curriculum is valid but Mongo is optional", async () => {
    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "degraded",
      service: "api",
      curriculum: {
        dayCount: 365
      },
      capabilities: {
        publicPreview: true,
        privateAccounts: false
      }
    });
  });

  it.each(["/api/v1/curriculum/today", "/api/v1/curriculum/1"])(
    "returns the exact canonical Day 1 response from %s",
    async (path) => {
      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedDayOne);
    }
  );

  it.each(["0", "366", "1.5", "01", "-1", "not-a-day"])(
    "rejects invalid dayNumber %s with problem details",
    async (dayNumber) => {
      const response = await request(app).get(`/api/v1/curriculum/${dayNumber}`);

      expect(response.status).toBe(400);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(response.body).toMatchObject({
        type: "https://codelift.ai/problems/invalid-day-number",
        title: "Invalid curriculum day",
        status: 400
      });
      expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    }
  );

  it("sets explicit CORS, request ID, and Helmet security headers", async () => {
    const response = await request(app)
      .get("/api/v1/curriculum/1")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-ID");
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("trusts only the explicitly configured reverse-proxy hop count", () => {
    const directConfig = testConfig(canonicalCurriculumPath);
    expect(app.get("trust proxy")).toBe(false);

    const proxiedApp = createApp({
      config: { ...directConfig, trustProxyHops: 1 },
      curriculum: {
        status: "ready",
        dayCount: 365,
        sourceSha256: "a".repeat(64),
        days: [expectedDayOne],
        resources: {},
        getDay() {
          return expectedDayOne;
        }
      },
      logger: silentLogger
    });

    expect(proxiedApp.get("trust proxy")).toBe(1);
  });

  it("does not authorize an unlisted browser origin through CORS", async () => {
    const response = await request(app)
      .get("/api/v1/curriculum/1")
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("handles an allowed browser preflight explicitly", async () => {
    const response = await request(app)
      .options("/api/v1/curriculum/1")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
  });

  it("starts process health but fails readiness and data closed for an invalid source", async () => {
    const invalid = await bootstrapApi({
      config: testConfig(invalidCurriculumPath),
      logger: silentLogger
    });

    expect(invalid.curriculum).toMatchObject({
      status: "unready",
      failureCode: "CURRICULUM_SOURCE_INVALID"
    });

    const healthResponse = await request(invalid.app).get("/health");
    const readyResponse = await request(invalid.app).get("/ready");
    const curriculumResponse = await request(invalid.app).get("/api/v1/curriculum/1");

    expect(healthResponse.status).toBe(200);
    expect(readyResponse.status).toBe(503);
    expect(curriculumResponse.status).toBe(503);
    expect(readyResponse.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(readyResponse.body).toMatchObject({
      type: "https://codelift.ai/problems/curriculum-unavailable",
      title: "Curriculum unavailable",
      status: 503
    });
    expect(JSON.stringify(readyResponse.body)).not.toContain(invalidCurriculumPath);
    expect(JSON.stringify(readyResponse.body)).not.toContain("stack");
  });

  it("bounds JSON payloads and returns problem details", async () => {
    const response = await request(app)
      .post("/not-a-route")
      .send({ content: "x".repeat(40 * 1024) });

    expect(response.status).toBe(413);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://codelift.ai/problems/payload-too-large",
      title: "Payload too large",
      status: 413
    });
  });

  it("returns problem details for unmatched routes", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://codelift.ai/problems/not-found",
      title: "Route not found",
      status: 404
    });
  });

  it("keeps every Admin API path disabled behind a generic production 404", async () => {
    const productionApp = createApp({
      config: testConfig(canonicalCurriculumPath, "production"),
      curriculum: {
        status: "ready",
        dayCount: 365,
        sourceSha256: "a".repeat(64),
        days: [],
        resources: {},
        getDay() {
          return undefined;
        }
      },
      logger: silentLogger
    });

    for (const response of [
      await request(productionApp).get("/api/v1/admin/overview"),
      await request(productionApp).post("/api/v1/admin/reset-demo-data")
    ]) {
      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toMatchObject({
        type: "https://codelift.ai/problems/not-found",
        title: "Route not found",
        status: 404
      });
      expect(JSON.stringify(response.body)).not.toContain("admin");
    }
  });

  it("never exposes a production stack, filesystem path, or internal error message", async () => {
    const failingCurriculum: CurriculumRuntime = {
      status: "ready",
      dayCount: 365,
      sourceSha256: "a".repeat(64),
      days: [],
      resources: {},
      getDay() {
        throw new Error(`sensitive source: ${canonicalCurriculumPath}`);
      }
    };
    const productionApp = createApp({
      config: testConfig(canonicalCurriculumPath, "production"),
      curriculum: failingCurriculum,
      logger: silentLogger
    });

    const response = await request(productionApp).get("/api/v1/curriculum/1");
    const serializedProblem = JSON.stringify(response.body);

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "https://codelift.ai/problems/internal-error",
      title: "Internal server error",
      status: 500
    });
    expect(serializedProblem).not.toContain("sensitive source");
    expect(serializedProblem).not.toContain(canonicalCurriculumPath);
    expect(serializedProblem).not.toContain("stack");
  });

  it("writes privacy-minimized structured request logs", async () => {
    const records: RequestLogRecord[] = [];
    const recordingLogger: StructuredRequestLogger = {
      info(record) {
        records.push(record);
      }
    };
    const loggedApp = createApp({
      config: testConfig(canonicalCurriculumPath),
      curriculum: {
        status: "ready",
        dayCount: 365,
        sourceSha256: "a".repeat(64),
        days: [expectedDayOne],
        resources: {},
        getDay() {
          return expectedDayOne;
        }
      },
      logger: recordingLogger
    });

    await request(loggedApp)
      .get("/health?access_token=do-not-log")
      .set("User-Agent", "private-client-detail");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: "http.request",
      method: "GET",
      route: "/health",
      statusCode: 200
    });

    const serializedRecord = JSON.stringify(records[0]);
    expect(serializedRecord).not.toContain("access_token");
    expect(serializedRecord).not.toContain("do-not-log");
    expect(serializedRecord).not.toContain("private-client-detail");
    expect(serializedRecord).not.toContain("user-agent");
  });
});
