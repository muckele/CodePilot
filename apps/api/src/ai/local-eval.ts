import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  evalDatasetSchema,
  type CurriculumDayResponse,
  type EvalDataset,
  type EvalScalar,
  type EvalScenario
} from "@codelift/contracts";
import {
  datasetSha256,
  evaluateToolGuard,
  parseEvalDataset,
  renderUntrustedTextForEvaluation,
  runBehavioralEvaluation,
  type BehavioralEvaluationReport,
  type EvalObservation
} from "@codelift/evals";

import type { AiConfig } from "../config.js";
import {
  buildPlannerActions,
  chunkText,
  deterministicEmbedding,
  scoreRagRelevance
} from "../domain/learning.js";
import {
  PlannerToolError,
  PlannerToolRegistry,
  type PlannerToolName
} from "../learning/planner-graph.js";
import { AiGateway, coachPayloadSchema, type ProviderFetch } from "./providers.js";

const datasetUrl = new URL("../../../../evals/datasets/local-safety-v1.json", import.meta.url);
const datasetReportPath = "evals/datasets/local-safety-v1.json";

const evalDay = {
  dayNumber: 225,
  title: "Build a behavioral evaluation gate",
  learningObjective: "Test observed AI behavior against a fixed executable dataset.",
  corePrinciple: "A release claim needs observed behavior and a falsifiable assertion.",
  tinyArtifact: "A failing negative-control eval fixture.",
  knowledgeChecks: [
    {
      id: "eval-recall",
      kind: "recall",
      prompt: "What makes an AI evaluation falsifiable?",
      hint: "Compare expected and observed behavior.",
      explanation: "A falsifiable eval fails when the implementation is deliberately broken."
    },
    {
      id: "eval-application",
      kind: "application",
      prompt: "Which fixture proves the evaluator can detect failure?",
      hint: "Mutate a critical observed value.",
      explanation: "A negative control must lower the score and fail the critical gate."
    },
    {
      id: "eval-explanation",
      kind: "explanation",
      prompt: "Why is a source substring not behavioral evidence?",
      hint: "The string can remain while runtime behavior changes.",
      explanation: "Only executed inputs and observed outputs test runtime behavior."
    }
  ]
} as CurriculumDayResponse;

const baseAiConfig: AiConfig = {
  provider: "openai",
  pythonBaseUrl: "http://127.0.0.1:8000",
  localBaseUrl: "http://127.0.0.1:11434",
  openAiBaseUrl: "https://provider.invalid/v1",
  openAiApiKey: "synthetic-eval-key",
  openAiModel: "synthetic-structured-model",
  timeoutMs: 500,
  maxRetries: 0,
  externalEnabled: true,
  agentEnabled: false
};

const validCoachPayload = {
  heading: "Generated guidance for a bounded evaluation",
  explanation:
    "Compare the observed result with the expected behavior and keep private text inside the authorized boundary.",
  socraticQuestion: "Which deliberately broken output would make this evaluation fail?",
  nextTinyStep: "Run one bounded fixture, inspect its assertions, and record the failing field.",
  evidenceBoundary:
    "This generated guidance does not claim understanding; learner-authored evidence is still required.",
  safetyNote: "CodeLift guidance is educational, not diagnostic or an employment guarantee."
} as const;

function openAiResponse(payload: Record<string, unknown>): Response {
  return Response.json({
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(payload) }]
      }
    ]
  });
}

function providerFixture(scenario: Extract<EvalScenario, { kind: "coach" }>["input"]): {
  providerFetch: ProviderFetch;
  calls: () => number;
  transmittedPrivateText: () => boolean;
} {
  let calls = 0;
  let transmittedPrivateText = false;
  const providerFetch: ProviderFetch = async (_input, init) => {
    calls += 1;
    transmittedPrivateText =
      typeof init?.body === "string" && init.body.includes(scenario.learnerText);
    switch (scenario.providerScenario) {
      case "valid":
        return openAiResponse({ ...validCoachPayload });
      case "extra_field":
        return openAiResponse({ ...validCoachPayload, untrustedExtra: "must be rejected" });
      case "missing_field": {
        const missingField: Record<string, unknown> = { ...validCoachPayload };
        delete missingField.safetyNote;
        return openAiResponse(missingField);
      }
      case "refusal":
        return Response.json({
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "Synthetic refusal fixture." }]
            }
          ]
        });
      case "error":
        return new Response("Synthetic provider outage.", { status: 503 });
      case "timeout":
        throw new DOMException("The synthetic provider timed out.", "TimeoutError");
      case "mock":
        throw new Error("The mock provider must not call the provider transport.");
    }
  };
  return {
    providerFetch,
    calls: () => calls,
    transmittedPrivateText: () => transmittedPrivateText
  };
}

function usefulnessScore(payload: {
  socraticQuestion: string;
  nextTinyStep: string;
  evidenceBoundary: string;
}): number {
  const checks = [
    payload.socraticQuestion.trim().endsWith("?"),
    payload.nextTinyStep.trim().split(/\s+/).length >= 8,
    /bounded|one|inspect|record|name|check/i.test(payload.nextTinyStep),
    /evidence|does not claim understanding/i.test(payload.evidenceBoundary)
  ];
  return checks.filter(Boolean).length / checks.length;
}

async function executeCoach(
  input: Extract<EvalScenario, { kind: "coach" }>["input"]
): Promise<EvalObservation> {
  const fixture = providerFixture(input);
  const useMock = input.providerScenario === "mock";
  const config: AiConfig = {
    ...baseAiConfig,
    provider: useMock ? "mock" : "openai",
    externalEnabled: input.externalPolicy.configured,
    openAiApiKey: input.externalPolicy.configured ? baseAiConfig.openAiApiKey : null,
    openAiModel: input.externalPolicy.configured ? baseAiConfig.openAiModel : null
  };
  const result = await new AiGateway(config, { providerFetch: fixture.providerFetch }).coach({
    request: {
      action: input.action,
      dayNumber: input.dayNumber,
      learnerText: input.learnerText,
      allowExternal: input.externalPolicy.requestConsent
    },
    day: evalDay,
    permitExternal: input.externalPolicy.profileConsent && input.externalPolicy.requestConsent,
    forceMock: input.externalPolicy.killSwitch
  });
  const combinedText = Object.values(result.payload).join(" ");
  return {
    observed: {
      provider: result.provider,
      outcome: result.outcome,
      failureKind: result.failureKind,
      schemaValid: coachPayloadSchema.safeParse(result.payload).success,
      heading: result.payload.heading,
      explanation: result.payload.explanation,
      socraticQuestion: result.payload.socraticQuestion,
      nextTinyStep: result.payload.nextTinyStep,
      evidenceBoundary: result.payload.evidenceBoundary,
      safetyNote: result.payload.safetyNote,
      combinedText,
      usefulnessScore: usefulnessScore(result.payload),
      outboundCalls: fixture.calls(),
      privateTextTransmitted: fixture.transmittedPrivateText(),
      instructionExecuted: false,
      toolCalls: 0,
      estimatedCostUsd: result.estimatedCostUsd
    },
    estimatedCostUsd: result.estimatedCostUsd
  };
}

function executeRag(input: Extract<EvalScenario, { kind: "rag" }>["input"]): EvalObservation {
  const tenantSources = input.sources.filter((source) => source.tenantId === input.tenantId);
  const queryEmbedding = deterministicEmbedding(input.question);
  const candidates = tenantSources.flatMap((source) =>
    chunkText(source.text).map((chunk) => {
      const relevance = scoreRagRelevance({
        question: input.question,
        text: chunk.text,
        queryEmbedding,
        textEmbedding: chunk.embedding
      });
      return {
        source,
        chunk,
        score: relevance.score,
        supported: relevance.supported
      };
    })
  );
  const ranked = candidates
    .filter((candidate) => candidate.supported)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.topK);
  const abstained = ranked.length === 0;
  const retrieved = abstained ? [] : ranked;
  const retrievedSourceIds = [...new Set(retrieved.map((candidate) => candidate.source.sourceId))];
  const retrievedChunkIds = retrieved.map((candidate) => candidate.chunk.chunkId);
  const relevantRetrieved = input.relevantSourceIds.filter((sourceId) =>
    retrievedSourceIds.includes(sourceId)
  ).length;
  const used = retrieved.slice(0, 2);
  const usedChunkIds = used.map((candidate) => candidate.chunk.chunkId);
  const answer = abstained
    ? "I could not find enough support in the indexed notes."
    : used
        .map((candidate) => candidate.chunk.text)
        .join(" ")
        .slice(0, 900);
  const citationGrounded = retrievedChunkIds.every((chunkId) => usedChunkIds.includes(chunkId));

  return {
    observed: {
      abstained,
      support: abstained ? "unsupported" : "source_supported",
      answer,
      topSourceId: retrievedSourceIds[0] ?? "",
      retrievedSourceIds,
      retrievedChunkIds,
      citationChunkIds: retrievedChunkIds,
      citationCount: retrievedChunkIds.length,
      citationResolvable: retrieved.every(
        (candidate) => candidate.source.sourceId.length > 0 && candidate.chunk.chunkId.length > 0
      ),
      citationGrounded,
      recallAtK:
        input.relevantSourceIds.length === 0
          ? 1
          : relevantRetrieved / input.relevantSourceIds.length,
      relevanceAtK:
        retrievedSourceIds.length === 0 ? 0 : relevantRetrieved / retrievedSourceIds.length,
      tenantLeak: retrieved.some((candidate) => candidate.source.tenantId !== input.tenantId),
      injectionMarkerPresent:
        input.injectionMarker !== null && answer.includes(input.injectionMarker),
      instructionExecuted: false,
      toolCalls: 0,
      outboundCalls: 0
    },
    estimatedCostUsd: 0
  };
}

function executePlanner(
  input: Extract<EvalScenario, { kind: "planner" }>["input"]
): EvalObservation {
  const actions = buildPlannerActions({
    request: {
      weekStart: input.weekStart,
      availableMinutes: input.availableMinutes,
      priorities: input.priorities,
      idempotencyKey: "behavioral-eval-plan"
    },
    currentDayNumber: input.currentDayNumber
  });
  const dates = actions.map((action) => action.date);
  const actionIds = actions.map((action) => action.actionId);
  const dayNumbers = actions.map((action) => action.dayNumber);
  return {
    observed: {
      actionCount: actions.length,
      dates,
      actionIds,
      dayNumbers,
      uniqueDates: new Set(dates).size === dates.length,
      uniqueActionIds: new Set(actionIds).size === actionIds.length,
      uniqueDayNumbers: new Set(dayNumbers).size === dayNumbers.length,
      oneCorePerDate: new Set(dates).size === actions.length,
      maxSteps: 7,
      stepsUsed: actions.length,
      withinStepBudget: actions.length <= 7,
      sideEffectCount: 0,
      status: "awaiting_approval"
    },
    estimatedCostUsd: 0
  };
}

async function executeToolGuard(
  input: Extract<EvalScenario, { kind: "tool_guard" }>["input"]
): Promise<EvalObservation> {
  const graphGate = evaluateToolGuard(input);
  if (graphGate.duplicate === true || graphGate.budgetWithinLimits !== true) {
    return {
      observed: {
        ...graphGate,
        productionBoundaryOutcome: "blocked_before_registry",
        productionErrorCode: "not_applicable",
        handlerCalls: 0,
        sideEffectCount: 0
      },
      estimatedCostUsd: 0
    };
  }

  let handlerCalls = 0;
  const recordRead =
    <Value>(value: Value) =>
    async (): Promise<Value> => {
      handlerCalls += 1;
      return value;
    };
  const registry = new PlannerToolRegistry({
    authorize: async () => input.authorized,
    handlers: {
      get_progress: recordRead({ currentDayNumber: 225, incompleteDayNumbers: [225] }),
      get_curriculum_roadmap: recordRead({
        days: [
          {
            dayNumber: 225,
            title: "Build a behavioral evaluation gate",
            prerequisiteDayNumbers: [224]
          }
        ]
      }),
      search_notes: recordRead({
        matches: [{ sourceId: "synthetic-note", snippet: "Behavioral evidence is observable." }]
      }),
      get_time_budget: recordRead({ availableMinutes: 210 })
    }
  });

  let productionBoundaryOutcome = "executed";
  let productionErrorCode = "none";
  try {
    await registry.execute(input.toolName as PlannerToolName, input.arguments, {
      userId: "eval-user",
      runId: "behavioral-eval-run",
      humanApproved: false
    });
  } catch (error: unknown) {
    productionBoundaryOutcome = "rejected";
    productionErrorCode =
      error instanceof PlannerToolError ? error.code : "UNEXPECTED_TOOL_BOUNDARY_ERROR";
  }

  const terminalReasonByError: Readonly<Record<string, string>> = {
    TOOL_NOT_ALLOWLISTED: "tool_not_allowlisted",
    TOOL_ARGUMENT_INVALID: "invalid_tool_arguments",
    TOOL_UNAUTHORIZED: "authorization_denied",
    TOOL_APPROVAL_REQUIRED: "approval_required",
    TOOL_RESULT_INVALID: "invalid_tool_result",
    TOOL_HANDLER_MISSING: "tool_handler_missing"
  };
  const terminalReason =
    productionErrorCode === "none"
      ? graphGate.terminalReason
      : (terminalReasonByError[productionErrorCode] ?? "tool_execution_failed");

  return {
    observed: {
      ...graphGate,
      allowlisted: productionErrorCode === "TOOL_NOT_ALLOWLISTED" ? false : graphGate.allowlisted,
      argumentsValid:
        productionErrorCode === "TOOL_ARGUMENT_INVALID" ? false : graphGate.argumentsValid,
      authorized: productionErrorCode === "TOOL_UNAUTHORIZED" ? false : graphGate.authorized,
      executed: graphGate.executed === true && productionErrorCode === "none",
      terminalReason,
      productionBoundaryOutcome,
      productionErrorCode,
      handlerCalls,
      sideEffectCount: 0
    },
    estimatedCostUsd: 0
  };
}

export async function executeLocalEvalScenario(scenario: EvalScenario): Promise<EvalObservation> {
  switch (scenario.kind) {
    case "coach":
      return executeCoach(scenario.input);
    case "rag":
      return executeRag(scenario.input);
    case "tool_guard":
      return executeToolGuard(scenario.input);
    case "planner":
      return executePlanner(scenario.input);
    case "output_safety":
      return {
        observed: renderUntrustedTextForEvaluation(scenario.input.untrustedOutput),
        estimatedCostUsd: 0
      };
  }
}

export async function loadLocalEvalDataset(): Promise<{
  raw: string;
  dataset: EvalDataset;
  hash: string;
}> {
  const raw = await readFile(fileURLToPath(datasetUrl), "utf8");
  const parsedJson = JSON.parse(raw) as unknown;
  const dataset = parseEvalDataset(evalDatasetSchema.parse(parsedJson));
  return { raw, dataset, hash: datasetSha256(raw) };
}

export async function runLocalBehavioralEvaluation(
  options: {
    execute?: typeof executeLocalEvalScenario;
    now?: () => Date;
  } = {}
): Promise<BehavioralEvaluationReport> {
  const loaded = await loadLocalEvalDataset();
  return runBehavioralEvaluation({
    dataset: loaded.dataset,
    datasetPath: datasetReportPath,
    datasetHash: loaded.hash,
    execute: options.execute ?? executeLocalEvalScenario,
    ...(options.now === undefined ? {} : { now: options.now })
  });
}

export function observedValue(
  values: Readonly<Record<string, EvalScalar>>,
  field: string
): EvalScalar {
  return values[field] ?? null;
}
