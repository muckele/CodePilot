import type { CurriculumDayResponse, PlannerRequest } from "@codelift/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiGateway } from "../ai/providers.js";
import { executeLocalEvalScenario, runLocalBehavioralEvaluation } from "../ai/local-eval.js";
import type { AiConfig } from "../config.js";
import {
  addLocalDays,
  buildCatchUpPlan,
  buildPlannerActions,
  calculateStreaks,
  chunkText,
  cosineSimilarity,
  deterministicEmbedding,
  lexicalSimilarity,
  roadmapPreviewDayNumbers,
  scoreRagRelevance,
  reviewDueDates,
  skillStateForCompletion,
  xpForCompletion
} from "../domain/learning.js";

describe("learning domain invariants", () => {
  it("schedules the complete spaced-review sequence across a leap day", () => {
    expect(reviewDueDates("2028-02-28")).toEqual([
      { intervalDays: 1, dueDate: "2028-02-29" },
      { intervalDays: 3, dueDate: "2028-03-02" },
      { intervalDays: 7, dueDate: "2028-03-06" },
      { intervalDays: 14, dueDate: "2028-03-13" },
      { intervalDays: 30, dueDate: "2028-03-29" }
    ]);
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("keeps Core and Recovery XP honest and distinct", () => {
    expect(xpForCompletion("core")).toBe(30);
    expect(xpForCompletion("recovery")).toBe(5);
  });

  it("counts returns without destructively resetting nonconsecutive history", () => {
    expect(
      calculateStreaks(
        ["2026-07-01", "2026-07-02", "2026-07-05", "2026-07-06", "2026-07-07"],
        "2026-07-08"
      )
    ).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      rolling7DayReturns: 4,
      rolling30DayReturns: 5,
      graceTokensRemaining: 0
    });
  });

  it("uses one grace token to protect a streak without fabricating a return", () => {
    expect(
      calculateStreaks(["2026-07-20", "2026-07-21", "2026-07-23", "2026-07-24"], "2026-07-24", 1)
    ).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      rolling7DayReturns: 4,
      rolling30DayReturns: 4,
      graceTokensRemaining: 0
    });
  });

  it("advances skill state only from the evidence-bearing completion mode", () => {
    expect(skillStateForCompletion("recovery", true)).toBe("introduced");
    expect(skillStateForCompletion("core", false)).toBe("practiced");
    expect(skillStateForCompletion("core", true)).toBe("demonstrated");
  });

  it("never schedules more than one Core mission on a calendar day", () => {
    const plan = buildCatchUpPlan({
      strategy: "calendar_catch_up",
      currentDayNumber: 18,
      today: "2026-07-24",
      missedDays: 12
    });
    expect(plan.maxCoreMissionsPerDay).toBe(1);
    expect(plan.items).toHaveLength(7);
    expect(new Set(plan.items.map((item) => item.scheduledDate)).size).toBe(7);
    expect(plan.items.every((item) => item.mode === "core")).toBe(true);
  });

  it("keeps the roadmap preview unique at the end of the curriculum", () => {
    expect(roadmapPreviewDayNumbers(360)).toEqual([360, 361, 362, 363, 364, 365]);
    expect(roadmapPreviewDayNumbers(365)).toEqual([365]);
  });

  it("requires the caller to preserve an intentional skip as a non-completion", () => {
    const plan = buildCatchUpPlan({
      strategy: "intentionally_skip",
      currentDayNumber: 18,
      today: "2026-07-24",
      missedDays: 2
    });
    expect(plan.items[0]).toMatchObject({ dayNumber: 19, mode: "core" });
    expect(plan.explanation).toContain("never recorded as Core or Recovery");
  });

  it("creates deterministic normalized embeddings and bounded similarity", () => {
    const first = deterministicEmbedding("runtime validation boundary");
    const second = deterministicEmbedding("runtime validation boundary");
    const unrelated = deterministicEmbedding("watercolor landscape");
    expect(first).toEqual(second);
    expect(first).toHaveLength(64);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1);
    expect(cosineSimilarity(first, unrelated)).toBeGreaterThanOrEqual(0);
    expect(cosineSimilarity(first, unrelated)).toBeLessThanOrEqual(1);
    expect(lexicalSimilarity("runtime validation", "runtime contract validation")).toBe(1);
  });

  it("requires meaningful lexical evidence before a hash-vector match can support RAG", () => {
    const note =
      "The Cedar canary latency budget is 240 milliseconds. The canary cohort uses purple tags and remains tenant-private.";
    const supportedQuestion = "What is the Cedar canary latency budget?";
    const unrelatedQuestion = "What is the launch date of the Zephyr lunar colony?";

    expect(lexicalSimilarity(unrelatedQuestion, note)).toBe(0);
    expect(
      scoreRagRelevance({
        question: supportedQuestion,
        text: note,
        queryEmbedding: deterministicEmbedding(supportedQuestion),
        textEmbedding: deterministicEmbedding(note)
      })
    ).toMatchObject({ supported: true });
    expect(
      scoreRagRelevance({
        question: unrelatedQuestion,
        text: note,
        queryEmbedding: deterministicEmbedding(unrelatedQuestion),
        textEmbedding: deterministicEmbedding(note)
      })
    ).toMatchObject({ lexical: 0, supported: false });
  });

  it("chunks by paragraph, hashes every chunk, and preserves order", () => {
    const chunks = chunkText(
      "First paragraph explains a bounded state transition.\n\nSecond paragraph names the evidence.\n\nThird paragraph explains the test.",
      70
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_chunk, index) => index));
    expect(chunks.every((chunk) => /^[0-9a-f]{64}$/.test(chunk.contentHash))).toBe(true);
  });

  it("builds a deterministic planner with unique dates and bounded steps", () => {
    const request: PlannerRequest = {
      weekStart: "2026-07-27",
      availableMinutes: 840,
      priorities: ["retrieval"],
      idempotencyKey: "planner-test-key"
    };
    const actions = buildPlannerActions({ request, currentDayNumber: 360 });
    expect(actions).toHaveLength(7);
    expect(new Set(actions.map((action) => action.date)).size).toBe(7);
    expect(actions.every((action) => action.minutes === 30)).toBe(true);
    expect(actions.at(-1)?.dayNumber).toBe(365);
  });
});

const mockAiConfig: AiConfig = {
  provider: "mock",
  pythonBaseUrl: "http://127.0.0.1:8000",
  localBaseUrl: "http://127.0.0.1:11434",
  openAiBaseUrl: "https://api.openai.com/v1",
  openAiApiKey: null,
  openAiModel: null,
  timeoutMs: 500,
  maxRetries: 0,
  externalEnabled: false,
  agentEnabled: false
};

const dayFixture = {
  dayNumber: 1,
  title: "Validate a boundary",
  learningObjective: "Parse unknown input.",
  corePrinciple: "Unknown input remains unknown until parsed.",
  tinyArtifact: "A failing malformed-input test.",
  knowledgeChecks: [
    {
      id: "one",
      kind: "recall",
      prompt: "What stays unknown?",
      hint: "Inspect the boundary.",
      explanation: "Network input stays unknown."
    },
    {
      id: "two",
      kind: "application",
      prompt: "Which test fails?",
      hint: "Mutate a field.",
      explanation: "The schema test fails."
    },
    {
      id: "three",
      kind: "explanation",
      prompt: "Why parse?",
      hint: "Static types do not run remotely.",
      explanation: "Parsing creates runtime trust."
    }
  ]
} as unknown as CurriculumDayResponse;

describe("AI provider boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns schema-valid mock guidance without claiming mastery", async () => {
    const result = await new AiGateway(mockAiConfig).coach({
      request: {
        action: "explain",
        dayNumber: 1,
        learnerText: "I think I understand this.",
        allowExternal: false
      },
      day: dayFixture,
      permitExternal: false
    });
    expect(result.provider).toBe("mock");
    expect(result.outcome).toBe("success");
    expect(result.estimatedCostUsd).toBe(0);
    expect(result.payload.evidenceBoundary).toContain("does not claim understanding");
  });

  it("falls back deterministically when an external provider lacks configuration or consent", async () => {
    const result = await new AiGateway({
      ...mockAiConfig,
      provider: "openai",
      externalEnabled: true
    }).coach({
      request: {
        action: "socratic",
        dayNumber: 1,
        learnerText: "private note",
        allowExternal: false
      },
      day: dayFixture,
      permitExternal: false
    });
    expect(result.provider).toBe("fallback");
    expect(result.outcome).toBe("fallback");
    expect(result.failureKind).toBe("permission_denied");
    expect(result.payload.socraticQuestion.length).toBeGreaterThan(10);
  });

  it("does not contact a configured provider when the kill switch forces mock mode", async () => {
    const result = await new AiGateway({
      ...mockAiConfig,
      provider: "python_mock",
      pythonBaseUrl: "http://127.0.0.1:1"
    }).coach({
      request: {
        action: "next_step",
        dayNumber: 1,
        learnerText: "keep this private",
        allowExternal: true
      },
      day: dayFixture,
      permitExternal: true,
      forceMock: true
    });
    expect(result.provider).toBe("mock");
    expect(result.outcome).toBe("fallback");
    expect(result.failureKind).toBe("permission_denied");
    expect(result.detail).toContain("kill switch");
  });

  it("normalizes a Python-service timeout and returns validated local guidance", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AiGateway({
      ...mockAiConfig,
      provider: "python_mock",
      timeoutMs: 25
    }).coach({
      request: {
        action: "explain",
        dayNumber: 1,
        learnerText: "",
        allowExternal: false
      },
      day: dayFixture,
      permitExternal: false
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("fallback");
    expect(result.outcome).toBe("fallback");
    expect(result.failureKind).toBe("timeout");
    expect(result.detail).toMatch(/^[0-9a-f]{16}$/);
    expect(result.payload.evidenceBoundary).toContain("does not claim understanding");
  });
});

describe("shared local behavioral evaluation", () => {
  it("cites Cedar evidence and abstains from an unrelated Zephyr question", async () => {
    const source = {
      sourceId: "cedar-canary",
      tenantId: "tenant-a",
      title: "Cedar canary",
      text: "The Cedar canary latency budget is 240 milliseconds. The canary cohort uses purple tags and remains tenant-private."
    };
    const supported = await executeLocalEvalScenario({
      kind: "rag",
      input: {
        tenantId: "tenant-a",
        question: "What is the Cedar canary latency budget?",
        topK: 3,
        sources: [source],
        relevantSourceIds: [source.sourceId],
        injectionMarker: null
      }
    });
    expect(supported.observed).toMatchObject({
      abstained: false,
      support: "source_supported",
      citationCount: 1,
      retrievedSourceIds: [source.sourceId]
    });

    const unrelated = await executeLocalEvalScenario({
      kind: "rag",
      input: {
        tenantId: "tenant-a",
        question: "What is the launch date of the Zephyr lunar colony?",
        topK: 3,
        sources: [source],
        relevantSourceIds: [],
        injectionMarker: null
      }
    });
    expect(unrelated.observed).toMatchObject({
      abstained: true,
      support: "unsupported",
      citationCount: 0,
      retrievedSourceIds: [],
      retrievedChunkIds: [],
      citationChunkIds: []
    });
  });

  it("executes the canonical dataset and records expected-versus-observed evidence", async () => {
    const report = await runLocalBehavioralEvaluation({
      now: () => new Date("2026-08-06T12:00:00.000Z")
    });

    expect(report).toMatchObject({
      evaluationProfile: "provider-independent-behavioral-v2",
      evaluatorVersion: "behavioral-evaluator-v2.0.0",
      passed: true,
      score: 1,
      criticalFailures: [],
      negativeControlsPassed: true,
      externalNetworkCalls: 0,
      estimatedCostUsd: 0
    });
    expect(report.dataset.caseCount).toBeGreaterThanOrEqual(30);
    expect(report.dataset.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.cases.every((entry) => entry.assertions.length > 0)).toBe(true);
    expect(report.cases.every((entry) => Object.keys(entry.observed).length > 0)).toBe(true);
    expect(report.cases.map((entry) => entry.scenarioKind)).toEqual(
      expect.arrayContaining(["coach", "rag", "tool_guard", "planner", "output_safety"])
    );
    expect(
      report.cases.find((entry) => entry.caseId === "tool-valid-read")?.observed
    ).toMatchObject({
      productionBoundaryOutcome: "executed",
      productionErrorCode: "none",
      handlerCalls: 1,
      executed: true
    });
    expect(
      report.cases.find((entry) => entry.caseId === "tool-invalid-arguments")?.observed
    ).toMatchObject({
      productionBoundaryOutcome: "rejected",
      productionErrorCode: "TOOL_ARGUMENT_INVALID",
      handlerCalls: 0,
      executed: false
    });
    expect(
      report.cases.find((entry) => entry.caseId === "tool-authorization-denied")?.observed
    ).toMatchObject({
      productionBoundaryOutcome: "rejected",
      productionErrorCode: "TOOL_UNAUTHORIZED",
      handlerCalls: 0,
      executed: false
    });
    expect(
      report.cases.find((entry) => entry.caseId === "tool-duplicate-call")?.observed
    ).toMatchObject({
      productionBoundaryOutcome: "blocked_before_registry",
      handlerCalls: 0,
      duplicate: true,
      executed: false
    });
  });

  it("fails a critical gate and lowers the score for deliberately broken observed behavior", async () => {
    const report = await runLocalBehavioralEvaluation({
      execute: async (scenario) => {
        const observation = await executeLocalEvalScenario(scenario);
        if (scenario.kind !== "coach" || scenario.input.providerScenario !== "valid") {
          return observation;
        }
        return {
          ...observation,
          observed: {
            ...observation.observed,
            schemaValid: false
          }
        };
      }
    });

    expect(report.passed).toBe(false);
    expect(report.score).toBeLessThan(1);
    expect(report.criticalFailures).toContain("coach-valid-strict-schema");
    expect(
      report.cases.find((entry) => entry.caseId === "coach-valid-strict-schema")?.observed
        .schemaValid
    ).toBe(false);
  });
});
