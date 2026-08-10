import { z } from "zod";

import {
  idempotencyKeySchema,
  isoDateTimeSchema,
  isoLocalDateSchema,
  mongoIdSchema,
  progressModeSchema,
  progressStatusSchema
} from "./account.js";
import {
  curriculumDayResponseSchema,
  httpsUrlSchema,
  nonEmptyStringSchema,
  resourceCheckStatusSchema
} from "./curriculum.js";

export const extendedTaskStatusSchema = progressStatusSchema;

export const skillStateSchema = z.enum(["introduced", "practiced", "demonstrated"]);
export const reviewStatusSchema = z.enum(["due", "completed", "snoozed"]);
export const confidenceSchema = z.number().int().min(1).max(5);

export const progressSummarySchema = z
  .object({
    currentDayNumber: z.number().int().min(1).max(365),
    coreCompletions: z.number().int().min(0),
    recoveryWins: z.number().int().min(0),
    intentionalSkips: z.number().int().min(0),
    totalReturns: z.number().int().min(0),
    currentStreak: z.number().int().min(0),
    longestStreak: z.number().int().min(0),
    rolling7DayReturns: z.number().int().min(0).max(7),
    rolling30DayReturns: z.number().int().min(0).max(30),
    xp: z.number().int().min(0),
    graceTokensAvailable: z.number().int().min(0).max(3)
  })
  .strict();

export const journeyDaySchema = z
  .object({
    dayNumber: z.number().int().min(1).max(365),
    monthNumber: z.number().int().min(1).max(12),
    status: extendedTaskStatusSchema,
    selectedMode: progressModeSchema.nullable()
  })
  .strict();

export const journeyMilestoneSchema = z
  .object({
    monthNumber: z.number().int().min(1).max(12),
    title: nonEmptyStringSchema,
    focus: nonEmptyStringSchema,
    portfolioEvidence: nonEmptyStringSchema,
    completedDays: z.number().int().min(0),
    totalDays: z.number().int().positive()
  })
  .strict();

export const reviewPreviewSchema = z
  .object({
    id: mongoIdSchema,
    sourceDayNumber: z.number().int().min(1).max(365),
    intervalDays: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)]),
    dueDate: isoLocalDateSchema,
    prompt: nonEmptyStringSchema,
    status: reviewStatusSchema
  })
  .strict();

export const portfolioArtifactStatusSchema = z.enum([
  "not_started",
  "draft",
  "evidence_ready",
  "published"
]);

export const portfolioArtifactSchema = z
  .object({
    id: mongoIdSchema,
    artifactKey: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    monthNumber: z.number().int().min(1).max(12),
    status: portfolioArtifactStatusSchema,
    repositoryUrl: httpsUrlSchema.nullable(),
    demoUrl: httpsUrlSchema.nullable(),
    screenshotUrls: z.array(httpsUrlSchema).max(12),
    skillsProven: z.array(nonEmptyStringSchema).max(30),
    testsAndEvals: z.array(nonEmptyStringSchema).max(30),
    tradeoffs: z.array(nonEmptyStringSchema).max(20),
    limitations: z.array(nonEmptyStringSchema).max(20),
    interviewQuestions: z.array(nonEmptyStringSchema).max(20),
    evidenceLinks: z.array(httpsUrlSchema).max(30),
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const dashboardResponseSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    day: curriculumDayResponseSchema.nullable(),
    summary: progressSummarySchema,
    journey: z.array(journeyDaySchema).length(365),
    reviewsDue: z.array(reviewPreviewSchema).max(10),
    portfolioFocus: portfolioArtifactSchema.nullable(),
    missedCalendarDays: z.number().int().min(0),
    recentEvidence: z
      .array(
        z
          .object({
            dayNumber: z.number().int().min(1).max(365),
            label: nonEmptyStringSchema,
            kind: nonEmptyStringSchema,
            createdAt: isoDateTimeSchema
          })
          .strict()
      )
      .max(10)
  })
  .strict();

export const roadmapResponseSchema = z
  .object({
    summary: progressSummarySchema,
    milestones: z.array(journeyMilestoneSchema).length(12),
    days: z.array(journeyDaySchema).length(365),
    sevenDayPreview: z.array(curriculumDayResponseSchema).max(7)
  })
  .strict();

export const catchUpStrategySchema = z.enum([
  "continue",
  "calendar_catch_up",
  "intentionally_skip"
]);

export const catchUpPlanRequestSchema = z
  .object({
    strategy: catchUpStrategySchema,
    reason: z.string().trim().max(500),
    idempotencyKey: idempotencyKeySchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.strategy === "intentionally_skip" && value.reason.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A written reason is required for an intentional skip."
      });
    }
  });

export const catchUpPlanResponseSchema = z
  .object({
    strategy: catchUpStrategySchema,
    explanation: nonEmptyStringSchema,
    maxCoreMissionsPerDay: z.literal(1),
    items: z
      .array(
        z
          .object({
            dayNumber: z.number().int().min(1).max(365),
            scheduledDate: isoLocalDateSchema,
            mode: progressModeSchema,
            reason: nonEmptyStringSchema
          })
          .strict()
      )
      .max(14)
  })
  .strict();

export const taskSubtaskSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    title: z.string().trim().min(1).max(160),
    estimateMinutes: z.number().int().min(1).max(240),
    actualMinutes: z.number().int().min(0).max(1_440),
    completed: z.boolean()
  })
  .strict();

export const dayTaskPlanSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(365),
    status: extendedTaskStatusSchema,
    estimateMinutes: z.number().int().min(1).max(240),
    actualMinutes: z.number().int().min(0).max(1_440),
    timerSeconds: z.number().int().min(0).max(86_400),
    timerState: z.enum(["paused", "running"]),
    rescheduledFor: isoLocalDateSchema.nullable(),
    subtasks: z.array(taskSubtaskSchema).max(12),
    nextSubtask: taskSubtaskSchema.nullable(),
    updatedAt: isoDateTimeSchema.nullable()
  })
  .strict();

export const updateDayTaskPlanRequestSchema = z
  .object({
    status: z.enum(["not_started", "opened", "rescheduled"]),
    estimateMinutes: z.number().int().min(1).max(240),
    actualMinutes: z.number().int().min(0).max(1_440),
    timerSeconds: z.number().int().min(0).max(86_400),
    timerState: z.enum(["paused", "running"]),
    rescheduledFor: isoLocalDateSchema.nullable(),
    subtasks: z.array(taskSubtaskSchema).max(12),
    idempotencyKey: idempotencyKeySchema
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.subtasks.map((subtask) => subtask.id)).size !== value.subtasks.length) {
      context.addIssue({
        code: "custom",
        path: ["subtasks"],
        message: "Subtask identifiers must be unique within a curriculum day."
      });
    }
    if (value.status === "rescheduled" && value.rescheduledFor === null) {
      context.addIssue({
        code: "custom",
        path: ["rescheduledFor"],
        message: "A rescheduled day requires a target date."
      });
    }
  });

export const reviewItemSchema = reviewPreviewSchema
  .extend({
    question: nonEmptyStringSchema,
    closedNote: z.boolean(),
    confidenceBefore: confidenceSchema.nullable(),
    confidenceAfter: confidenceSchema.nullable(),
    answer: z.string().max(2_000),
    completedAt: isoDateTimeSchema.nullable()
  })
  .strict();

export const reviewsResponseSchema = z
  .object({
    due: z.array(reviewItemSchema),
    upcoming: z.array(reviewItemSchema),
    completed: z.array(reviewItemSchema).max(50)
  })
  .strict();

export const submitReviewRequestSchema = z
  .object({
    answer: z.string().trim().min(1).max(2_000),
    confidenceBefore: confidenceSchema,
    confidenceAfter: confidenceSchema,
    misconception: z.string().trim().max(500),
    idempotencyKey: idempotencyKeySchema
  })
  .strict();

export const periodicReflectionSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(365),
    weeklySummary: z.string().max(2_000),
    monthlyRetrospective: z.string().max(4_000),
    updatedAt: isoDateTimeSchema.nullable()
  })
  .strict();

export const periodicReflectionsResponseSchema = z
  .object({ reflections: z.array(periodicReflectionSchema).max(64) })
  .strict();

export const updatePeriodicReflectionRequestSchema = z
  .object({
    weeklySummary: z.string().trim().max(2_000),
    monthlyRetrospective: z.string().trim().max(4_000),
    idempotencyKey: idempotencyKeySchema
  })
  .strict()
  .refine(
    (value) => value.weeklySummary.length > 0 || value.monthlyRetrospective.length > 0,
    "Save a weekly reflection, a monthly retrospective, or both."
  );

export const skillRecordSchema = z
  .object({
    skill: nonEmptyStringSchema,
    state: skillStateSchema,
    introducedDay: z.number().int().min(1).max(365),
    practicedCount: z.number().int().min(0),
    demonstratedCount: z.number().int().min(0),
    prerequisiteSkills: z.array(nonEmptyStringSchema).max(20),
    evidenceDayNumbers: z.array(z.number().int().min(1).max(365)).max(365)
  })
  .strict();

export const skillsResponseSchema = z
  .object({
    skills: z.array(skillRecordSchema),
    counts: z
      .object({
        introduced: z.number().int().min(0),
        practiced: z.number().int().min(0),
        demonstrated: z.number().int().min(0)
      })
      .strict()
  })
  .strict();

export const portfolioResponseSchema = z
  .object({
    artifacts: z.array(portfolioArtifactSchema)
  })
  .strict();

export const updatePortfolioArtifactRequestSchema = z
  .object({
    status: portfolioArtifactStatusSchema,
    repositoryUrl: httpsUrlSchema.nullable(),
    demoUrl: httpsUrlSchema.nullable(),
    screenshotUrls: z.array(httpsUrlSchema).max(12),
    skillsProven: z.array(nonEmptyStringSchema).max(30),
    testsAndEvals: z.array(nonEmptyStringSchema).max(30),
    tradeoffs: z.array(nonEmptyStringSchema).max(20),
    limitations: z.array(nonEmptyStringSchema).max(20),
    interviewQuestions: z.array(nonEmptyStringSchema).max(20),
    evidenceLinks: z.array(httpsUrlSchema).max(30)
  })
  .strict();

export const jobApplicationStatusSchema = z.enum([
  "researching",
  "drafting",
  "applied",
  "screen",
  "interview",
  "offer",
  "closed"
]);

export const jobApplicationSchema = z
  .object({
    id: mongoIdSchema,
    company: nonEmptyStringSchema,
    role: nonEmptyStringSchema,
    status: jobApplicationStatusSchema,
    evidenceLinks: z.array(httpsUrlSchema).max(20),
    nextAction: nonEmptyStringSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const jobApplicationsResponseSchema = z
  .object({ applications: z.array(jobApplicationSchema).max(200) })
  .strict();

export const createJobApplicationRequestSchema = jobApplicationSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ idempotencyKey: idempotencyKeySchema })
  .strict();

export const errorMuseumEntrySchema = z
  .object({
    id: mongoIdSchema,
    title: nonEmptyStringSchema,
    dayNumber: z.number().int().min(1).max(365).nullable(),
    bug: nonEmptyStringSchema,
    hypothesis: nonEmptyStringSchema,
    evidence: nonEmptyStringSchema,
    fix: nonEmptyStringSchema,
    test: nonEmptyStringSchema,
    lesson: nonEmptyStringSchema,
    tags: z.array(nonEmptyStringSchema).max(20),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const errorMuseumResponseSchema = z
  .object({ entries: z.array(errorMuseumEntrySchema) })
  .strict();

export const upsertErrorMuseumRequestSchema = errorMuseumEntrySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ idempotencyKey: idempotencyKeySchema })
  .strict();

export const noteSourceSchema = z
  .object({
    id: mongoIdSchema,
    title: nonEmptyStringSchema,
    dayNumber: z.number().int().min(1).max(365).nullable(),
    content: nonEmptyStringSchema,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.number().int().positive(),
    chunkCount: z.number().int().min(1),
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const upsertNoteRequestSchema = z
  .object({
    sourceId: mongoIdSchema.optional(),
    title: z.string().trim().min(1).max(120),
    dayNumber: z.number().int().min(1).max(365).nullable(),
    content: z.string().trim().min(1).max(20_000),
    idempotencyKey: idempotencyKeySchema
  })
  .strict();

export const noteResponseSchema = z.object({ source: noteSourceSchema }).strict();
export const notesResponseSchema = z.object({ sources: z.array(noteSourceSchema) }).strict();

export const ragSearchRequestSchema = z
  .object({
    question: z.string().trim().min(3).max(1_000),
    topK: z.number().int().min(1).max(8).default(5)
  })
  .strict();

export const ragCitationSchema = z
  .object({
    sourceId: mongoIdSchema,
    chunkId: nonEmptyStringSchema,
    sourceTitle: nonEmptyStringSchema,
    dayNumber: z.number().int().min(1).max(365).nullable(),
    excerpt: nonEmptyStringSchema,
    score: z.number().min(0).max(1)
  })
  .strict();

export const ragSearchResponseSchema = z
  .object({
    answer: nonEmptyStringSchema,
    abstained: z.boolean(),
    generated: z.boolean(),
    statements: z.array(
      z
        .object({
          text: nonEmptyStringSchema,
          support: z.enum(["source_supported", "inference", "unsupported"]),
          citationChunkIds: z.array(nonEmptyStringSchema)
        })
        .strict()
    ),
    citations: z.array(ragCitationSchema).max(8),
    retrievalMode: z.enum(["hybrid_mock", "python_embedding", "lexical_fallback"]),
    traceId: mongoIdSchema
  })
  .strict();

export const coachActionSchema = z.enum([
  "explain",
  "socratic",
  "reflect",
  "next_step",
  "weekly_recap",
  "portfolio_story"
]);

export const coachRequestSchema = z
  .object({
    action: coachActionSchema,
    dayNumber: z.number().int().min(1).max(365),
    learnerText: z.string().trim().max(4_000),
    allowExternal: z.boolean().default(false)
  })
  .strict();

export const coachResponseSchema = z
  .object({
    generated: z.literal(true),
    provider: z.enum(["mock", "python_mock", "openai", "local", "fallback"]),
    heading: nonEmptyStringSchema,
    explanation: nonEmptyStringSchema,
    socraticQuestion: nonEmptyStringSchema,
    nextTinyStep: nonEmptyStringSchema,
    evidenceBoundary: nonEmptyStringSchema,
    safetyNote: nonEmptyStringSchema,
    traceId: mongoIdSchema
  })
  .strict();

export const providerCapabilitySchema = z
  .object({
    provider: nonEmptyStringSchema,
    available: z.boolean(),
    structuredOutput: z.boolean(),
    tools: z.boolean(),
    embeddings: z.boolean(),
    streaming: z.boolean(),
    local: z.boolean(),
    privacy: z.enum(["local", "external_opt_in", "mock"])
  })
  .strict();

export const plannerRequestSchema = z
  .object({
    weekStart: isoLocalDateSchema,
    availableMinutes: z.number().int().min(30).max(840),
    priorities: z.array(z.string().trim().min(1).max(120)).max(8),
    idempotencyKey: idempotencyKeySchema
  })
  .strict();

export const plannerActionSchema = z
  .object({
    actionId: nonEmptyStringSchema,
    date: isoLocalDateSchema,
    dayNumber: z.number().int().min(1).max(365),
    mode: progressModeSchema,
    minutes: z.number().int().min(5).max(40),
    rationale: nonEmptyStringSchema
  })
  .strict();

export const agentBudgetSchema = z
  .object({
    maxSteps: z.number().int().min(1).max(12),
    stepsUsed: z.number().int().min(0).max(12),
    maxTokens: z.number().int().min(1).max(20_000),
    tokensUsed: z.number().int().min(0).max(20_000),
    maxCostUsd: z.number().min(0).max(5),
    estimatedCostUsd: z.number().min(0).max(5),
    maxWallTimeMs: z.number().int().min(100).max(60_000),
    wallTimeMs: z.number().int().min(0).max(60_000)
  })
  .strict();

export const plannerRunSchema = z
  .object({
    id: mongoIdSchema,
    mode: z.enum(["deterministic_workflow", "bounded_agent"]),
    approvalBehavior: z.enum(["proposal_only", "persist_on_approval"]),
    status: z.enum(["awaiting_approval", "approved", "revision_requested", "cancelled"]),
    actions: z.array(plannerActionSchema).max(7),
    budget: agentBudgetSchema,
    terminalReason: z.enum([
      "awaiting_human_approval",
      "approved_by_human",
      "revision_requested",
      "budget_exhausted",
      "cancelled"
    ]),
    trace: z.array(nonEmptyStringSchema).max(24),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const plannerDecisionRequestSchema = z
  .object({
    note: z.string().trim().max(500),
    expectedStatus: z.literal("awaiting_approval"),
    idempotencyKey: idempotencyKeySchema
  })
  .strict();

export const aiTraceSchema = z
  .object({
    id: mongoIdSchema,
    feature: nonEmptyStringSchema,
    provider: nonEmptyStringSchema,
    outcome: z.enum(["success", "fallback", "abstained", "refused", "error"]),
    promptVersion: nonEmptyStringSchema,
    latencyMs: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    citationCount: z.number().int().min(0),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const evalScalarSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.array(z.number().finite()),
  z.array(z.boolean())
]);

const evalExternalPolicySchema = z
  .object({
    configured: z.boolean(),
    profileConsent: z.boolean(),
    requestConsent: z.boolean(),
    killSwitch: z.boolean()
  })
  .strict();

export const evalCoachScenarioSchema = z
  .object({
    kind: z.literal("coach"),
    input: z
      .object({
        providerScenario: z.enum([
          "mock",
          "valid",
          "extra_field",
          "missing_field",
          "refusal",
          "error",
          "timeout"
        ]),
        action: coachActionSchema,
        dayNumber: z.number().int().min(1).max(365),
        learnerText: z.string().max(4_000),
        externalPolicy: evalExternalPolicySchema
      })
      .strict()
  })
  .strict();

export const evalRagSourceSchema = z
  .object({
    sourceId: nonEmptyStringSchema,
    tenantId: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    text: z.string().trim().min(1).max(8_000)
  })
  .strict();

export const evalRagScenarioSchema = z
  .object({
    kind: z.literal("rag"),
    input: z
      .object({
        tenantId: nonEmptyStringSchema,
        question: z.string().trim().min(3).max(1_000),
        topK: z.number().int().min(1).max(8),
        sources: z.array(evalRagSourceSchema).min(1).max(20),
        relevantSourceIds: z.array(nonEmptyStringSchema).max(20),
        injectionMarker: z.string().max(200).nullable()
      })
      .strict()
  })
  .strict();

export const evalToolScenarioSchema = z
  .object({
    kind: z.literal("tool_guard"),
    input: z
      .object({
        callId: nonEmptyStringSchema,
        toolName: nonEmptyStringSchema,
        arguments: z.record(z.string(), evalScalarSchema),
        allowlistedTools: z.array(nonEmptyStringSchema).min(1).max(12),
        authorized: z.boolean(),
        priorCallIds: z.array(nonEmptyStringSchema).max(24),
        budget: z
          .object({
            maxSteps: z.number().int().min(1).max(12),
            stepsUsed: z.number().int().min(0).max(12),
            maxTokens: z.number().int().min(1).max(20_000),
            tokensUsed: z.number().int().min(0).max(20_000),
            maxCostUsd: z.number().min(0).max(5),
            estimatedCostUsd: z.number().min(0).max(5),
            maxWallTimeMs: z.number().int().min(100).max(60_000),
            wallTimeMs: z.number().int().min(0).max(60_000)
          })
          .strict()
      })
      .strict()
  })
  .strict();

export const evalPlannerScenarioSchema = z
  .object({
    kind: z.literal("planner"),
    input: z
      .object({
        weekStart: isoLocalDateSchema,
        availableMinutes: z.number().int().min(30).max(840),
        priorities: z.array(z.string().trim().min(1).max(120)).max(8),
        currentDayNumber: z.number().int().min(1).max(365)
      })
      .strict()
  })
  .strict();

export const evalOutputSafetyScenarioSchema = z
  .object({
    kind: z.literal("output_safety"),
    input: z
      .object({
        untrustedOutput: z.string().min(1).max(4_000)
      })
      .strict()
  })
  .strict();

export const evalScenarioKindSchema = z.enum([
  "coach",
  "rag",
  "tool_guard",
  "planner",
  "output_safety"
]);

export const evalScenarioSchema = z.discriminatedUnion("kind", [
  evalCoachScenarioSchema,
  evalRagScenarioSchema,
  evalToolScenarioSchema,
  evalPlannerScenarioSchema,
  evalOutputSafetyScenarioSchema
]);

export const evalAssertionDefinitionSchema = z
  .object({
    assertionId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    field: z.string().trim().min(1).max(120),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "includes",
      "not_includes",
      "gte",
      "lte",
      "unique"
    ]),
    expected: evalScalarSchema
  })
  .strict()
  .superRefine((assertion, context) => {
    if (
      (assertion.operator === "gte" || assertion.operator === "lte") &&
      typeof assertion.expected !== "number"
    ) {
      context.addIssue({
        code: "custom",
        path: ["expected"],
        message: `${assertion.operator} requires a numeric expected value.`
      });
    }
    if (
      (assertion.operator === "contains" || assertion.operator === "not_contains") &&
      typeof assertion.expected !== "string"
    ) {
      context.addIssue({
        code: "custom",
        path: ["expected"],
        message: `${assertion.operator} requires a string expected value.`
      });
    }
    if (
      (assertion.operator === "includes" || assertion.operator === "not_includes") &&
      Array.isArray(assertion.expected)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expected"],
        message: `${assertion.operator} requires a scalar array member, not an array.`
      });
    }
    if (assertion.operator === "unique" && assertion.expected !== true) {
      context.addIssue({
        code: "custom",
        path: ["expected"],
        message: "unique requires expected=true."
      });
    }
  });

export const evalDatasetCaseSchema = z
  .object({
    caseId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    category: z.enum([
      "schema",
      "safety",
      "usefulness",
      "retrieval",
      "grounding",
      "citation",
      "reliability",
      "security",
      "privacy",
      "tools",
      "agency",
      "cost"
    ]),
    critical: z.boolean(),
    scenario: evalScenarioSchema,
    expectedBehavior: z.string().trim().min(1).max(1_000),
    assertions: z.array(evalAssertionDefinitionSchema).min(1).max(20)
  })
  .strict()
  .superRefine((entry, context) => {
    const assertionIds = new Set<string>();
    entry.assertions.forEach((assertion, index) => {
      if (assertionIds.has(assertion.assertionId)) {
        context.addIssue({
          code: "custom",
          path: ["assertions", index, "assertionId"],
          message: `Duplicate assertionId within ${entry.caseId}: ${assertion.assertionId}.`
        });
      }
      assertionIds.add(assertion.assertionId);
    });
  });

export const evalDatasetSchema = z
  .object({
    version: nonEmptyStringSchema,
    evaluatorVersion: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    passingScore: z.number().min(0).max(1),
    providerConfig: z
      .object({
        provider: nonEmptyStringSchema,
        model: nonEmptyStringSchema,
        promptVersion: nonEmptyStringSchema,
        sampling: nonEmptyStringSchema,
        externalCallsAllowed: z.boolean(),
        fixtureProfile: nonEmptyStringSchema
      })
      .strict(),
    cases: z.array(evalDatasetCaseSchema).min(30).max(200)
  })
  .strict()
  .superRefine((dataset, context) => {
    const seen = new Set<string>();
    dataset.cases.forEach((entry, index) => {
      if (seen.has(entry.caseId)) {
        context.addIssue({
          code: "custom",
          path: ["cases", index, "caseId"],
          message: `Duplicate eval caseId: ${entry.caseId}.`
        });
      }
      seen.add(entry.caseId);
    });
  });

export const evalAssertionResultSchema = z
  .object({
    assertionId: nonEmptyStringSchema,
    field: nonEmptyStringSchema,
    operator: evalAssertionDefinitionSchema.shape.operator,
    expected: evalScalarSchema,
    actual: evalScalarSchema,
    passed: z.boolean(),
    detail: nonEmptyStringSchema
  })
  .strict();

export const evalCaseResultSchema = z
  .object({
    caseId: nonEmptyStringSchema,
    category: nonEmptyStringSchema,
    critical: z.boolean(),
    scenarioKind: evalScenarioKindSchema,
    input: z.record(z.string(), z.unknown()),
    expectedBehavior: nonEmptyStringSchema,
    expectedAssertions: z.array(evalAssertionDefinitionSchema).min(1).max(20),
    observed: z.record(z.string(), evalScalarSchema),
    assertions: z.array(evalAssertionResultSchema).min(1).max(20),
    passed: z.boolean(),
    detail: nonEmptyStringSchema,
    latencyMs: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0)
  })
  .strict();

export const evalProviderConfigSchema = evalDatasetSchema.shape.providerConfig.extend({
  datasetHashAlgorithm: z.literal("sha256"),
  redactionPolicy: z.literal("synthetic-fixtures-only")
});

export const evalRunSchema = z
  .object({
    id: mongoIdSchema,
    datasetVersion: nonEmptyStringSchema,
    datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
    evaluatorVersion: nonEmptyStringSchema,
    providerConfig: evalProviderConfigSchema,
    passed: z.boolean(),
    score: z.number().min(0).max(1),
    passingScore: z.number().min(0).max(1),
    criticalFailures: z.array(nonEmptyStringSchema),
    negativeControlsPassed: z.boolean(),
    durationMs: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0),
    cases: z.array(evalCaseResultSchema).min(1).max(200),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const operationsResponseSchema = z
  .object({
    capabilities: z.array(providerCapabilitySchema),
    traces: z.array(aiTraceSchema).max(100),
    evalRuns: z.array(evalRunSchema).max(30),
    estimatedCostUsd: z.number().min(0),
    killSwitchActive: z.boolean()
  })
  .strict();

export const localEvalResponseSchema = z.object({ run: evalRunSchema }).strict();

export const adminFeatureFlagSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]{1,80}$/),
    enabled: z.boolean(),
    description: nonEmptyStringSchema,
    updatedBy: nonEmptyStringSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export const adminFeatureFlagUpdateRequestSchema = z
  .object({
    enabled: z.boolean(),
    confirmation: z.literal("UPDATE DEVELOPMENT FLAG")
  })
  .strict();

export const adminMockScenarioSchema = z.enum([
  "success",
  "timeout",
  "refusal",
  "schema_error",
  "rag_no_evidence",
  "agent_awaiting_approval"
]);

export const adminMockOutcomeSchema = z.enum([
  "success",
  "timeout",
  "refused",
  "rejected",
  "abstained",
  "awaiting_approval"
]);

export const adminMockScenarioRequestSchema = z
  .object({ scenario: adminMockScenarioSchema })
  .strict();

export const adminMockScenarioResponseSchema = z
  .object({
    scenario: adminMockScenarioSchema,
    outcome: adminMockOutcomeSchema,
    generated: z.literal(false),
    title: nonEmptyStringSchema,
    detail: nonEmptyStringSchema,
    trace: z.array(nonEmptyStringSchema).min(1).max(12)
  })
  .strict();

export const adminResetDemoDataRequestSchema = z
  .object({ confirmation: z.literal("RESET DEMO DATA") })
  .strict();

export const adminResetCollectionSchema = z.enum([
  "ProgressLog",
  "Reflection",
  "XpEvent",
  "UserAchievement",
  "SkillEvidence",
  "ReviewItem",
  "Misconception",
  "ErrorMuseumEntry",
  "PortfolioArtifact",
  "AiTrace",
  "EvalRun",
  "IndexedSource",
  "AgentRun",
  "JobApplication"
]);

export const adminResetDemoDataResponseSchema = z
  .object({
    reset: z.literal(true),
    scope: z.literal("current_account_product_data"),
    deletedRecords: z.number().int().min(0),
    collections: z.array(
      z
        .object({
          collection: adminResetCollectionSchema,
          deletedCount: z.number().int().min(0)
        })
        .strict()
    ),
    preserved: z
      .array(z.enum(["account", "profile", "active_session", "global_seed_data"]))
      .length(4)
  })
  .strict();

export const adminOverviewResponseSchema = z
  .object({
    developmentOnly: z.literal(true),
    generatedAt: isoDateTimeSchema,
    curriculum: z
      .object({
        schemaVersion: z.literal("2.0.0"),
        documentVersion: z.literal(2),
        sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
        dayCount: z.literal(365),
        milestoneCount: z.literal(12),
        preview: curriculumDayResponseSchema,
        quality: z
          .object({
            passed: z.boolean(),
            missing: z.array(
              z
                .object({
                  path: nonEmptyStringSchema,
                  detail: nonEmptyStringSchema
                })
                .strict()
            ),
            duplicates: z.array(
              z
                .object({
                  kind: z.enum(["day_number", "resource_url"]),
                  value: nonEmptyStringSchema,
                  locations: z.array(nonEmptyStringSchema).min(2)
                })
                .strict()
            )
          })
          .strict()
      })
      .strict(),
    resources: z
      .object({
        total: z.number().int().min(0),
        statusCounts: z
          .object({
            source_verified: z.number().int().min(0),
            reachable: z.number().int().min(0),
            unknown: z.number().int().min(0),
            unreachable: z.number().int().min(0)
          })
          .strict(),
        items: z.array(
          z
            .object({
              id: nonEmptyStringSchema,
              provider: nonEmptyStringSchema,
              title: nonEmptyStringSchema,
              url: httpsUrlSchema,
              type: nonEmptyStringSchema,
              lastCheckedStatus: resourceCheckStatusSchema,
              lastCheckedAt: isoDateTimeSchema.nullable()
            })
            .strict()
        )
      })
      .strict(),
    seeds: z
      .object({
        evalDatasets: z.array(
          z
            .object({
              version: nonEmptyStringSchema,
              evaluatorVersion: nonEmptyStringSchema,
              caseCount: z.number().int().min(1),
              contentHash: z.string().regex(/^[a-f0-9]{64}$/),
              updatedAt: isoDateTimeSchema
            })
            .strict()
        ),
        migrations: z.array(
          z
            .object({
              id: nonEmptyStringSchema,
              version: nonEmptyStringSchema,
              status: z.enum(["applied", "mismatch"]),
              detail: nonEmptyStringSchema,
              appliedAt: isoDateTimeSchema.nullable()
            })
            .strict()
        )
      })
      .strict(),
    operations: operationsResponseSchema,
    agentRuns: z.array(
      z
        .object({
          id: mongoIdSchema,
          graphVersion: z.literal("planner-graph-v1"),
          mode: z.enum(["deterministic_workflow", "bounded_agent"]),
          status: z.enum([
            "running",
            "awaiting_approval",
            "approved",
            "revision_requested",
            "cancelled"
          ]),
          terminalReason: z.enum([
            "running",
            "awaiting_human_approval",
            "approved_by_human",
            "revision_requested",
            "budget_exhausted",
            "cancelled"
          ]),
          stepsUsed: z.number().int().min(0),
          maxSteps: z.number().int().min(1),
          trace: z.array(nonEmptyStringSchema).max(24),
          createdAt: isoDateTimeSchema,
          updatedAt: isoDateTimeSchema
        })
        .strict()
    ),
    featureFlags: z.array(adminFeatureFlagSchema),
    mockScenarios: z.array(
      z
        .object({
          key: adminMockScenarioSchema,
          label: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
          expectedOutcome: adminMockOutcomeSchema
        })
        .strict()
    ),
    visualStates: z.array(
      z
        .object({
          key: nonEmptyStringSchema,
          label: nonEmptyStringSchema,
          galleryAnchor: nonEmptyStringSchema
        })
        .strict()
    ),
    reset: z
      .object({
        confirmationPhrase: z.literal("RESET DEMO DATA"),
        scope: z.literal("current_account_product_data"),
        preserves: z
          .array(z.enum(["account", "profile", "active_session", "global_seed_data"]))
          .length(4)
      })
      .strict()
  })
  .strict();

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
export type JourneyDay = z.infer<typeof journeyDaySchema>;
export type RoadmapResponse = z.infer<typeof roadmapResponseSchema>;
export type CatchUpPlanRequest = z.infer<typeof catchUpPlanRequestSchema>;
export type CatchUpPlanResponse = z.infer<typeof catchUpPlanResponseSchema>;
export type DayTaskPlan = z.infer<typeof dayTaskPlanSchema>;
export type UpdateDayTaskPlanRequest = z.infer<typeof updateDayTaskPlanRequestSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type ReviewsResponse = z.infer<typeof reviewsResponseSchema>;
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>;
export type PeriodicReflection = z.infer<typeof periodicReflectionSchema>;
export type UpdatePeriodicReflectionRequest = z.infer<typeof updatePeriodicReflectionRequestSchema>;
export type SkillsResponse = z.infer<typeof skillsResponseSchema>;
export type SkillRecord = z.infer<typeof skillRecordSchema>;
export type PortfolioArtifact = z.infer<typeof portfolioArtifactSchema>;
export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>;
export type UpdatePortfolioArtifactRequest = z.infer<typeof updatePortfolioArtifactRequestSchema>;
export type JobApplication = z.infer<typeof jobApplicationSchema>;
export type CreateJobApplicationRequest = z.infer<typeof createJobApplicationRequestSchema>;
export type ErrorMuseumEntry = z.infer<typeof errorMuseumEntrySchema>;
export type UpsertErrorMuseumRequest = z.infer<typeof upsertErrorMuseumRequestSchema>;
export type NoteSource = z.infer<typeof noteSourceSchema>;
export type UpsertNoteRequest = z.infer<typeof upsertNoteRequestSchema>;
export type RagSearchRequest = z.infer<typeof ragSearchRequestSchema>;
export type RagSearchResponse = z.infer<typeof ragSearchResponseSchema>;
export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachAction = z.infer<typeof coachActionSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;
export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;
export type PlannerRequest = z.infer<typeof plannerRequestSchema>;
export type PlannerRun = z.infer<typeof plannerRunSchema>;
export type PlannerDecisionRequest = z.infer<typeof plannerDecisionRequestSchema>;
export type OperationsResponse = z.infer<typeof operationsResponseSchema>;
export type AdminFeatureFlag = z.infer<typeof adminFeatureFlagSchema>;
export type AdminFeatureFlagUpdateRequest = z.infer<typeof adminFeatureFlagUpdateRequestSchema>;
export type AdminMockScenario = z.infer<typeof adminMockScenarioSchema>;
export type AdminMockScenarioRequest = z.infer<typeof adminMockScenarioRequestSchema>;
export type AdminMockScenarioResponse = z.infer<typeof adminMockScenarioResponseSchema>;
export type AdminResetDemoDataRequest = z.infer<typeof adminResetDemoDataRequestSchema>;
export type AdminResetDemoDataResponse = z.infer<typeof adminResetDemoDataResponseSchema>;
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
export type EvalScalar = z.infer<typeof evalScalarSchema>;
export type EvalScenario = z.infer<typeof evalScenarioSchema>;
export type EvalAssertionDefinition = z.infer<typeof evalAssertionDefinitionSchema>;
export type EvalDatasetCase = z.infer<typeof evalDatasetCaseSchema>;
export type EvalDataset = z.infer<typeof evalDatasetSchema>;
export type EvalAssertionResult = z.infer<typeof evalAssertionResultSchema>;
export type EvalCaseResult = z.infer<typeof evalCaseResultSchema>;
export type EvalRun = z.infer<typeof evalRunSchema>;
