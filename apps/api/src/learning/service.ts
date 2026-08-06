import { createHash } from "node:crypto";

import {
  adminFeatureFlagSchema,
  adminMockScenarioResponseSchema,
  adminOverviewResponseSchema,
  adminResetDemoDataResponseSchema,
  catchUpPlanResponseSchema,
  coachResponseSchema,
  dayTaskPlanSchema,
  dashboardResponseSchema,
  errorMuseumEntrySchema,
  errorMuseumResponseSchema,
  evalRunSchema,
  jobApplicationSchema,
  jobApplicationsResponseSchema,
  localEvalResponseSchema,
  noteResponseSchema,
  notesResponseSchema,
  operationsResponseSchema,
  periodicReflectionSchema,
  periodicReflectionsResponseSchema,
  plannerRunSchema,
  portfolioArtifactSchema,
  portfolioResponseSchema,
  ragSearchResponseSchema,
  reviewItemSchema,
  reviewsResponseSchema,
  roadmapResponseSchema,
  skillsResponseSchema,
  type AdminFeatureFlag,
  type AdminFeatureFlagUpdateRequest,
  type AdminMockScenario,
  type AdminMockScenarioRequest,
  type AdminMockScenarioResponse,
  type AdminOverviewResponse,
  type AdminResetDemoDataResponse,
  type CatchUpPlanRequest,
  type CatchUpPlanResponse,
  type CoachRequest,
  type CoachResponse,
  type CreateJobApplicationRequest,
  type DayTaskPlan,
  type DashboardResponse,
  type ErrorMuseumEntry,
  type EvalRun,
  type JobApplication,
  type NoteSource,
  type OperationsResponse,
  type PlannerDecisionRequest,
  type PlannerRequest,
  type PlannerRun,
  type PortfolioArtifact,
  type PortfolioResponse,
  type RagSearchRequest,
  type RagSearchResponse,
  type ReviewsResponse,
  type RoadmapResponse,
  type SkillsResponse,
  type SubmitReviewRequest,
  type UpdateDayTaskPlanRequest,
  type UpdatePeriodicReflectionRequest,
  type UpdatePortfolioArtifactRequest,
  type UpsertErrorMuseumRequest,
  type UpsertNoteRequest
} from "@codelift/contracts";
import { Types } from "mongoose";

import { AiGateway } from "../ai/providers.js";
import { runLocalBehavioralEvaluation } from "../ai/local-eval.js";
import type { AiConfig } from "../config.js";
import type { CurriculumRuntime } from "../curriculum/runtime.js";
import {
  buildCatchUpPlan,
  calculateStreaks,
  chunkText,
  deterministicEmbedding,
  differenceInLocalDays,
  reviewDueDates,
  scoreRagRelevance,
  skillStateForCompletion,
  xpForCompletion
} from "../domain/learning.js";
import { HttpProblem } from "../http/problem.js";
import type { CodeLiftModels } from "../persistence/models.js";
import type {
  AgentRunRecord,
  ErrorMuseumEntryRecord,
  EvalRunRecord,
  IndexedSourceRecord,
  PortfolioArtifactRecord,
  ReviewItemRecord
} from "../persistence/product-models.js";
import {
  applyPlannerHumanDecision,
  createBoundedAgentProposal,
  createDeterministicPlannerProposal,
  createPlannerGraphState,
  parsePlannerGraphState,
  PlannerToolRegistry,
  runPlannerGraph,
  type PlannerGraphDependencies,
  type PlannerGraphState
} from "./planner-graph.js";

const completedStatuses = ["core_completed", "recovery_completed"] as const;
const advancedStatuses = [...completedStatuses, "intentionally_skipped"] as const;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11_000
  );
}

async function repeatSafeUpsert(
  upsert: () => PromiseLike<unknown>,
  replayWithoutUpsert: () => PromiseLike<unknown>
): Promise<void> {
  try {
    await upsert();
  } catch (error: unknown) {
    if (!isDuplicateKeyError(error)) throw error;
    await replayWithoutUpsert();
  }
}

const milestoneCatalog = [
  [
    "Developer Reset",
    "Web foundations and deliberate practice",
    "Learning home and coding dashboard"
  ],
  ["JavaScript Fluency", "Problem solving and browser applications", "Coding Dashboard v1"],
  ["MERN Entry", "TypeScript, React, Node, and vertical slices", "Typed MERN accountability MVP"],
  [
    "Production MERN",
    "MongoDB, auth, progress, testing, and release",
    "Secure authenticated product"
  ],
  [
    "Systems Foundations",
    "SQL, containers, architecture, and Python transfer",
    "SQL lab and architecture case study"
  ],
  [
    "Python & ML",
    "FastAPI, pandas, scikit-learn, and model cards",
    "Python service and ML baseline"
  ],
  [
    "Neural & LLM",
    "PyTorch, embeddings, transformers, and structured output",
    "Eval-baselined AI Coach"
  ],
  [
    "AI Application Patterns",
    "Tool use, privacy, and reliable provider boundaries",
    "Structured AI feature release"
  ],
  [
    "Grounded AI",
    "RAG, hybrid retrieval, observability, and AI security",
    "Cited notes search and red-team report"
  ],
  [
    "Evaluation & Delivery",
    "Local evals, monitoring, cost, and deployment",
    "AI operations dashboard"
  ],
  [
    "Bounded Agents",
    "Approval gates, MCP, and deterministic fallbacks",
    "Safe study planner and MCP demo"
  ],
  [
    "Capstone & Career",
    "Architecture, release, portfolio, and interviews",
    "Production capstone story"
  ]
] as const;

const artifactCatalog = [
  ["coding-dashboard-v1", "Coding Dashboard v1"],
  ["typed-mern-mvp", "Typed MERN accountability MVP"],
  ["secure-product-release", "Secure authenticated product release"],
  ["sql-lab", "PostgreSQL learning-data lab"],
  ["python-analysis", "Python analysis package"],
  ["fastapi-service", "FastAPI service"],
  ["ml-model-card", "ML notebook and model card"],
  ["structured-ai-coach", "Structured AI Coach"],
  ["cited-rag", "RAG notes search with citations"],
  ["ai-ops-dashboard", "Eval and observability dashboard"],
  ["safe-planner", "Safe study-planning workflow"],
  ["mcp-demo", "Read-only MCP demo"],
  ["capstone-release", "Capstone architecture and release"]
] as const;

const adminMockScenarioCatalog = [
  {
    key: "success",
    label: "Structured success",
    description: "Returns a deterministic schema-conformant coaching fixture.",
    expectedOutcome: "success"
  },
  {
    key: "timeout",
    label: "Provider timeout",
    description: "Shows bounded timeout handling without waiting on a provider.",
    expectedOutcome: "timeout"
  },
  {
    key: "refusal",
    label: "Provider refusal",
    description: "Shows an explicit refusal without disguising it as guidance.",
    expectedOutcome: "refused"
  },
  {
    key: "schema_error",
    label: "Schema rejection",
    description: "Rejects malformed structured output before it reaches the learner UI.",
    expectedOutcome: "rejected"
  },
  {
    key: "rag_no_evidence",
    label: "RAG no evidence",
    description: "Abstains when no indexed chunk meets the support threshold.",
    expectedOutcome: "abstained"
  },
  {
    key: "agent_awaiting_approval",
    label: "Agent awaiting approval",
    description: "Stops a deterministic proposal before any side effect.",
    expectedOutcome: "awaiting_approval"
  }
] as const;

const adminVisualStates = [
  ["new-user", "New user"],
  ["active-day", "Active day"],
  ["core-complete", "Core complete"],
  ["recovery-complete", "Recovery complete"],
  ["missed-return", "Missed return"],
  ["grace-token", "Grace token"],
  ["milestone", "Milestone"],
  ["empty", "Empty"],
  ["loading", "Loading"],
  ["api-error", "API error"],
  ["ai-timeout", "AI timeout"],
  ["ai-refusal", "AI refusal"],
  ["ai-schema-error", "AI schema error"],
  ["rag-no-evidence", "RAG no-evidence"],
  ["agent-awaiting-approval", "Agent awaiting approval"],
  ["reduced-motion", "Reduced motion"],
  ["narrow-mobile", "Narrow mobile"],
  ["dark-theme", "Dark theme"]
] as const;

const mockScenarioResults: Record<
  AdminMockScenario,
  Omit<AdminMockScenarioResponse, "scenario">
> = {
  success: {
    outcome: "success",
    generated: false,
    title: "Deterministic structured response accepted",
    detail: "The fixture matched the strict coaching contract. No provider call was made.",
    trace: ["load_fixture", "validate_schema", "accept_mock_output"]
  },
  timeout: {
    outcome: "timeout",
    generated: false,
    title: "Provider deadline reached",
    detail: "The bounded fixture stopped at the configured deadline and retained local guidance.",
    trace: ["start_mock_request", "reach_deadline", "use_deterministic_fallback"]
  },
  refusal: {
    outcome: "refused",
    generated: false,
    title: "Provider refusal preserved",
    detail: "The refusal remained explicit and no answer was fabricated.",
    trace: ["load_refusal_fixture", "classify_refusal", "render_refusal_state"]
  },
  schema_error: {
    outcome: "rejected",
    generated: false,
    title: "Malformed provider output rejected",
    detail: "A missing required field failed runtime parsing before presentation.",
    trace: ["load_malformed_fixture", "validate_schema", "reject_unverified_output"]
  },
  rag_no_evidence: {
    outcome: "abstained",
    generated: false,
    title: "No source-supported answer",
    detail: "No synthetic chunk met the support threshold, so the fixture returned zero citations.",
    trace: ["retrieve_synthetic_chunks", "apply_support_threshold", "abstain"]
  },
  agent_awaiting_approval: {
    outcome: "awaiting_approval",
    generated: false,
    title: "Proposal stopped for human review",
    detail:
      "The deterministic agent fixture produced read-only actions and stopped before effects.",
    trace: ["build_read_only_proposal", "validate_budget", "await_human_approval"]
  }
};

function problem(slug: string, title: string, status: number, detail: string): HttpProblem {
  return new HttpProblem({
    type: `https://codelift.ai/problems/${slug}`,
    title,
    status,
    detail
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function localDateInTimezone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year") ?? ""}-${values.get("month") ?? ""}-${values.get("day") ?? ""}`;
}

function iso(value: Date): string {
  return value.toISOString();
}

function portfolioValue(
  document: PortfolioArtifactRecord & { _id: Types.ObjectId }
): PortfolioArtifact {
  return portfolioArtifactSchema.parse({
    id: document._id.toString(),
    artifactKey: document.artifactKey,
    title: document.title,
    monthNumber: document.monthNumber,
    status: document.status,
    repositoryUrl: document.repositoryUrl,
    demoUrl: document.demoUrl,
    screenshotUrls: document.screenshotUrls,
    skillsProven: document.skillsProven,
    testsAndEvals: document.testsAndEvals,
    tradeoffs: document.tradeoffs,
    limitations: document.limitations,
    interviewQuestions: document.interviewQuestions,
    evidenceLinks: document.evidenceLinks,
    updatedAt: iso(document.updatedAt)
  });
}

function reviewValue(document: ReviewItemRecord & { _id: Types.ObjectId }) {
  return reviewItemSchema.parse({
    id: document._id.toString(),
    sourceDayNumber: document.sourceDayNumber,
    intervalDays: document.intervalDays,
    dueDate: document.dueDate,
    prompt: document.prompt,
    question: document.question,
    status: document.status,
    closedNote: document.closedNote,
    confidenceBefore: document.confidenceBefore,
    confidenceAfter: document.confidenceAfter,
    answer: document.answer,
    completedAt: document.completedAt === null ? null : iso(document.completedAt)
  });
}

function errorValue(document: ErrorMuseumEntryRecord & { _id: Types.ObjectId }): ErrorMuseumEntry {
  return errorMuseumEntrySchema.parse({
    id: document._id.toString(),
    title: document.title,
    dayNumber: document.dayNumber,
    bug: document.bug,
    hypothesis: document.hypothesis,
    evidence: document.evidence,
    fix: document.fix,
    test: document.test,
    lesson: document.lesson,
    tags: document.tags,
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt)
  });
}

function noteValue(document: IndexedSourceRecord & { _id: Types.ObjectId }): NoteSource {
  return {
    id: document._id.toString(),
    title: document.title,
    dayNumber: document.dayNumber,
    content: document.content,
    contentHash: document.contentHash,
    version: document.version,
    chunkCount: document.chunks.length,
    updatedAt: iso(document.updatedAt)
  };
}

function taskPlanValue(
  dayNumber: number,
  document: {
    status: string;
    estimateMinutes?: number;
    actualMinutes?: number;
    timerSeconds?: number;
    timerState?: string;
    rescheduledFor?: string | null;
    subtasks?: {
      id: string;
      title: string;
      estimateMinutes: number;
      actualMinutes: number;
      completed: boolean;
    }[];
    updatedAt: Date;
  } | null
): DayTaskPlan {
  const subtasks = document?.subtasks ?? [];
  return dayTaskPlanSchema.parse({
    dayNumber,
    status: document?.status ?? "not_started",
    estimateMinutes: document?.estimateMinutes ?? 30,
    actualMinutes: document?.actualMinutes ?? 0,
    timerSeconds: document?.timerSeconds ?? 0,
    timerState: document?.timerState ?? "paused",
    rescheduledFor: document?.rescheduledFor ?? null,
    subtasks,
    nextSubtask: subtasks.find((subtask) => !subtask.completed) ?? null,
    updatedAt: document === null ? null : iso(document.updatedAt)
  });
}

function jobValue(document: {
  _id: Types.ObjectId;
  company: string;
  role: string;
  status: string;
  evidenceLinks: string[];
  nextAction: string;
  createdAt: Date;
  updatedAt: Date;
}): JobApplication {
  return jobApplicationSchema.parse({
    id: document._id.toString(),
    company: document.company,
    role: document.role,
    status: document.status,
    evidenceLinks: document.evidenceLinks,
    nextAction: document.nextAction,
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt)
  });
}

function plannerRecordStatus(graphState: PlannerGraphState): AgentRunRecord["status"] {
  if (graphState.status === "awaiting_approval") return "awaiting_approval";
  if (
    graphState.terminalReason === "approved_by_human" ||
    graphState.terminalReason === "approved_proposal_only"
  ) {
    return "approved";
  }
  if (graphState.terminalReason === "revision_requested") return "revision_requested";
  return "cancelled";
}

function plannerRecordTerminalReason(
  graphState: PlannerGraphState
): AgentRunRecord["terminalReason"] {
  if (graphState.terminalReason === "awaiting_human_approval") {
    return "awaiting_human_approval";
  }
  if (
    graphState.terminalReason === "approved_by_human" ||
    graphState.terminalReason === "approved_proposal_only"
  ) {
    return "approved_by_human";
  }
  if (graphState.terminalReason === "revision_requested") return "revision_requested";
  if (
    graphState.terminalReason === "budget_exhausted" ||
    graphState.terminalReason === "max_attempts_exhausted"
  ) {
    return "budget_exhausted";
  }
  return "cancelled";
}

function plannerTrace(graphState: PlannerGraphState): string[] {
  return graphState.trace
    .filter((event) => event.kind !== "node_completed" && event.kind !== "tool_completed")
    .slice(-24)
    .map((event) => `[${event.sequence}:${event.node}:${event.kind}] ${event.detail}`);
}

function plannerValue(document: AgentRunRecord & { _id: Types.ObjectId }): PlannerRun {
  return plannerRunSchema.parse({
    id: document._id.toString(),
    mode: document.mode,
    approvalBehavior: document.graphState.approvalBehavior,
    status: document.status,
    actions: document.actions.map((action) => ({
      actionId: action.actionId,
      date: action.date,
      dayNumber: action.dayNumber,
      mode: action.mode,
      minutes: action.minutes,
      rationale: action.rationale
    })),
    budget: {
      maxSteps: document.budget.maxSteps,
      stepsUsed: document.budget.stepsUsed,
      maxTokens: document.budget.maxTokens,
      tokensUsed: document.budget.tokensUsed,
      maxCostUsd: document.budget.maxCostUsd,
      estimatedCostUsd: document.budget.estimatedCostUsd,
      maxWallTimeMs: document.budget.maxWallTimeMs,
      wallTimeMs: document.budget.wallTimeMs
    },
    terminalReason: document.terminalReason,
    trace: [...document.trace],
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt)
  });
}

function traceValue(document: {
  _id: Types.ObjectId;
  feature: string;
  provider: string;
  outcome: string;
  promptVersion: string;
  latencyMs: number;
  estimatedCostUsd: number;
  inputHash: string;
  citationCount: number;
  createdAt: Date;
}) {
  return {
    id: document._id.toString(),
    feature: document.feature,
    provider: document.provider,
    outcome: document.outcome,
    promptVersion: document.promptVersion,
    latencyMs: document.latencyMs,
    estimatedCostUsd: document.estimatedCostUsd,
    inputHash: document.inputHash,
    citationCount: document.citationCount,
    createdAt: iso(document.createdAt)
  };
}

function evalValue(document: EvalRunRecord & { _id: Types.ObjectId }): EvalRun {
  if (typeof document.datasetHash !== "string" || document.datasetHash.length !== 64) {
    const legacyCases = Array.isArray(document.cases) ? document.cases : [];
    return evalRunSchema.parse({
      id: document._id.toString(),
      datasetVersion: document.datasetVersion || "legacy-static-eval",
      datasetHash: "0".repeat(64),
      evaluatorVersion: "legacy-non-behavioral",
      providerConfig: {
        provider: "legacy-static-source-scan",
        model: "none",
        promptVersion: "unknown",
        sampling: "none",
        externalCallsAllowed: false,
        fixtureProfile: "legacy-no-observed-output",
        datasetHashAlgorithm: "sha256",
        redactionPolicy: "synthetic-fixtures-only"
      },
      passed: false,
      score: 0,
      passingScore: 1,
      criticalFailures: ["legacy-non-behavioral-run"],
      negativeControlsPassed: false,
      durationMs: 0,
      estimatedCostUsd: 0,
      cases: (legacyCases.length === 0
        ? [{ caseId: "legacy-run", category: "legacy" }]
        : legacyCases
      ).map((entry) => ({
        caseId: entry.caseId,
        category: entry.category ?? "legacy",
        critical: true,
        scenarioKind: "output_safety",
        input: { legacyCaseId: entry.caseId },
        expectedBehavior:
          "A release evaluation must execute an input and persist observed behavior.",
        expectedAssertions: [
          {
            assertionId: "behavior-observed",
            field: "behaviorObserved",
            operator: "equals",
            expected: true
          }
        ],
        observed: { behaviorObserved: false },
        assertions: [
          {
            assertionId: "behavior-observed",
            field: "behaviorObserved",
            operator: "equals",
            expected: true,
            actual: false,
            passed: false,
            detail: "Legacy source-scan runs did not persist an executed input or observed output."
          }
        ],
        passed: false,
        detail: "Legacy non-behavioral result is not release evidence.",
        latencyMs: 0,
        estimatedCostUsd: 0
      })),
      createdAt: iso(document.createdAt)
    });
  }
  return evalRunSchema.parse({
    id: document._id.toString(),
    datasetVersion: document.datasetVersion,
    datasetHash: document.datasetHash,
    evaluatorVersion: document.evaluatorVersion,
    providerConfig: {
      provider: document.providerConfig.provider,
      model: document.providerConfig.model,
      promptVersion: document.providerConfig.promptVersion,
      sampling: document.providerConfig.sampling,
      externalCallsAllowed: document.providerConfig.externalCallsAllowed,
      fixtureProfile: document.providerConfig.fixtureProfile,
      datasetHashAlgorithm: document.providerConfig.datasetHashAlgorithm,
      redactionPolicy: document.providerConfig.redactionPolicy
    },
    passed: document.passed,
    score: document.score,
    passingScore: document.passingScore,
    criticalFailures: [...document.criticalFailures],
    negativeControlsPassed: document.negativeControlsPassed,
    durationMs: document.durationMs,
    estimatedCostUsd: document.estimatedCostUsd,
    cases: document.cases.map((entry) => ({
      caseId: entry.caseId,
      category: entry.category,
      critical: entry.critical,
      scenarioKind: entry.scenarioKind,
      input: entry.input,
      expectedBehavior: entry.expectedBehavior,
      expectedAssertions: entry.expectedAssertions.map((assertion) => ({
        assertionId: assertion.assertionId,
        field: assertion.field,
        operator: assertion.operator,
        expected: assertion.expected
      })),
      observed: entry.observed,
      assertions: entry.assertions.map((assertion) => ({
        assertionId: assertion.assertionId,
        field: assertion.field,
        operator: assertion.operator,
        expected: assertion.expected,
        actual: assertion.actual,
        passed: assertion.passed,
        detail: assertion.detail
      })),
      passed: entry.passed,
      detail: entry.detail,
      latencyMs: entry.latencyMs,
      estimatedCostUsd: entry.estimatedCostUsd
    })),
    createdAt: iso(document.createdAt)
  });
}

export class LearningService {
  readonly #models: CodeLiftModels;
  readonly #curriculum: CurriculumRuntime;
  readonly #gateway: AiGateway;
  readonly #aiConfig: AiConfig;
  readonly #now: () => Date;

  constructor(options: {
    models: CodeLiftModels;
    curriculum: CurriculumRuntime;
    aiConfig: AiConfig;
    now?: () => Date;
  }) {
    this.#models = options.models;
    this.#curriculum = options.curriculum;
    this.#aiConfig = options.aiConfig;
    this.#gateway = new AiGateway(options.aiConfig);
    this.#now = options.now ?? (() => new Date());
  }

  async #user(userId: string) {
    const user = await this.#models.User.findOne({ _id: userId });
    if (user === null) {
      throw problem(
        "authentication-required",
        "Authentication required",
        401,
        "Sign in to continue to this private workspace."
      );
    }
    if (user.profile === null) {
      throw problem(
        "onboarding-required",
        "Onboarding required",
        409,
        "Complete onboarding before opening the learning workspace."
      );
    }
    return user;
  }

  #day(dayNumber: number) {
    if (this.#curriculum.status !== "ready") {
      throw problem(
        "curriculum-unavailable",
        "Curriculum unavailable",
        503,
        "The curriculum must pass validation before this feature is available."
      );
    }
    const day = this.#curriculum.getDay(dayNumber);
    if (day === undefined) {
      throw problem(
        "curriculum-day-not-found",
        "Curriculum day not found",
        404,
        "The requested curriculum day does not exist."
      );
    }
    return day;
  }

  async #ensurePortfolio(userId: string): Promise<void> {
    const ownerId = new Types.ObjectId(userId);
    await Promise.all(
      artifactCatalog.map(async ([artifactKey, title], index) => {
        const filter = { userId: ownerId, artifactKey };
        const update = {
          $setOnInsert: {
            userId: ownerId,
            artifactKey,
            title,
            monthNumber: Math.min(12, index + 1),
            status: "not_started" as const,
            repositoryUrl: null,
            demoUrl: null,
            screenshotUrls: [] as string[],
            skillsProven: [] as string[],
            testsAndEvals: [] as string[],
            tradeoffs: [] as string[],
            limitations: [] as string[],
            interviewQuestions: [] as string[],
            evidenceLinks: [] as string[]
          }
        };
        await repeatSafeUpsert(
          () => this.#models.PortfolioArtifact.updateOne(filter, update, { upsert: true }),
          () => this.#models.PortfolioArtifact.updateOne(filter, update, { upsert: false })
        );
      })
    );
  }

  async #ensureDerivedRecords(userId: string): Promise<void> {
    const completions = await this.#models.Progress.find({
      userId,
      status: { $in: completedStatuses }
    }).lean();
    for (const completion of completions) {
      const mode = completion.status === "core_completed" ? "core" : "recovery";
      const day = this.#day(completion.dayNumber);
      const completedDate = (completion.completedAt ?? completion.updatedAt)
        .toISOString()
        .slice(0, 10);
      const completionKey = `completion:${completion.dayNumber}:${mode}`;
      const xpFilter = { userId, idempotencyKey: completionKey };
      const xpUpdate = {
        $setOnInsert: {
          userId,
          dayNumber: completion.dayNumber,
          amount: xpForCompletion(mode),
          reason: mode === "core" ? "Evidence-backed Core mission" : "Explicit Recovery evidence",
          idempotencyKey: completionKey
        }
      };
      await repeatSafeUpsert(
        () => this.#models.XpEvent.updateOne(xpFilter, xpUpdate, { upsert: true }),
        () => this.#models.XpEvent.updateOne(xpFilter, xpUpdate, { upsert: false })
      );
      for (const [index, schedule] of reviewDueDates(completedDate).entries()) {
        const prompt =
          day.retrievalPrompts[index % day.retrievalPrompts.length] ?? day.teachBackPrompt;
        const reviewFilter = {
          userId,
          sourceDayNumber: completion.dayNumber,
          intervalDays: schedule.intervalDays
        };
        const reviewUpdate = {
          $setOnInsert: {
            userId,
            sourceDayNumber: completion.dayNumber,
            intervalDays: schedule.intervalDays,
            dueDate: schedule.dueDate,
            prompt,
            question: `${prompt} Reconstruct the idea without opening the lesson.`,
            status: "due" as const,
            closedNote: true,
            confidenceBefore: null,
            confidenceAfter: null,
            answer: "",
            operationKeys: [] as string[],
            completedAt: null
          }
        };
        await repeatSafeUpsert(
          () => this.#models.ReviewItem.updateOne(reviewFilter, reviewUpdate, { upsert: true }),
          () => this.#models.ReviewItem.updateOne(reviewFilter, reviewUpdate, { upsert: false })
        );
      }
      for (const skill of day.skillTags) {
        const state = skillStateForCompletion(mode, day.portfolioMilestone !== undefined);
        const skillFilter = { userId, evidenceKey: `${completionKey}:${skill}` };
        const skillUpdate = {
          $setOnInsert: {
            userId,
            skill,
            dayNumber: completion.dayNumber,
            mode,
            state,
            evidenceKey: `${completionKey}:${skill}`,
            createdAt: completion.completedAt ?? completion.updatedAt
          }
        };
        await repeatSafeUpsert(
          () => this.#models.SkillEvidence.updateOne(skillFilter, skillUpdate, { upsert: true }),
          () => this.#models.SkillEvidence.updateOne(skillFilter, skillUpdate, { upsert: false })
        );
      }
      if (day.portfolioMilestone !== undefined) {
        const artifact =
          artifactCatalog[Math.max(0, Math.min(artifactCatalog.length - 1, day.monthNumber - 1))];
        if (artifact !== undefined) {
          const artifactFilter = { userId, artifactKey: artifact[0] };
          const artifactUpdate = {
            $setOnInsert: {
              userId,
              artifactKey: artifact[0],
              title: artifact[1],
              monthNumber: day.monthNumber,
              repositoryUrl: null,
              demoUrl: null,
              screenshotUrls: [] as string[],
              testsAndEvals: [] as string[],
              tradeoffs: [] as string[],
              limitations: [] as string[],
              interviewQuestions: [] as string[],
              evidenceLinks: [] as string[]
            },
            $set: { status: "draft" as const },
            $addToSet: { skillsProven: { $each: day.skillTags } }
          };
          await repeatSafeUpsert(
            () =>
              this.#models.PortfolioArtifact.updateOne(artifactFilter, artifactUpdate, {
                upsert: true
              }),
            () =>
              this.#models.PortfolioArtifact.updateOne(artifactFilter, artifactUpdate, {
                upsert: false
              })
          );
        }
      }
    }
    await this.#ensurePortfolio(userId);
    if (completions.length > 0) {
      const achievementFilter = { userId, achievementKey: "first-return" };
      const achievementUpdate = {
        $setOnInsert: {
          userId,
          achievementKey: "first-return",
          evidenceKey: `progress:${completions[0]?.dayNumber ?? 1}`,
          awardedAt: this.#now()
        }
      };
      await repeatSafeUpsert(
        () =>
          this.#models.UserAchievement.updateOne(achievementFilter, achievementUpdate, {
            upsert: true
          }),
        () =>
          this.#models.UserAchievement.updateOne(achievementFilter, achievementUpdate, {
            upsert: false
          })
      );
    }
    if (completions.filter((entry) => entry.status === "core_completed").length >= 10) {
      const achievementFilter = { userId, achievementKey: "ten-core-missions" };
      const achievementUpdate = {
        $setOnInsert: {
          userId,
          achievementKey: "ten-core-missions",
          evidenceKey: "core-count:10",
          awardedAt: this.#now()
        }
      };
      await repeatSafeUpsert(
        () =>
          this.#models.UserAchievement.updateOne(achievementFilter, achievementUpdate, {
            upsert: true
          }),
        () =>
          this.#models.UserAchievement.updateOne(achievementFilter, achievementUpdate, {
            upsert: false
          })
      );
    }
  }

  async #workspaceState(userId: string) {
    const user = await this.#user(userId);
    await this.#ensureDerivedRecords(userId);
    const profile = user.profile;
    if (profile === null) throw new Error("Onboarded user unexpectedly lacked a profile.");
    const [progress, xpEvents] = await Promise.all([
      this.#models.Progress.find({ userId }).sort({ dayNumber: 1 }).lean(),
      this.#models.XpEvent.find({ userId }).lean()
    ]);
    const byDay = new Map(progress.map((entry) => [entry.dayNumber, entry]));
    let currentDayNumber = 365;
    for (let dayNumber = 1; dayNumber <= 365; dayNumber += 1) {
      const status = byDay.get(dayNumber)?.status ?? "not_started";
      if (!(advancedStatuses as readonly string[]).includes(status)) {
        currentDayNumber = dayNumber;
        break;
      }
    }
    const now = this.#now();
    const today = localDateInTimezone(now, profile.timezone);
    const completed = progress.filter((entry) =>
      (completedStatuses as readonly string[]).includes(entry.status)
    );
    const returnDates = completed.map((entry) =>
      localDateInTimezone(entry.completedAt ?? entry.updatedAt, profile.timezone)
    );
    const { graceTokensRemaining, ...streaks } = calculateStreaks(returnDates, today, 1);
    const summary = {
      currentDayNumber,
      coreCompletions: completed.filter((entry) => entry.status === "core_completed").length,
      recoveryWins: completed.filter((entry) => entry.status === "recovery_completed").length,
      intentionalSkips: progress.filter((entry) => entry.status === "intentionally_skipped").length,
      totalReturns: new Set(returnDates).size,
      ...streaks,
      xp: xpEvents.reduce((total, event) => total + event.amount, 0),
      graceTokensAvailable: graceTokensRemaining
    };
    const journey = Array.from({ length: 365 }, (_, index) => {
      const dayNumber = index + 1;
      const day = this.#day(dayNumber);
      const item = byDay.get(dayNumber);
      return {
        dayNumber,
        monthNumber: day.monthNumber,
        status: item?.status ?? "not_started",
        selectedMode: item?.selectedMode ?? null
      };
    });
    return {
      user,
      profile,
      progress,
      byDay,
      currentDayNumber,
      today,
      summary,
      journey
    };
  }

  async dashboard(userId: string): Promise<DashboardResponse> {
    const state = await this.#workspaceState(userId);
    const [reviews, portfolio, recentProgress] = await Promise.all([
      this.#models.ReviewItem.find({
        userId,
        status: "due",
        dueDate: { $lte: state.today }
      })
        .sort({ dueDate: 1, sourceDayNumber: 1 })
        .limit(10)
        .lean(),
      this.#models.PortfolioArtifact.findOne({
        userId,
        monthNumber: this.#day(state.currentDayNumber).monthNumber
      }).lean(),
      this.#models.Progress.find({
        userId,
        "evidence.0": { $exists: true }
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean()
    ]);
    const calendarElapsed = Math.max(
      0,
      differenceInLocalDays(state.today, state.profile.startDate)
    );
    const recentEvidence = recentProgress.flatMap((entry) =>
      [...entry.evidence]
        .reverse()
        .slice(0, 2)
        .map((evidence) => ({
          dayNumber: entry.dayNumber,
          label: evidence.label,
          kind: evidence.kind,
          createdAt: iso(evidence.createdAt)
        }))
    );
    return dashboardResponseSchema.parse({
      generatedAt: iso(this.#now()),
      day: this.#day(state.currentDayNumber),
      summary: state.summary,
      journey: state.journey,
      reviewsDue: reviews.map((review) => reviewValue(review)),
      portfolioFocus: portfolio === null ? null : portfolioValue(portfolio),
      missedCalendarDays: Math.max(
        0,
        calendarElapsed - state.summary.coreCompletions - state.summary.recoveryWins
      ),
      recentEvidence: recentEvidence.slice(0, 10)
    });
  }

  async roadmap(userId: string): Promise<RoadmapResponse> {
    const state = await this.#workspaceState(userId);
    const milestones = milestoneCatalog.map(([title, focus, portfolioEvidence], index) => {
      const monthNumber = index + 1;
      const monthDays = state.journey.filter((day) => day.monthNumber === monthNumber);
      return {
        monthNumber,
        title,
        focus,
        portfolioEvidence,
        completedDays: monthDays.filter((day) =>
          (completedStatuses as readonly string[]).includes(day.status)
        ).length,
        totalDays: monthDays.length
      };
    });
    const preview = Array.from({ length: 7 }, (_, index) =>
      this.#curriculum.status === "ready"
        ? this.#curriculum.getDay(Math.min(365, state.currentDayNumber + index))
        : undefined
    ).filter((day) => day !== undefined);
    return roadmapResponseSchema.parse({
      summary: state.summary,
      milestones,
      days: state.journey,
      sevenDayPreview: preview
    });
  }

  async catchUpPlan(userId: string, request: CatchUpPlanRequest): Promise<CatchUpPlanResponse> {
    const state = await this.#workspaceState(userId);
    const missedDays = Math.max(
      0,
      differenceInLocalDays(state.today, state.profile.startDate) - state.summary.totalReturns
    );
    const plan = buildCatchUpPlan({
      strategy: request.strategy,
      currentDayNumber: state.currentDayNumber,
      today: state.today,
      missedDays
    });
    if (request.strategy === "intentionally_skip") {
      const replay = await this.#models.Progress.exists({
        userId,
        operationKeys: request.idempotencyKey
      });
      if (replay !== null) {
        return catchUpPlanResponseSchema.parse(plan);
      }
      const current = state.byDay.get(state.currentDayNumber);
      if (
        current !== undefined &&
        (completedStatuses as readonly string[]).includes(current.status)
      ) {
        throw problem(
          "progress-conflict",
          "Progress conflict",
          409,
          "A completed mission cannot be converted into an intentional skip."
        );
      }
      await this.#models.Progress.findOneAndUpdate(
        { userId, dayNumber: state.currentDayNumber },
        {
          $set: {
            status: "intentionally_skipped",
            selectedMode: null,
            statusReason: request.reason,
            rescheduledFor: null,
            completedAt: null
          },
          $setOnInsert: {
            userId,
            dayNumber: state.currentDayNumber,
            evidence: [],
            startedAt: null
          },
          $addToSet: { operationKeys: request.idempotencyKey },
          $inc: { version: 1 }
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );
    }
    return catchUpPlanResponseSchema.parse(plan);
  }

  async taskPlan(userId: string, dayNumber: number): Promise<DayTaskPlan> {
    await this.#user(userId);
    this.#day(dayNumber);
    const progress = await this.#models.Progress.findOne({ userId, dayNumber }).lean();
    return taskPlanValue(dayNumber, progress);
  }

  async updateTaskPlan(
    userId: string,
    dayNumber: number,
    request: UpdateDayTaskPlanRequest
  ): Promise<DayTaskPlan> {
    await this.#user(userId);
    this.#day(dayNumber);
    const existing = await this.#models.Progress.findOne({ userId, dayNumber }).lean();
    if (existing?.operationKeys.includes(request.idempotencyKey) === true) {
      return taskPlanValue(dayNumber, existing);
    }
    const protectedStatus =
      existing !== null &&
      ["in_progress", "core_completed", "recovery_completed", "intentionally_skipped"].includes(
        existing.status
      );
    const status = protectedStatus ? existing.status : request.status;
    const progress = await this.#models.Progress.findOneAndUpdate(
      { userId, dayNumber },
      {
        $set: {
          status,
          estimateMinutes: request.estimateMinutes,
          actualMinutes: request.actualMinutes,
          timerSeconds: request.timerSeconds,
          timerState: request.timerState,
          subtasks: request.subtasks,
          rescheduledFor: status === "rescheduled" ? request.rescheduledFor : null,
          ...(status === "rescheduled"
            ? { selectedMode: null, statusReason: "Rescheduled by the learner." }
            : {})
        },
        $setOnInsert: {
          userId,
          dayNumber,
          evidence: [],
          startedAt: null,
          completedAt: null
        },
        $addToSet: { operationKeys: request.idempotencyKey },
        $inc: { version: 1 }
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();
    if (progress === null) {
      throw new Error("Task plan update did not return a progress record.");
    }
    return taskPlanValue(dayNumber, progress);
  }

  async reviews(userId: string): Promise<ReviewsResponse> {
    const state = await this.#workspaceState(userId);
    const records = await this.#models.ReviewItem.find({ userId })
      .sort({ dueDate: 1, sourceDayNumber: 1 })
      .lean();
    return reviewsResponseSchema.parse({
      due: records
        .filter((review) => review.status === "due" && review.dueDate <= state.today)
        .map(reviewValue),
      upcoming: records
        .filter((review) => review.status === "due" && review.dueDate > state.today)
        .map(reviewValue),
      completed: records
        .filter((review) => review.status === "completed")
        .slice(-50)
        .map(reviewValue)
    });
  }

  async submitReview(userId: string, reviewId: string, request: SubmitReviewRequest) {
    const existing = await this.#models.ReviewItem.findOne({ _id: reviewId, userId });
    if (existing === null) {
      throw problem(
        "review-not-found",
        "Review not found",
        404,
        "The requested review item is not available in this account."
      );
    }
    if (!existing.operationKeys.includes(request.idempotencyKey)) {
      existing.status = "completed";
      existing.answer = request.answer;
      existing.confidenceBefore = request.confidenceBefore;
      existing.confidenceAfter = request.confidenceAfter;
      existing.completedAt = this.#now();
      existing.operationKeys.push(request.idempotencyKey);
      await existing.save();
      if (request.misconception.length > 0) {
        await this.#models.Misconception.create({
          userId,
          sourceDayNumber: existing.sourceDayNumber,
          reviewItemId: existing._id,
          text: request.misconception,
          corrected: false,
          correctedAt: null
        });
      }
    }
    return reviewValue(existing);
  }

  async periodicReflections(userId: string) {
    await this.#user(userId);
    const reflections = await this.#models.Reflection.find({
      userId,
      $or: [
        { weeklySummary: { $exists: true, $ne: "" } },
        { monthlyRetrospective: { $exists: true, $ne: "" } }
      ]
    })
      .sort({ dayNumber: -1 })
      .limit(64)
      .lean();
    return periodicReflectionsResponseSchema.parse({
      reflections: reflections.map((reflection) =>
        periodicReflectionSchema.parse({
          dayNumber: reflection.dayNumber,
          weeklySummary: reflection.weeklySummary ?? "",
          monthlyRetrospective: reflection.monthlyRetrospective ?? "",
          updatedAt: iso(reflection.updatedAt)
        })
      )
    });
  }

  async savePeriodicReflection(
    userId: string,
    dayNumber: number,
    request: UpdatePeriodicReflectionRequest
  ) {
    await this.#user(userId);
    this.#day(dayNumber);
    const existing = await this.#models.Reflection.findOne({ userId, dayNumber });
    if (existing?.operationKeys.includes(request.idempotencyKey) === true) {
      return periodicReflectionSchema.parse({
        dayNumber,
        weeklySummary: existing.weeklySummary,
        monthlyRetrospective: existing.monthlyRetrospective,
        updatedAt: iso(existing.updatedAt)
      });
    }
    const reflection = await this.#models.Reflection.findOneAndUpdate(
      { userId, dayNumber },
      {
        $set: {
          weeklySummary: request.weeklySummary,
          monthlyRetrospective: request.monthlyRetrospective
        },
        $setOnInsert: {
          userId,
          dayNumber,
          confused: "",
          mentalModelChanged: "",
          retrieveLater: "",
          completedAt: null
        },
        $addToSet: { operationKeys: request.idempotencyKey }
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    if (reflection === null) {
      throw new Error("Periodic reflection update did not return a reflection record.");
    }
    return periodicReflectionSchema.parse({
      dayNumber,
      weeklySummary: reflection.weeklySummary,
      monthlyRetrospective: reflection.monthlyRetrospective,
      updatedAt: iso(reflection.updatedAt)
    });
  }

  async skills(userId: string): Promise<SkillsResponse> {
    await this.#workspaceState(userId);
    const evidence = await this.#models.SkillEvidence.find({ userId })
      .sort({ dayNumber: 1 })
      .lean();
    const grouped = new Map<string, typeof evidence>();
    for (const record of evidence) {
      const current = grouped.get(record.skill) ?? [];
      current.push(record);
      grouped.set(record.skill, current);
    }
    const rank = { introduced: 0, practiced: 1, demonstrated: 2 } as const;
    const skills = [...grouped.entries()]
      .map(([skill, records]) => {
        const state = records.reduce(
          (best, record) => (rank[record.state] > rank[best] ? record.state : best),
          "introduced" as "introduced" | "practiced" | "demonstrated"
        );
        return {
          skill,
          state,
          introducedDay: Math.min(...records.map((record) => record.dayNumber)),
          practicedCount: records.filter((record) => record.state !== "introduced").length,
          demonstratedCount: records.filter((record) => record.state === "demonstrated").length,
          prerequisiteSkills: [],
          evidenceDayNumbers: [...new Set(records.map((record) => record.dayNumber))]
        };
      })
      .sort(
        (left, right) =>
          left.introducedDay - right.introducedDay || left.skill.localeCompare(right.skill)
      );
    return skillsResponseSchema.parse({
      skills,
      counts: {
        introduced: skills.filter((skill) => skill.state === "introduced").length,
        practiced: skills.filter((skill) => skill.state === "practiced").length,
        demonstrated: skills.filter((skill) => skill.state === "demonstrated").length
      }
    });
  }

  async achievements(userId: string) {
    await this.#workspaceState(userId);
    const [catalog, awarded] = await Promise.all([
      this.#models.Achievement.find().sort({ key: 1 }).lean(),
      this.#models.UserAchievement.find({ userId }).lean()
    ]);
    const awardedByKey = new Map(awarded.map((entry) => [entry.achievementKey, entry]));
    return {
      achievements: catalog.map((entry) => ({
        key: entry.key,
        title: entry.title,
        description: entry.description,
        earned: awardedByKey.has(entry.key),
        awardedAt: awardedByKey.get(entry.key)?.awardedAt.toISOString() ?? null
      }))
    };
  }

  async portfolio(userId: string): Promise<PortfolioResponse> {
    await this.#workspaceState(userId);
    const artifacts = await this.#models.PortfolioArtifact.find({ userId })
      .sort({ monthNumber: 1, artifactKey: 1 })
      .lean();
    return portfolioResponseSchema.parse({
      artifacts: artifacts.map(portfolioValue)
    });
  }

  async updatePortfolio(
    userId: string,
    artifactKey: string,
    request: UpdatePortfolioArtifactRequest
  ): Promise<PortfolioArtifact> {
    await this.#ensurePortfolio(userId);
    const artifact = await this.#models.PortfolioArtifact.findOneAndUpdate(
      { userId, artifactKey },
      { $set: request },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (artifact === null) {
      throw problem(
        "portfolio-artifact-not-found",
        "Portfolio artifact not found",
        404,
        "The requested artifact key is not part of this portfolio."
      );
    }
    return portfolioValue(artifact);
  }

  async jobApplications(userId: string) {
    await this.#user(userId);
    const applications = await this.#models.JobApplication.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    return jobApplicationsResponseSchema.parse({
      applications: applications.map(jobValue)
    });
  }

  async createJobApplication(
    userId: string,
    request: CreateJobApplicationRequest
  ): Promise<JobApplication> {
    await this.#user(userId);
    const existing = await this.#models.JobApplication.findOne({
      userId,
      idempotencyKey: request.idempotencyKey
    }).lean();
    if (existing !== null) return jobValue(existing);
    const application = await this.#models.JobApplication.create({
      userId,
      company: request.company,
      role: request.role,
      status: request.status,
      evidenceLinks: request.evidenceLinks,
      nextAction: request.nextAction,
      idempotencyKey: request.idempotencyKey
    });
    return jobValue(application);
  }

  async errors(userId: string) {
    await this.#user(userId);
    const entries = await this.#models.ErrorMuseumEntry.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();
    return errorMuseumResponseSchema.parse({ entries: entries.map(errorValue) });
  }

  async saveError(userId: string, request: UpsertErrorMuseumRequest): Promise<ErrorMuseumEntry> {
    await this.#user(userId);
    const replay = await this.#models.ErrorMuseumEntry.findOne({
      userId,
      idempotencyKey: request.idempotencyKey
    }).lean();
    if (replay !== null) return errorValue(replay);
    const entry = await this.#models.ErrorMuseumEntry.create({
      userId,
      dayNumber: request.dayNumber,
      title: request.title,
      bug: request.bug,
      hypothesis: request.hypothesis,
      evidence: request.evidence,
      fix: request.fix,
      test: request.test,
      lesson: request.lesson,
      tags: request.tags,
      idempotencyKey: request.idempotencyKey
    });
    await this.#models.UserAchievement.updateOne(
      { userId, achievementKey: "evidence-debugger" },
      {
        $setOnInsert: {
          userId,
          achievementKey: "evidence-debugger",
          evidenceKey: `error:${entry._id.toString()}`,
          awardedAt: this.#now()
        }
      },
      { upsert: true }
    );
    return errorValue(entry);
  }

  async notes(userId: string) {
    await this.#user(userId);
    const sources = await this.#models.IndexedSource.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();
    return notesResponseSchema.parse({ sources: sources.map(noteValue) });
  }

  async saveNote(userId: string, request: UpsertNoteRequest) {
    await this.#user(userId);
    const contentHash = sha256(request.content);
    const chunks = chunkText(request.content);
    if (request.sourceId !== undefined) {
      const source = await this.#models.IndexedSource.findOne({
        _id: request.sourceId,
        userId
      });
      if (source === null) {
        throw problem(
          "note-not-found",
          "Note not found",
          404,
          "The requested note is not available in this account."
        );
      }
      if (!source.operationKeys.includes(request.idempotencyKey)) {
        source.title = request.title;
        source.dayNumber = request.dayNumber;
        source.content = request.content;
        source.contentHash = contentHash;
        source.version += 1;
        source.chunks = [...chunks];
        source.operationKeys.push(request.idempotencyKey);
        await source.save();
      }
      return noteResponseSchema.parse({ source: noteValue(source) });
    }
    const created = await this.#models.IndexedSource.create({
      userId,
      title: request.title,
      dayNumber: request.dayNumber,
      content: request.content,
      contentHash,
      version: 1,
      chunks: [...chunks],
      operationKeys: [request.idempotencyKey]
    });
    return noteResponseSchema.parse({ source: noteValue(created) });
  }

  async deleteNote(userId: string, sourceId: string): Promise<void> {
    await this.#user(userId);
    const result = await this.#models.IndexedSource.deleteOne({ _id: sourceId, userId });
    if (result.deletedCount !== 1) {
      throw problem(
        "note-not-found",
        "Note not found",
        404,
        "The requested note is not available in this account."
      );
    }
  }

  async search(userId: string, request: RagSearchRequest): Promise<RagSearchResponse> {
    await this.#user(userId);
    const startedAt = performance.now();
    const sources = await this.#models.IndexedSource.find({ userId }).lean();
    const queryEmbedding = deterministicEmbedding(request.question);
    const candidates = sources.flatMap((source) =>
      source.chunks.map((chunk) => {
        const relevance = scoreRagRelevance({
          question: request.question,
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
      .slice(0, request.topK);
    const abstained = ranked.length === 0;
    const supportingCandidates = abstained ? [] : ranked.slice(0, 2);
    const citations = abstained
      ? []
      : supportingCandidates.map((candidate) => ({
          sourceId: candidate.source._id.toString(),
          chunkId: candidate.chunk.chunkId,
          sourceTitle: candidate.source.title,
          dayNumber: candidate.source.dayNumber,
          excerpt:
            candidate.chunk.text.length > 260
              ? `${candidate.chunk.text.slice(0, 257)}…`
              : candidate.chunk.text,
          score: Number(candidate.score.toFixed(4))
        }));
    const answer = abstained
      ? "I could not find enough support in your indexed notes. Add a relevant note or ask a narrower question."
      : `Your notes support this answer: ${supportingCandidates
          .map((candidate) => candidate.chunk.text)
          .join(" ")
          .slice(0, 900)}`;
    const trace = await this.#models.AiTrace.create({
      userId,
      feature: "rag-search",
      provider: "mock-hybrid",
      outcome: abstained ? "abstained" : "success",
      promptVersion: "rag-v1",
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      estimatedCostUsd: 0,
      inputHash: sha256(request.question),
      citationCount: citations.length,
      metadata: {
        sourceCount: sources.length,
        candidateCount: candidates.length,
        retrievalMode: "hybrid_mock"
      }
    });
    return ragSearchResponseSchema.parse({
      answer,
      abstained,
      generated: false,
      statements: [
        {
          text: answer,
          support: abstained ? "unsupported" : "source_supported",
          citationChunkIds: citations.map((citation) => citation.chunkId)
        }
      ],
      citations,
      retrievalMode: "hybrid_mock",
      traceId: trace._id.toString()
    });
  }

  async coach(userId: string, request: CoachRequest): Promise<CoachResponse> {
    const user = await this.#user(userId);
    const day = this.#day(request.dayNumber);
    const profile = user.profile;
    if (profile === null) throw new Error("Onboarded user unexpectedly lacked a profile.");
    const killSwitch = await this.#models.FeatureFlag.findOne({
      key: "ai-kill-switch"
    }).lean();
    const generation = await this.#gateway.coach({
      request,
      day,
      forceMock: killSwitch?.enabled === true,
      permitExternal:
        killSwitch?.enabled !== true &&
        request.allowExternal &&
        profile.aiPrivacyMode === "ask_before_external"
    });
    const trace = await this.#models.AiTrace.create({
      userId,
      feature: `coach:${request.action}`,
      provider: generation.provider,
      outcome: generation.outcome,
      promptVersion: "coach-v1",
      latencyMs: generation.latencyMs,
      estimatedCostUsd: generation.estimatedCostUsd,
      inputHash: sha256(
        JSON.stringify({
          action: request.action,
          dayNumber: request.dayNumber,
          learnerText: request.learnerText
        })
      ),
      citationCount: 0,
      metadata: {
        externallyPermitted:
          request.allowExternal && profile.aiPrivacyMode === "ask_before_external",
        killSwitchActive: killSwitch?.enabled === true,
        providerDetail: generation.detail,
        providerFailureKind: generation.failureKind
      }
    });
    return coachResponseSchema.parse({
      generated: true,
      provider: generation.provider,
      ...generation.payload,
      traceId: trace._id.toString()
    });
  }

  #plannerGraphDependencies(
    userId: string,
    request: PlannerRequest,
    persistCheckpoint?: (state: PlannerGraphState) => Promise<void>
  ): PlannerGraphDependencies {
    const tools = new PlannerToolRegistry({
      authorize: async (context) => {
        if (context.userId !== userId) return false;
        return (await this.#models.User.exists({ _id: userId })) !== null;
      },
      handlers: {
        get_progress: async () => {
          const state = await this.#workspaceState(userId);
          return {
            currentDayNumber: state.currentDayNumber,
            incompleteDayNumbers: state.journey
              .filter((entry) => !(advancedStatuses as readonly string[]).includes(entry.status))
              .map((entry) => entry.dayNumber)
          };
        },
        get_curriculum_roadmap: async (input) => {
          const argumentsValue = input as { fromDayNumber: number; limit: number };
          const dayCount = Math.min(argumentsValue.limit, 366 - argumentsValue.fromDayNumber);
          return {
            days: Array.from({ length: dayCount }, (_, index) => {
              const day = this.#day(argumentsValue.fromDayNumber + index);
              return {
                dayNumber: day.dayNumber,
                title: day.title,
                prerequisiteDayNumbers: day.prerequisiteDayNumbers
              };
            })
          };
        },
        get_time_budget: async () => ({ availableMinutes: request.availableMinutes }),
        search_notes: async (input) => {
          const argumentsValue = input as { query: string; limit: number };
          const queryTokens = new Set(
            argumentsValue.query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/gu) ?? []
          );
          const sources = await this.#models.IndexedSource.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
          const matches = sources
            .flatMap((source) =>
              source.chunks.map((chunk) => ({
                sourceId: source._id.toString(),
                snippet: chunk.text.slice(0, 500),
                score: [...queryTokens].filter((token) => chunk.text.toLowerCase().includes(token))
                  .length
              }))
            )
            .filter((candidate) => candidate.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, argumentsValue.limit)
            .map(({ sourceId, snippet }) => ({ sourceId, snippet }));
          return { matches };
        }
      }
    });
    return {
      tools,
      proposePlan: async (state) => createBoundedAgentProposal(state),
      deterministicPlan: async (state) => createDeterministicPlannerProposal(state),
      isKillSwitchActive: async () => {
        const killSwitch = await this.#models.FeatureFlag.findOne({
          key: "ai-kill-switch"
        }).lean();
        return killSwitch?.enabled === true;
      },
      ...(persistCheckpoint === undefined ? {} : { persistCheckpoint }),
      now: this.#now,
      clockMs: () => this.#now().getTime()
    };
  }

  async createPlan(userId: string, request: PlannerRequest): Promise<PlannerRun> {
    let run = await this.#models.AgentRun.findOne({
      userId,
      operationKeys: request.idempotencyKey
    });
    let initialGraphState: PlannerGraphState;
    if (run === null) {
      const state = await this.#workspaceState(userId);
      const day = this.#day(state.currentDayNumber);
      const flag = await this.#models.FeatureFlag.findOne({ key: "bounded-planner" }).lean();
      const agentUnlocked =
        day.monthNumber >= 11 && this.#aiConfig.agentEnabled && flag?.enabled === true;
      const runId = new Types.ObjectId();
      initialGraphState = createPlannerGraphState({
        runId: runId.toString(),
        userId,
        mode: agentUnlocked ? "bounded_agent" : "deterministic_workflow",
        request,
        approvalBehavior: "proposal_only",
        now: this.#now()
      });
      run = await this.#models.AgentRun.create({
        _id: runId,
        userId,
        graphVersion: initialGraphState.graphVersion,
        graphState: initialGraphState,
        mode: initialGraphState.mode,
        status: "running",
        actions: [],
        budget: {
          maxSteps: initialGraphState.budget.maxSteps,
          stepsUsed: 0,
          maxTokens: initialGraphState.budget.maxTokens,
          tokensUsed: 0,
          maxCostUsd: initialGraphState.budget.maxCostUsd,
          estimatedCostUsd: 0,
          maxWallTimeMs: initialGraphState.budget.maxWallTimeMs,
          wallTimeMs: 0
        },
        terminalReason: "running",
        trace: [],
        operationKeys: [request.idempotencyKey],
        approvedAt: null
      });
    } else {
      initialGraphState = parsePlannerGraphState(run.graphState);
      if (initialGraphState.runId !== run.id || initialGraphState.userId !== userId) {
        throw problem(
          "planner-state-invalid",
          "Planner state is invalid",
          409,
          "The persisted planner checkpoint does not belong to this run and account."
        );
      }
      if (initialGraphState.status !== "running") return plannerValue(run);
    }
    const persistCheckpoint = async (checkpointState: PlannerGraphState): Promise<void> => {
      await this.#models.AgentRun.updateOne(
        { _id: run._id, userId },
        {
          $set: {
            graphVersion: checkpointState.graphVersion,
            graphState: checkpointState,
            mode: checkpointState.mode,
            status: "running",
            actions: checkpointState.draft.map((action) => ({ ...action })),
            budget: {
              maxSteps: checkpointState.budget.maxSteps,
              stepsUsed: checkpointState.budget.stepsUsed,
              maxTokens: checkpointState.budget.maxTokens,
              tokensUsed: checkpointState.budget.tokensUsed,
              maxCostUsd: checkpointState.budget.maxCostUsd,
              estimatedCostUsd: checkpointState.budget.estimatedCostUsd,
              maxWallTimeMs: checkpointState.budget.maxWallTimeMs,
              wallTimeMs: checkpointState.budget.wallTimeMs
            },
            terminalReason: "running",
            trace: plannerTrace(checkpointState)
          }
        }
      );
    };
    const graphState = await runPlannerGraph(
      initialGraphState,
      this.#plannerGraphDependencies(userId, initialGraphState.request, persistCheckpoint)
    );
    run.graphVersion = graphState.graphVersion;
    run.graphState = graphState;
    run.mode = graphState.mode;
    run.status = plannerRecordStatus(graphState);
    run.actions = graphState.draft.map((action) => ({ ...action }));
    run.budget = {
      maxSteps: graphState.budget.maxSteps,
      stepsUsed: graphState.budget.stepsUsed,
      maxTokens: graphState.budget.maxTokens,
      tokensUsed: graphState.budget.tokensUsed,
      maxCostUsd: graphState.budget.maxCostUsd,
      estimatedCostUsd: graphState.budget.estimatedCostUsd,
      maxWallTimeMs: graphState.budget.maxWallTimeMs,
      wallTimeMs: graphState.budget.wallTimeMs
    };
    run.terminalReason = plannerRecordTerminalReason(graphState);
    run.trace = plannerTrace(graphState);
    await run.save();
    if (graphState.status !== "awaiting_approval") {
      throw problem(
        "planner-run-failed",
        "Planner run failed safely",
        503,
        `The bounded planner stopped with terminal reason ${graphState.terminalReason ?? "unknown"}.`
      );
    }
    return plannerValue(run);
  }

  async decidePlan(
    userId: string,
    runId: string,
    request: PlannerDecisionRequest,
    decision: "approve" | "revise"
  ): Promise<PlannerRun> {
    const run = await this.#models.AgentRun.findOne({ _id: runId, userId });
    if (run === null) {
      throw problem(
        "planner-run-not-found",
        "Planner run not found",
        404,
        "The requested planner run is not available in this account."
      );
    }
    if (run.operationKeys.includes(request.idempotencyKey)) return plannerValue(run);
    if (run.status !== request.expectedStatus) {
      throw problem(
        "planner-run-conflict",
        "Planner run conflict",
        409,
        "This plan is no longer awaiting approval."
      );
    }
    const persistedGraphState = parsePlannerGraphState(run.graphState);
    if (persistedGraphState.runId !== run.id || persistedGraphState.userId !== userId) {
      throw problem(
        "planner-state-invalid",
        "Planner state is invalid",
        409,
        "The persisted planner checkpoint does not belong to this run and account."
      );
    }
    const persistCheckpoint = async (checkpointState: PlannerGraphState): Promise<void> => {
      await this.#models.AgentRun.updateOne(
        { _id: run._id, userId },
        {
          $set: {
            graphState: checkpointState,
            mode: checkpointState.mode,
            status: "running",
            actions: checkpointState.draft.map((action) => ({ ...action })),
            budget: {
              maxSteps: checkpointState.budget.maxSteps,
              stepsUsed: checkpointState.budget.stepsUsed,
              maxTokens: checkpointState.budget.maxTokens,
              tokensUsed: checkpointState.budget.tokensUsed,
              maxCostUsd: checkpointState.budget.maxCostUsd,
              estimatedCostUsd: checkpointState.budget.estimatedCostUsd,
              maxWallTimeMs: checkpointState.budget.maxWallTimeMs,
              wallTimeMs: checkpointState.budget.wallTimeMs
            },
            terminalReason: "running",
            trace: plannerTrace(checkpointState)
          }
        }
      );
    };
    const graphState = await applyPlannerHumanDecision(
      persistedGraphState,
      {
        action: decision,
        idempotencyKey: request.idempotencyKey,
        ...(request.note.length === 0 ? {} : { note: request.note })
      },
      this.#plannerGraphDependencies(userId, persistedGraphState.request, persistCheckpoint)
    );
    run.graphState = graphState;
    run.mode = graphState.mode;
    run.status = plannerRecordStatus(graphState);
    run.actions = graphState.draft.map((action) => ({ ...action }));
    run.budget = {
      maxSteps: graphState.budget.maxSteps,
      stepsUsed: graphState.budget.stepsUsed,
      maxTokens: graphState.budget.maxTokens,
      tokensUsed: graphState.budget.tokensUsed,
      maxCostUsd: graphState.budget.maxCostUsd,
      estimatedCostUsd: graphState.budget.estimatedCostUsd,
      maxWallTimeMs: graphState.budget.maxWallTimeMs,
      wallTimeMs: graphState.budget.wallTimeMs
    };
    run.terminalReason = plannerRecordTerminalReason(graphState);
    run.operationKeys.push(request.idempotencyKey);
    run.trace = plannerTrace(graphState);
    if (decision === "approve") run.approvedAt = this.#now();
    await run.save();
    return plannerValue(run);
  }

  async operations(userId: string): Promise<OperationsResponse> {
    await this.#user(userId);
    const [traces, evalRuns, killSwitch] = await Promise.all([
      this.#models.AiTrace.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      this.#models.EvalRun.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
      this.#models.FeatureFlag.findOne({ key: "ai-kill-switch" }).lean()
    ]);
    return operationsResponseSchema.parse({
      capabilities: this.#gateway.capabilities(),
      traces: traces.map(traceValue),
      evalRuns: evalRuns.map(evalValue),
      estimatedCostUsd: traces.reduce((total, trace) => total + trace.estimatedCostUsd, 0),
      killSwitchActive: killSwitch?.enabled ?? false
    });
  }

  async localEval(userId: string) {
    await this.#user(userId);
    const evaluation = await runLocalBehavioralEvaluation({ now: this.#now });
    const run = await this.#models.EvalRun.create({
      userId,
      datasetVersion: evaluation.dataset.version,
      datasetHash: evaluation.dataset.hash,
      evaluatorVersion: evaluation.evaluatorVersion,
      providerConfig: evaluation.providerConfig,
      passed: evaluation.passed,
      score: evaluation.score,
      passingScore: evaluation.passingScore,
      criticalFailures: [...evaluation.criticalFailures],
      negativeControlsPassed: evaluation.negativeControlsPassed,
      durationMs: evaluation.durationMs,
      estimatedCostUsd: evaluation.estimatedCostUsd,
      cases: evaluation.cases.map((entry) => ({
        ...entry,
        input: { ...entry.input },
        expectedAssertions: entry.expectedAssertions.map((assertion) => ({ ...assertion })),
        observed: { ...entry.observed },
        assertions: entry.assertions.map((assertion) => ({ ...assertion }))
      }))
    });
    return localEvalResponseSchema.parse({ run: evalValue(run) });
  }

  async evalRuns(userId: string) {
    await this.#user(userId);
    const runs = await this.#models.EvalRun.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return { runs: runs.map(evalValue) };
  }

  async traces(userId: string) {
    await this.#user(userId);
    const traces = await this.#models.AiTrace.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return { traces: traces.map(traceValue) };
  }

  async adminOverview(userId: string, previewDayNumber: number): Promise<AdminOverviewResponse> {
    await this.#user(userId);
    if (this.#curriculum.status !== "ready") {
      throw problem(
        "curriculum-unavailable",
        "Curriculum unavailable",
        503,
        "Development diagnostics require the validated curriculum runtime."
      );
    }
    const curriculum = this.#curriculum;
    const preview = this.#day(previewDayNumber);
    const [resources, curriculumDocuments, evalDatasets, featureFlags, agentRuns, operations] =
      await Promise.all([
        this.#models.Resource.find({}).sort({ resourceId: 1 }).lean(),
        this.#models.CurriculumDay.find({}).sort({ updatedAt: -1 }).lean(),
        this.#models.EvalDataset.find({}).sort({ updatedAt: -1 }).lean(),
        this.#models.FeatureFlag.find({}).sort({ key: 1 }).lean(),
        this.#models.AgentRun.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
        this.operations(userId)
      ]);

    const missing: { path: string; detail: string }[] = [];
    const duplicateDayLocations = new Map<number, string[]>();
    for (const [index, day] of curriculum.days.entries()) {
      const locations = duplicateDayLocations.get(day.dayNumber) ?? [];
      locations.push(`days[${index}]`);
      duplicateDayLocations.set(day.dayNumber, locations);
      for (const [field, value] of [
        ["title", day.title],
        ["learningObjective", day.learningObjective],
        ["buildTask", day.buildTask],
        ["corePrinciple", day.corePrinciple],
        ["recoveryTask", day.recoveryTask],
        ["tinyArtifact", day.tinyArtifact]
      ] as const) {
        if (value.trim().length === 0) {
          missing.push({
            path: `days[${index}].${field}`,
            detail: `Day ${day.dayNumber} is missing required ${field} content.`
          });
        }
      }
      for (const resourceId of day.resourceIds) {
        if (curriculum.resources[resourceId] === undefined) {
          missing.push({
            path: `days[${index}].resourceIds`,
            detail: `Day ${day.dayNumber} references missing resource ${resourceId}.`
          });
        }
      }
    }

    const persistedDayNumbers = new Set(curriculumDocuments.map((document) => document.dayNumber));
    for (let dayNumber = 1; dayNumber <= 365; dayNumber += 1) {
      if (!persistedDayNumbers.has(dayNumber)) {
        missing.push({
          path: `CurriculumDay[${dayNumber}]`,
          detail: `Persisted curriculum seed is missing Day ${dayNumber}.`
        });
      }
    }
    for (const document of curriculumDocuments) {
      if (document.version !== 2 || document.sourceHash !== curriculum.sourceSha256) {
        missing.push({
          path: `CurriculumDay[${document.dayNumber}].seedVersion`,
          detail: `Day ${document.dayNumber} does not match curriculum document version 2 and the active source hash.`
        });
      }
    }

    const duplicates: {
      kind: "day_number" | "resource_url";
      value: string;
      locations: string[];
    }[] = [];
    for (const [dayNumber, locations] of duplicateDayLocations) {
      if (locations.length > 1) {
        duplicates.push({ kind: "day_number", value: String(dayNumber), locations });
      }
    }
    const resourceUrlLocations = new Map<string, string[]>();
    for (const [resourceId, resource] of Object.entries(curriculum.resources)) {
      const locations = resourceUrlLocations.get(resource.url) ?? [];
      locations.push(`resourceCatalog.${resourceId}`);
      resourceUrlLocations.set(resource.url, locations);
    }
    for (const [url, locations] of resourceUrlLocations) {
      if (locations.length > 1) {
        duplicates.push({ kind: "resource_url", value: url, locations });
      }
    }

    const statusCounts = {
      source_verified: 0,
      reachable: 0,
      unknown: 0,
      unreachable: 0
    };
    for (const resource of resources) statusCounts[resource.lastCheckedStatus] += 1;

    const latestCurriculumUpdate = curriculumDocuments[0]?.updatedAt ?? null;
    const latestResourceUpdate = resources.reduce<Date | null>(
      (latest, resource) =>
        latest === null || resource.updatedAt > latest ? resource.updatedAt : latest,
      null
    );
    const latestEvalDatasetUpdate = evalDatasets[0]?.updatedAt ?? null;
    const curriculumSeedApplied =
      curriculumDocuments.length === 365 &&
      curriculumDocuments.every(
        (document) => document.version === 2 && document.sourceHash === curriculum.sourceSha256
      );
    const resourceSeedApplied =
      resources.length === Object.keys(curriculum.resources).length &&
      resources.every((resource) => curriculum.resources[resource.resourceId] !== undefined);
    const evalSeedApplied = evalDatasets.length > 0;

    return adminOverviewResponseSchema.parse({
      developmentOnly: true,
      generatedAt: iso(this.#now()),
      curriculum: {
        schemaVersion: "2.0.0",
        documentVersion: 2,
        sourceSha256: curriculum.sourceSha256,
        dayCount: 365,
        milestoneCount: 12,
        preview,
        quality: {
          passed: missing.length === 0 && duplicates.length === 0,
          missing,
          duplicates
        }
      },
      resources: {
        total: resources.length,
        statusCounts,
        items: resources.map((resource) => ({
          id: resource.resourceId,
          provider: resource.provider,
          title: resource.title,
          url: resource.url,
          type: resource.type,
          lastCheckedStatus: resource.lastCheckedStatus,
          lastCheckedAt: resource.lastCheckedAt === null ? null : iso(resource.lastCheckedAt)
        }))
      },
      seeds: {
        evalDatasets: evalDatasets.map((dataset) => ({
          version: dataset.version,
          evaluatorVersion: dataset.evaluatorVersion,
          caseCount: dataset.caseCount,
          contentHash: dataset.contentHash,
          updatedAt: iso(dataset.updatedAt)
        })),
        migrations: [
          {
            id: "curriculum-v2-seed",
            version: "2",
            status: curriculumSeedApplied ? "applied" : "mismatch",
            detail: curriculumSeedApplied
              ? "All 365 curriculum documents match version 2 and the active source hash."
              : "Persisted curriculum documents do not match the active version 2 seed.",
            appliedAt: latestCurriculumUpdate === null ? null : iso(latestCurriculumUpdate)
          },
          {
            id: "resource-catalog-v2-seed",
            version: "2",
            status: resourceSeedApplied ? "applied" : "mismatch",
            detail: resourceSeedApplied
              ? "Every active catalog resource has one persisted validation record."
              : "Persisted resource records do not match the active catalog.",
            appliedAt: latestResourceUpdate === null ? null : iso(latestResourceUpdate)
          },
          {
            id: "behavioral-eval-dataset-seed",
            version: evalDatasets[0]?.version ?? "missing",
            status: evalSeedApplied ? "applied" : "mismatch",
            detail: evalSeedApplied
              ? "At least one hashed behavioral eval dataset is registered."
              : "No behavioral eval dataset seed is registered.",
            appliedAt: latestEvalDatasetUpdate === null ? null : iso(latestEvalDatasetUpdate)
          }
        ]
      },
      operations,
      agentRuns: agentRuns.map((run) => ({
        id: run._id.toString(),
        graphVersion: run.graphVersion,
        mode: run.mode,
        status: run.status,
        terminalReason: run.terminalReason,
        stepsUsed: run.budget.stepsUsed,
        maxSteps: run.budget.maxSteps,
        trace: run.trace,
        createdAt: iso(run.createdAt),
        updatedAt: iso(run.updatedAt)
      })),
      featureFlags: featureFlags.map((flag) => ({
        key: flag.key,
        enabled: flag.enabled,
        description: flag.description,
        updatedBy: flag.updatedBy,
        updatedAt: iso(flag.updatedAt)
      })),
      mockScenarios: adminMockScenarioCatalog,
      visualStates: adminVisualStates.map(([key, label]) => ({
        key,
        label,
        galleryAnchor: `${key}-heading`
      })),
      reset: {
        confirmationPhrase: "RESET DEMO DATA",
        scope: "current_account_product_data",
        preserves: ["account", "profile", "active_session", "global_seed_data"]
      }
    });
  }

  async updateAdminFeatureFlag(
    userId: string,
    key: string,
    request: AdminFeatureFlagUpdateRequest
  ): Promise<AdminFeatureFlag> {
    await this.#user(userId);
    void request.confirmation;
    const flag = await this.#models.FeatureFlag.findOneAndUpdate(
      { key },
      {
        $set: {
          enabled: request.enabled,
          updatedBy: `development-admin:${userId.slice(-8)}`
        }
      },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (flag === null) {
      throw problem(
        "feature-flag-not-found",
        "Feature flag not found",
        404,
        "The requested development feature flag does not exist."
      );
    }
    return adminFeatureFlagSchema.parse({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description,
      updatedBy: flag.updatedBy,
      updatedAt: iso(flag.updatedAt)
    });
  }

  async runAdminMockScenario(
    userId: string,
    request: AdminMockScenarioRequest
  ): Promise<AdminMockScenarioResponse> {
    await this.#user(userId);
    return adminMockScenarioResponseSchema.parse({
      scenario: request.scenario,
      ...mockScenarioResults[request.scenario]
    });
  }

  async resetAdminDemoData(userId: string): Promise<AdminResetDemoDataResponse> {
    const user = await this.#user(userId);
    const databaseSession = await this.#models.User.db.startSession();
    let collections: AdminResetDemoDataResponse["collections"] = [];
    try {
      await databaseSession.withTransaction(async () => {
        const transactionCollections: AdminResetDemoDataResponse["collections"] = [];
        const progress = await this.#models.Progress.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "ProgressLog",
          deletedCount: progress.deletedCount
        });
        const reflections = await this.#models.Reflection.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "Reflection",
          deletedCount: reflections.deletedCount
        });
        const xp = await this.#models.XpEvent.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({ collection: "XpEvent", deletedCount: xp.deletedCount });
        const achievements = await this.#models.UserAchievement.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "UserAchievement",
          deletedCount: achievements.deletedCount
        });
        const skills = await this.#models.SkillEvidence.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "SkillEvidence",
          deletedCount: skills.deletedCount
        });
        const reviews = await this.#models.ReviewItem.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "ReviewItem",
          deletedCount: reviews.deletedCount
        });
        const misconceptions = await this.#models.Misconception.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "Misconception",
          deletedCount: misconceptions.deletedCount
        });
        const errors = await this.#models.ErrorMuseumEntry.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "ErrorMuseumEntry",
          deletedCount: errors.deletedCount
        });
        const portfolio = await this.#models.PortfolioArtifact.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "PortfolioArtifact",
          deletedCount: portfolio.deletedCount
        });
        const traces = await this.#models.AiTrace.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({ collection: "AiTrace", deletedCount: traces.deletedCount });
        const evalRuns = await this.#models.EvalRun.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({ collection: "EvalRun", deletedCount: evalRuns.deletedCount });
        const sources = await this.#models.IndexedSource.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "IndexedSource",
          deletedCount: sources.deletedCount
        });
        const agents = await this.#models.AgentRun.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({ collection: "AgentRun", deletedCount: agents.deletedCount });
        const jobs = await this.#models.JobApplication.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        transactionCollections.push({
          collection: "JobApplication",
          deletedCount: jobs.deletedCount
        });
        collections = transactionCollections;
      });
    } catch {
      throw problem(
        "demo-reset-failed",
        "Demo reset failed",
        503,
        "No development demo data was reset because the transaction did not complete safely."
      );
    } finally {
      await databaseSession.endSession();
    }

    return adminResetDemoDataResponseSchema.parse({
      reset: true,
      scope: "current_account_product_data",
      deletedRecords: collections.reduce((total, entry) => total + entry.deletedCount, 0),
      collections,
      preserved: ["account", "profile", "active_session", "global_seed_data"]
    });
  }
}
