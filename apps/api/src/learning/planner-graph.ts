import { plannerRequestSchema, type PlannerRequest, type PlannerRun } from "@codelift/contracts";
import { z } from "zod";

export const plannerGraphVersion = "planner-graph-v1" as const;

export const plannerGraphNodes = [
  "gather_progress",
  "gather_roadmap",
  "gather_time_budget",
  "search_notes",
  "draft_plan",
  "validate_plan",
  "await_human_review",
  "persist_approved_plan",
  "terminal"
] as const;

export type PlannerGraphNode = (typeof plannerGraphNodes)[number];

export const plannerToolNames = [
  "get_progress",
  "get_curriculum_roadmap",
  "search_notes",
  "get_time_budget",
  "persist_week_plan"
] as const;

export type PlannerToolName = (typeof plannerToolNames)[number];

export type PlannerAction = PlannerRun["actions"][number];

export type PlannerGraphTerminalReason =
  | "awaiting_human_approval"
  | "approved_by_human"
  | "approved_proposal_only"
  | "revision_requested"
  | "rejected_by_human"
  | "budget_exhausted"
  | "max_attempts_exhausted"
  | "invalid_plan"
  | "tool_unauthorized"
  | "tool_validation_failed"
  | "tool_execution_failed"
  | "cancelled";

export type PlannerGraphBudget = Readonly<{
  maxAttempts: number;
  attemptsUsed: number;
  maxSteps: number;
  stepsUsed: number;
  maxTokens: number;
  tokensUsed: number;
  maxCostUsd: number;
  estimatedCostUsd: number;
  maxWallTimeMs: number;
  wallTimeMs: number;
}>;

export type PlannerGraphTraceEvent = Readonly<{
  sequence: number;
  at: string;
  node: PlannerGraphNode;
  kind:
    | "node_started"
    | "node_completed"
    | "tool_called"
    | "tool_replayed"
    | "tool_completed"
    | "fallback"
    | "validation"
    | "checkpoint"
    | "human_decision"
    | "terminal";
  detail: string;
  tool: PlannerToolName | null;
  readOnly: boolean | null;
}>;

export type PlannerGraphCheckpoint = Readonly<{
  checkpointId: string;
  node: PlannerGraphNode;
  attempt: number;
  nextNode: PlannerGraphNode;
  createdAt: string;
}>;

export type PlannerGraphEvidence = Readonly<{
  currentDayNumber: number | null;
  incompleteDayNumbers: readonly number[];
  roadmapDays: readonly Readonly<{
    dayNumber: number;
    title: string;
    prerequisiteDayNumbers: readonly number[];
  }>[];
  availableMinutes: number | null;
  noteMatches: readonly Readonly<{
    sourceId: string;
    snippet: string;
  }>[];
}>;

export type PlannerGraphState = Readonly<{
  graphVersion: typeof plannerGraphVersion;
  runId: string;
  userId: string;
  mode: "deterministic_workflow" | "bounded_agent";
  approvalBehavior: "proposal_only" | "persist_on_approval";
  status: "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  node: PlannerGraphNode;
  nextNode: PlannerGraphNode;
  request: PlannerRequest;
  evidence: PlannerGraphEvidence;
  draft: readonly PlannerAction[];
  validationErrors: readonly string[];
  feedback: readonly string[];
  fallbackReason: "kill_switch" | "agent_disabled" | "provider_failure" | null;
  budget: PlannerGraphBudget;
  checkpoints: readonly PlannerGraphCheckpoint[];
  completedNodeKeys: readonly string[];
  toolCallKeys: readonly string[];
  toolResults: Readonly<Record<string, unknown>>;
  decisionKeys: readonly string[];
  trace: readonly PlannerGraphTraceEvent[];
  terminalReason: PlannerGraphTerminalReason | null;
  startedAtMs: number;
}>;

const userScopedSchema = z.object({ userId: z.string().min(1) }).strict();

const progressResultSchema = z
  .object({
    currentDayNumber: z.number().int().min(1).max(365),
    incompleteDayNumbers: z.array(z.number().int().min(1).max(365)).max(365)
  })
  .strict();

const roadmapResultSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            dayNumber: z.number().int().min(1).max(365),
            title: z.string().trim().min(1).max(240),
            prerequisiteDayNumbers: z.array(z.number().int().min(1).max(365)).max(364)
          })
          .strict()
      )
      .min(1)
      .max(14)
  })
  .strict();

const noteSearchResultSchema = z
  .object({
    matches: z
      .array(
        z
          .object({
            sourceId: z.string().min(1).max(120),
            snippet: z.string().trim().min(1).max(500)
          })
          .strict()
      )
      .max(5)
  })
  .strict();

const timeBudgetResultSchema = z
  .object({ availableMinutes: z.number().int().min(30).max(840) })
  .strict();

const persistedPlanResultSchema = z
  .object({ planId: z.string().min(1).max(120), persisted: z.literal(true) })
  .strict();

const actionSchema = z
  .object({
    actionId: z.string().trim().min(1).max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    dayNumber: z.number().int().min(1).max(365),
    mode: z.enum(["core", "recovery"]),
    minutes: z.number().int().min(5).max(40),
    rationale: z.string().trim().min(1).max(500)
  })
  .strict();

const proposalSchema = z
  .object({
    actions: z.array(actionSchema).min(1).max(7),
    usage: z
      .object({
        tokens: z.number().int().min(0).max(20_000),
        estimatedCostUsd: z.number().min(0).max(5)
      })
      .strict()
  })
  .strict();

const plannerGraphBudgetSchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(5),
    attemptsUsed: z.number().int().min(1).max(5),
    maxSteps: z.number().int().min(1).max(24),
    stepsUsed: z.number().int().min(0).max(24),
    maxTokens: z.number().int().min(1).max(20_000),
    tokensUsed: z.number().int().min(0).max(20_000),
    maxCostUsd: z.number().min(0).max(5),
    estimatedCostUsd: z.number().min(0).max(5),
    maxWallTimeMs: z.number().int().min(100).max(60_000),
    wallTimeMs: z.number().int().min(0).max(60_000)
  })
  .strict();

const plannerGraphStateSchema = z
  .object({
    graphVersion: z.literal(plannerGraphVersion),
    runId: z.string().min(1).max(120),
    userId: z.string().min(1).max(120),
    mode: z.enum(["deterministic_workflow", "bounded_agent"]),
    approvalBehavior: z.enum(["proposal_only", "persist_on_approval"]),
    status: z.enum(["running", "awaiting_approval", "completed", "failed", "cancelled"]),
    node: z.enum(plannerGraphNodes),
    nextNode: z.enum(plannerGraphNodes),
    request: plannerRequestSchema,
    evidence: z
      .object({
        currentDayNumber: z.number().int().min(1).max(365).nullable(),
        incompleteDayNumbers: z.array(z.number().int().min(1).max(365)).max(365),
        roadmapDays: roadmapResultSchema.shape.days,
        availableMinutes: z.number().int().min(30).max(840).nullable(),
        noteMatches: noteSearchResultSchema.shape.matches
      })
      .strict(),
    draft: z.array(actionSchema).max(7),
    validationErrors: z.array(z.string().min(1).max(500)).max(20),
    feedback: z.array(z.string().min(1).max(500)).max(5),
    fallbackReason: z.enum(["kill_switch", "agent_disabled", "provider_failure"]).nullable(),
    budget: plannerGraphBudgetSchema,
    checkpoints: z
      .array(
        z
          .object({
            checkpointId: z.string().min(1).max(240),
            node: z.enum(plannerGraphNodes),
            attempt: z.number().int().min(1).max(5),
            nextNode: z.enum(plannerGraphNodes),
            createdAt: z.string().datetime()
          })
          .strict()
      )
      .max(24),
    completedNodeKeys: z.array(z.string().min(1).max(120)).max(24),
    toolCallKeys: z.array(z.string().min(1).max(2_000)).max(24),
    toolResults: z.record(z.string(), z.unknown()),
    decisionKeys: z.array(z.string().min(8).max(128)).max(8),
    trace: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            at: z.string().datetime(),
            node: z.enum(plannerGraphNodes),
            kind: z.enum([
              "node_started",
              "node_completed",
              "tool_called",
              "tool_replayed",
              "tool_completed",
              "fallback",
              "validation",
              "checkpoint",
              "human_decision",
              "terminal"
            ]),
            detail: z.string().min(1).max(1_000),
            tool: z.enum(plannerToolNames).nullable(),
            readOnly: z.boolean().nullable()
          })
          .strict()
      )
      .max(200),
    terminalReason: z
      .enum([
        "awaiting_human_approval",
        "approved_by_human",
        "approved_proposal_only",
        "revision_requested",
        "rejected_by_human",
        "budget_exhausted",
        "max_attempts_exhausted",
        "invalid_plan",
        "tool_unauthorized",
        "tool_validation_failed",
        "tool_execution_failed",
        "cancelled"
      ])
      .nullable(),
    startedAtMs: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((state, context) => {
    const permitsRecordedOverage =
      state.status === "failed" && state.terminalReason === "budget_exhausted";
    if (permitsRecordedOverage) return;
    const budgetChecks = [
      ["attemptsUsed", state.budget.attemptsUsed, state.budget.maxAttempts],
      ["stepsUsed", state.budget.stepsUsed, state.budget.maxSteps],
      ["tokensUsed", state.budget.tokensUsed, state.budget.maxTokens],
      ["estimatedCostUsd", state.budget.estimatedCostUsd, state.budget.maxCostUsd],
      ["wallTimeMs", state.budget.wallTimeMs, state.budget.maxWallTimeMs]
    ] as const;
    for (const [field, used, maximum] of budgetChecks) {
      if (used > maximum) {
        context.addIssue({
          code: "custom",
          path: ["budget", field],
          message: `${field} exceeds its configured maximum outside a budget-exhausted terminal state.`
        });
      }
    }
  });

export function parsePlannerGraphState(value: unknown): PlannerGraphState {
  return plannerGraphStateSchema.parse(value) as PlannerGraphState;
}

type ToolDefinition = Readonly<{
  readOnly: boolean;
  input: z.ZodType;
  output: z.ZodType;
}>;

const toolDefinitions: Record<PlannerToolName, ToolDefinition> = {
  get_progress: {
    readOnly: true,
    input: userScopedSchema,
    output: progressResultSchema
  },
  get_curriculum_roadmap: {
    readOnly: true,
    input: userScopedSchema
      .extend({
        fromDayNumber: z.number().int().min(1).max(365),
        limit: z.number().int().min(1).max(14)
      })
      .strict(),
    output: roadmapResultSchema
  },
  search_notes: {
    readOnly: true,
    input: userScopedSchema
      .extend({ query: z.string().trim().min(1).max(500), limit: z.number().int().min(1).max(5) })
      .strict(),
    output: noteSearchResultSchema
  },
  get_time_budget: {
    readOnly: true,
    input: userScopedSchema
      .extend({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) })
      .strict(),
    output: timeBudgetResultSchema
  },
  persist_week_plan: {
    readOnly: false,
    input: userScopedSchema
      .extend({
        runId: z.string().min(1).max(120),
        idempotencyKey: z.string().min(8).max(128),
        actions: z.array(actionSchema).min(1).max(7)
      })
      .strict(),
    output: persistedPlanResultSchema
  }
};

export type PlannerToolHandler = (input: unknown) => Promise<unknown>;

export type PlannerToolAuthorization = (context: {
  userId: string;
  runId: string;
  tool: PlannerToolName;
  readOnly: boolean;
  humanApproved: boolean;
}) => Promise<boolean>;

export class PlannerToolError extends Error {
  readonly code:
    | "TOOL_NOT_ALLOWLISTED"
    | "TOOL_ARGUMENT_INVALID"
    | "TOOL_RESULT_INVALID"
    | "TOOL_UNAUTHORIZED"
    | "TOOL_APPROVAL_REQUIRED"
    | "TOOL_HANDLER_MISSING";

  constructor(code: PlannerToolError["code"], message: string) {
    super(message);
    this.name = "PlannerToolError";
    this.code = code;
  }
}

export class PlannerToolRegistry {
  readonly #authorize: PlannerToolAuthorization;
  readonly #handlers: Readonly<Partial<Record<PlannerToolName, PlannerToolHandler>>>;

  constructor(input: {
    authorize: PlannerToolAuthorization;
    handlers: Readonly<Partial<Record<PlannerToolName, PlannerToolHandler>>>;
  }) {
    this.#authorize = input.authorize;
    this.#handlers = input.handlers;
  }

  definition(name: PlannerToolName): Readonly<{ readOnly: boolean }> {
    return { readOnly: toolDefinitions[name].readOnly };
  }

  async execute(
    name: PlannerToolName,
    rawInput: unknown,
    context: Readonly<{ userId: string; runId: string; humanApproved: boolean }>
  ): Promise<unknown> {
    if (!(plannerToolNames as readonly string[]).includes(name)) {
      throw new PlannerToolError(
        "TOOL_NOT_ALLOWLISTED",
        `Tool ${String(name)} is not allowlisted.`
      );
    }
    const definition = toolDefinitions[name];
    const parsedInput = definition.input.safeParse(rawInput);
    if (!parsedInput.success) {
      throw new PlannerToolError("TOOL_ARGUMENT_INVALID", `Invalid arguments for ${name}.`);
    }
    const scopedInput = userScopedSchema.passthrough().safeParse(parsedInput.data);
    if (!scopedInput.success || scopedInput.data.userId !== context.userId) {
      throw new PlannerToolError("TOOL_UNAUTHORIZED", `${name} cannot cross the user boundary.`);
    }
    if (!definition.readOnly && !context.humanApproved) {
      throw new PlannerToolError(
        "TOOL_APPROVAL_REQUIRED",
        `${name} requires an explicit human approval.`
      );
    }
    const authorized = await this.#authorize({
      ...context,
      tool: name,
      readOnly: definition.readOnly
    });
    if (!authorized) {
      throw new PlannerToolError("TOOL_UNAUTHORIZED", `${name} was denied at execution time.`);
    }
    const handler = this.#handlers[name];
    if (handler === undefined) {
      throw new PlannerToolError("TOOL_HANDLER_MISSING", `No handler is registered for ${name}.`);
    }
    const rawOutput = await handler(parsedInput.data);
    const parsedOutput = definition.output.safeParse(rawOutput);
    if (!parsedOutput.success) {
      throw new PlannerToolError("TOOL_RESULT_INVALID", `Invalid result returned by ${name}.`);
    }
    return parsedOutput.data;
  }
}

export type PlannerProposal = z.infer<typeof proposalSchema>;

function addLocalDays(localDate: string, days: number): string {
  const parsed = new Date(`${localDate}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function createDeterministicPlannerProposal(state: PlannerGraphState): PlannerProposal {
  const availableMinutes = state.evidence.availableMinutes ?? state.request.availableMinutes;
  const actionCount = Math.min(
    7,
    state.evidence.roadmapDays.length,
    Math.max(1, Math.floor(availableMinutes / 30))
  );
  return proposalSchema.parse({
    actions: state.evidence.roadmapDays.slice(0, actionCount).map((day, index) => ({
      actionId: `plan-${day.dayNumber}-${index}`,
      date: addLocalDays(state.request.weekStart, index),
      dayNumber: day.dayNumber,
      mode: "core",
      minutes: 30,
      rationale:
        index === 0
          ? "Start with the next incomplete dependency-aware mission."
          : "Keep the fallback plan to one Core mission per day and preserve room for review."
    })),
    usage: { tokens: 0, estimatedCostUsd: 0 }
  });
}

export function createBoundedAgentProposal(state: PlannerGraphState): PlannerProposal {
  const availableMinutes = state.evidence.availableMinutes ?? state.request.availableMinutes;
  const actionCount = Math.min(
    7,
    state.evidence.roadmapDays.length,
    Math.max(1, Math.floor(availableMinutes / 30))
  );
  const priorities =
    state.request.priorities.length > 0 ? state.request.priorities : ["the next dependency"];
  const noteEvidence = state.evidence.noteMatches[0]?.snippet;
  const feedback = state.feedback.at(-1);
  const actions = state.evidence.roadmapDays.slice(0, actionCount).map((day, index) => {
    const priority =
      priorities[index % priorities.length] ?? priorities[0] ?? "the next dependency";
    const feedbackClause =
      feedback === undefined ? "" : ` Incorporate the learner feedback: ${feedback}`;
    const evidenceClause =
      noteEvidence === undefined
        ? ""
        : ` Use private-note evidence only as context: ${noteEvidence}`;
    return {
      actionId: `agent-${state.budget.attemptsUsed}-${day.dayNumber}-${index}`,
      date: addLocalDays(state.request.weekStart, index),
      dayNumber: day.dayNumber,
      mode: "core" as const,
      minutes: 30,
      rationale: `Prioritize ${priority} through ${day.title} while preserving prerequisite order.${feedbackClause}${evidenceClause}`
    };
  });
  const tokens = Math.min(
    state.budget.maxTokens,
    80 + Math.ceil(JSON.stringify({ actions, priorities }).length / 4)
  );
  return proposalSchema.parse({ actions, usage: { tokens, estimatedCostUsd: 0 } });
}

export type PlannerGraphDependencies = Readonly<{
  tools: PlannerToolRegistry;
  proposePlan: (state: PlannerGraphState) => Promise<unknown>;
  deterministicPlan: (state: PlannerGraphState) => Promise<unknown>;
  isKillSwitchActive: () => Promise<boolean>;
  persistCheckpoint?: (state: PlannerGraphState) => Promise<void>;
  now: () => Date;
  clockMs: () => number;
}>;

function appendTrace(
  state: PlannerGraphState,
  event: Omit<PlannerGraphTraceEvent, "sequence" | "at">
): PlannerGraphState {
  return {
    ...state,
    trace: [
      ...state.trace,
      {
        ...event,
        sequence: state.trace.length + 1,
        at: new Date(state.startedAtMs + state.budget.wallTimeMs).toISOString()
      }
    ]
  };
}

function withWallTime(state: PlannerGraphState, clockMs: () => number): PlannerGraphState {
  return {
    ...state,
    budget: {
      ...state.budget,
      wallTimeMs: Math.max(0, Math.round(clockMs() - state.startedAtMs))
    }
  };
}

function terminal(
  state: PlannerGraphState,
  status: "completed" | "failed" | "cancelled" | "awaiting_approval",
  reason: PlannerGraphTerminalReason,
  detail: string
): PlannerGraphState {
  const node = status === "awaiting_approval" ? "await_human_review" : "terminal";
  return appendTrace(
    {
      ...state,
      status,
      node,
      nextNode: node,
      terminalReason: reason
    },
    {
      node,
      kind: "terminal",
      detail,
      tool: null,
      readOnly: null
    }
  );
}

function checkpoint(
  state: PlannerGraphState,
  completedNode: PlannerGraphNode,
  nextNode: PlannerGraphNode,
  now: () => Date
): PlannerGraphState {
  const nodeKey = `${completedNode}:${state.budget.attemptsUsed}`;
  if (state.completedNodeKeys.includes(nodeKey)) return { ...state, nextNode };
  const checkpointId = `${state.runId}:${nodeKey}`;
  const updated = appendTrace(
    {
      ...state,
      node: completedNode,
      nextNode,
      completedNodeKeys: [...state.completedNodeKeys, nodeKey],
      checkpoints: [
        ...state.checkpoints,
        {
          checkpointId,
          node: completedNode,
          attempt: state.budget.attemptsUsed,
          nextNode,
          createdAt: now().toISOString()
        }
      ]
    },
    {
      node: completedNode,
      kind: "checkpoint",
      detail: `Persist checkpoint ${checkpointId}; resume at ${nextNode}.`,
      tool: null,
      readOnly: null
    }
  );
  return appendTrace(updated, {
    node: completedNode,
    kind: "node_completed",
    detail: `${completedNode} completed.`,
    tool: null,
    readOnly: null
  });
}

function nextStep(state: PlannerGraphState): PlannerGraphState {
  return {
    ...state,
    node: state.nextNode,
    budget: { ...state.budget, stepsUsed: state.budget.stepsUsed + 1 }
  };
}

function toolCallKey(state: PlannerGraphState, name: PlannerToolName, input: unknown): string {
  return `${state.node}:${state.budget.attemptsUsed}:${name}:${JSON.stringify(input)}`;
}

async function executeTool(
  state: PlannerGraphState,
  dependencies: PlannerGraphDependencies,
  name: PlannerToolName,
  input: unknown,
  humanApproved = false
): Promise<Readonly<{ state: PlannerGraphState; result: unknown }>> {
  const key = toolCallKey(state, name, input);
  const definition = dependencies.tools.definition(name);
  if (state.toolCallKeys.includes(key)) {
    const replayed = appendTrace(state, {
      node: state.node,
      kind: "tool_replayed",
      detail: `Reused idempotent result for ${name}.`,
      tool: name,
      readOnly: definition.readOnly
    });
    return { state: replayed, result: state.toolResults[key] };
  }
  const called = appendTrace(state, {
    node: state.node,
    kind: "tool_called",
    detail: `Execute allowlisted tool ${name}.`,
    tool: name,
    readOnly: definition.readOnly
  });
  const result = await dependencies.tools.execute(name, input, {
    userId: state.userId,
    runId: state.runId,
    humanApproved
  });
  const completed = appendTrace(
    {
      ...called,
      toolCallKeys: [...called.toolCallKeys, key],
      toolResults: { ...called.toolResults, [key]: result }
    },
    {
      node: state.node,
      kind: "tool_completed",
      detail: `${name} returned a runtime-validated result.`,
      tool: name,
      readOnly: definition.readOnly
    }
  );
  return { state: completed, result };
}

function toolFailure(state: PlannerGraphState, error: unknown): PlannerGraphState {
  if (error instanceof PlannerToolError) {
    const terminalReason =
      error.code === "TOOL_UNAUTHORIZED" || error.code === "TOOL_APPROVAL_REQUIRED"
        ? "tool_unauthorized"
        : error.code === "TOOL_ARGUMENT_INVALID" || error.code === "TOOL_RESULT_INVALID"
          ? "tool_validation_failed"
          : "tool_execution_failed";
    return terminal(state, "failed", terminalReason, error.message);
  }
  return terminal(
    state,
    "failed",
    "tool_execution_failed",
    error instanceof Error ? error.message : "An allowlisted tool failed."
  );
}

function validateDraft(state: PlannerGraphState): readonly string[] {
  const errors: string[] = [];
  const actions = state.draft;
  const roadmapDays = new Set(state.evidence.roadmapDays.map((day) => day.dayNumber));
  if (actions.length === 0 || actions.length > 7)
    errors.push("A weekly plan must contain 1–7 actions.");
  if (new Set(actions.map((action) => action.actionId)).size !== actions.length) {
    errors.push("Action identifiers must be unique.");
  }
  if (new Set(actions.map((action) => action.date)).size !== actions.length) {
    errors.push("A weekly plan can schedule at most one action per date.");
  }
  if (actions.some((action) => !roadmapDays.has(action.dayNumber))) {
    errors.push("Every action must target a day returned by the authorized roadmap tool.");
  }
  if (actions.some((action) => action.mode === "core" && action.minutes !== 30)) {
    errors.push("Core actions must preserve the 30-minute commitment.");
  }
  if (actions.some((action) => action.mode === "recovery" && action.minutes > 5)) {
    errors.push("Recovery actions must remain at or below five minutes.");
  }
  const totalMinutes = actions.reduce((total, action) => total + action.minutes, 0);
  if (state.evidence.availableMinutes === null || totalMinutes > state.evidence.availableMinutes) {
    errors.push("The plan exceeds the runtime-validated weekly time budget.");
  }
  return errors;
}

export function createPlannerGraphState(input: {
  runId: string;
  userId: string;
  mode: "deterministic_workflow" | "bounded_agent";
  request: PlannerRequest;
  approvalBehavior?: "proposal_only" | "persist_on_approval";
  budget?: Partial<
    Omit<
      PlannerGraphBudget,
      "attemptsUsed" | "stepsUsed" | "tokensUsed" | "estimatedCostUsd" | "wallTimeMs"
    >
  >;
  now?: Date;
}): PlannerGraphState {
  const now = input.now ?? new Date();
  return {
    graphVersion: plannerGraphVersion,
    runId: input.runId,
    userId: input.userId,
    mode: input.mode,
    approvalBehavior: input.approvalBehavior ?? "proposal_only",
    status: "running",
    node: "gather_progress",
    nextNode: "gather_progress",
    request: input.request,
    evidence: {
      currentDayNumber: null,
      incompleteDayNumbers: [],
      roadmapDays: [],
      availableMinutes: null,
      noteMatches: []
    },
    draft: [],
    validationErrors: [],
    feedback: [],
    fallbackReason: null,
    budget: {
      maxAttempts: input.budget?.maxAttempts ?? 2,
      attemptsUsed: 1,
      maxSteps: input.budget?.maxSteps ?? 10,
      stepsUsed: 0,
      maxTokens: input.budget?.maxTokens ?? (input.mode === "bounded_agent" ? 2_000 : 1),
      tokensUsed: 0,
      maxCostUsd: input.budget?.maxCostUsd ?? 0.05,
      estimatedCostUsd: 0,
      maxWallTimeMs: input.budget?.maxWallTimeMs ?? 5_000,
      wallTimeMs: 0
    },
    checkpoints: [],
    completedNodeKeys: [],
    toolCallKeys: [],
    toolResults: {},
    decisionKeys: [input.request.idempotencyKey],
    trace: [],
    terminalReason: null,
    startedAtMs: now.getTime()
  };
}

async function runNode(
  original: PlannerGraphState,
  dependencies: PlannerGraphDependencies
): Promise<PlannerGraphState> {
  let state = appendTrace(nextStep(original), {
    node: original.nextNode,
    kind: "node_started",
    detail: `${original.nextNode} started.`,
    tool: null,
    readOnly: null
  });
  try {
    switch (state.node) {
      case "gather_progress": {
        const executed = await executeTool(state, dependencies, "get_progress", {
          userId: state.userId
        });
        const result = progressResultSchema.parse(executed.result);
        state = {
          ...executed.state,
          evidence: {
            ...executed.state.evidence,
            currentDayNumber: result.currentDayNumber,
            incompleteDayNumbers: result.incompleteDayNumbers
          }
        };
        return checkpoint(state, "gather_progress", "gather_roadmap", dependencies.now);
      }
      case "gather_roadmap": {
        if (state.evidence.currentDayNumber === null) {
          return terminal(state, "failed", "invalid_plan", "Progress evidence is missing.");
        }
        const executed = await executeTool(state, dependencies, "get_curriculum_roadmap", {
          userId: state.userId,
          fromDayNumber: state.evidence.currentDayNumber,
          limit: 7
        });
        const result = roadmapResultSchema.parse(executed.result);
        state = {
          ...executed.state,
          evidence: { ...executed.state.evidence, roadmapDays: result.days }
        };
        return checkpoint(state, "gather_roadmap", "gather_time_budget", dependencies.now);
      }
      case "gather_time_budget": {
        const executed = await executeTool(state, dependencies, "get_time_budget", {
          userId: state.userId,
          weekStart: state.request.weekStart
        });
        const result = timeBudgetResultSchema.parse(executed.result);
        state = {
          ...executed.state,
          evidence: { ...executed.state.evidence, availableMinutes: result.availableMinutes }
        };
        return checkpoint(
          state,
          "gather_time_budget",
          state.request.priorities.length > 0 ? "search_notes" : "draft_plan",
          dependencies.now
        );
      }
      case "search_notes": {
        const executed = await executeTool(state, dependencies, "search_notes", {
          userId: state.userId,
          query: state.request.priorities.join("; "),
          limit: 3
        });
        const result = noteSearchResultSchema.parse(executed.result);
        state = {
          ...executed.state,
          evidence: { ...executed.state.evidence, noteMatches: result.matches }
        };
        return checkpoint(state, "search_notes", "draft_plan", dependencies.now);
      }
      case "draft_plan": {
        let rawProposal: unknown;
        if (state.mode === "bounded_agent") {
          try {
            rawProposal = await dependencies.proposePlan(state);
          } catch {
            rawProposal = await dependencies.deterministicPlan(state);
            state = appendTrace(
              { ...state, mode: "deterministic_workflow", fallbackReason: "provider_failure" },
              {
                node: "draft_plan",
                kind: "fallback",
                detail:
                  "The bounded-agent proposal failed; use the deterministic planning workflow.",
                tool: null,
                readOnly: null
              }
            );
          }
        } else {
          rawProposal = await dependencies.deterministicPlan(state);
        }
        const proposal = proposalSchema.safeParse(rawProposal);
        if (!proposal.success) {
          if (state.mode === "bounded_agent") {
            const fallback = proposalSchema.parse(await dependencies.deterministicPlan(state));
            rawProposal = fallback;
            state = appendTrace(
              { ...state, mode: "deterministic_workflow", fallbackReason: "provider_failure" },
              {
                node: "draft_plan",
                kind: "fallback",
                detail: "The agent returned an invalid proposal; use the deterministic workflow.",
                tool: null,
                readOnly: null
              }
            );
          } else {
            return terminal(
              state,
              "failed",
              "invalid_plan",
              "The deterministic workflow returned an invalid proposal."
            );
          }
        }
        const parsedProposal = proposalSchema.parse(rawProposal);
        const tokensUsed = state.budget.tokensUsed + parsedProposal.usage.tokens;
        const estimatedCostUsd =
          state.budget.estimatedCostUsd + parsedProposal.usage.estimatedCostUsd;
        if (tokensUsed > state.budget.maxTokens || estimatedCostUsd > state.budget.maxCostUsd) {
          return terminal(
            {
              ...state,
              budget: { ...state.budget, tokensUsed, estimatedCostUsd }
            },
            "failed",
            "budget_exhausted",
            "The proposal exceeded the token or cost budget."
          );
        }
        state = {
          ...state,
          draft: parsedProposal.actions,
          validationErrors: [],
          budget: { ...state.budget, tokensUsed, estimatedCostUsd }
        };
        return checkpoint(state, "draft_plan", "validate_plan", dependencies.now);
      }
      case "validate_plan": {
        const errors = validateDraft(state);
        state = appendTrace(
          { ...state, validationErrors: errors },
          {
            node: "validate_plan",
            kind: "validation",
            detail:
              errors.length === 0
                ? "The proposal satisfied the plan schema, roadmap, duplicate, and budget invariants."
                : `The proposal failed ${errors.length} invariant(s).`,
            tool: null,
            readOnly: null
          }
        );
        if (errors.length > 0) {
          if (
            state.mode === "bounded_agent" &&
            state.budget.attemptsUsed < state.budget.maxAttempts
          ) {
            const attempted = {
              ...state,
              mode: "deterministic_workflow" as const,
              fallbackReason: "provider_failure" as const,
              budget: {
                ...state.budget,
                attemptsUsed: state.budget.attemptsUsed + 1
              }
            };
            return checkpoint(attempted, "validate_plan", "draft_plan", dependencies.now);
          }
          return terminal(
            state,
            "failed",
            state.budget.attemptsUsed >= state.budget.maxAttempts
              ? "max_attempts_exhausted"
              : "invalid_plan",
            "The planner could not produce a valid bounded plan."
          );
        }
        return checkpoint(state, "validate_plan", "await_human_review", dependencies.now);
      }
      case "await_human_review":
        return terminal(
          state,
          "awaiting_approval",
          "awaiting_human_approval",
          state.approvalBehavior === "proposal_only"
            ? "Human review required. Approval records acceptance of this proposal only."
            : "Human review required before the approved plan can be persisted."
        );
      case "persist_approved_plan": {
        const decisionKey = state.decisionKeys.at(-1);
        if (decisionKey === undefined) {
          return terminal(state, "failed", "tool_validation_failed", "Approval key is missing.");
        }
        const executed = await executeTool(
          state,
          dependencies,
          "persist_week_plan",
          {
            userId: state.userId,
            runId: state.runId,
            idempotencyKey: decisionKey,
            actions: state.draft
          },
          true
        );
        persistedPlanResultSchema.parse(executed.result);
        return terminal(
          executed.state,
          "completed",
          "approved_by_human",
          "Human approval was verified before the weekly plan was persisted."
        );
      }
      case "terminal":
        return state;
    }
  } catch (error: unknown) {
    return toolFailure(state, error);
  }
}

export async function runPlannerGraph(
  initial: PlannerGraphState,
  dependencies: PlannerGraphDependencies,
  options: Readonly<{ maxNodeExecutions?: number }> = {}
): Promise<PlannerGraphState> {
  let state = initial;
  const maxNodeExecutions = options.maxNodeExecutions ?? Number.POSITIVE_INFINITY;
  let nodeExecutions = 0;
  while (state.status === "running" && nodeExecutions < maxNodeExecutions) {
    state = withWallTime(state, dependencies.clockMs);
    if (
      state.budget.stepsUsed >= state.budget.maxSteps ||
      state.budget.wallTimeMs > state.budget.maxWallTimeMs
    ) {
      return terminal(state, "failed", "budget_exhausted", "The graph execution budget expired.");
    }
    if (state.mode === "bounded_agent" && (await dependencies.isKillSwitchActive())) {
      state = appendTrace(
        { ...state, mode: "deterministic_workflow", fallbackReason: "kill_switch" },
        {
          node: state.nextNode,
          kind: "fallback",
          detail: "The global AI kill switch prevented bounded-agent execution.",
          tool: null,
          readOnly: null
        }
      );
    }
    const checkpointCount = state.checkpoints.length;
    state = await runNode(state, dependencies);
    if (
      state.checkpoints.length > checkpointCount &&
      dependencies.persistCheckpoint !== undefined
    ) {
      await dependencies.persistCheckpoint(state);
    }
    nodeExecutions += 1;
  }
  return withWallTime(state, dependencies.clockMs);
}

export async function applyPlannerHumanDecision(
  initial: PlannerGraphState,
  decision: Readonly<{
    action: "approve" | "revise" | "reject";
    idempotencyKey: string;
    note?: string;
  }>,
  dependencies: PlannerGraphDependencies
): Promise<PlannerGraphState> {
  if (initial.decisionKeys.includes(decision.idempotencyKey)) return initial;
  if (initial.status !== "awaiting_approval") {
    return terminal(
      initial,
      "failed",
      "invalid_plan",
      "A human decision is valid only while the graph awaits approval."
    );
  }
  let state = appendTrace(
    {
      ...initial,
      decisionKeys: [...initial.decisionKeys, decision.idempotencyKey],
      feedback:
        decision.note === undefined || decision.note.trim().length === 0
          ? initial.feedback
          : [...initial.feedback, decision.note.trim()]
    },
    {
      node: "await_human_review",
      kind: "human_decision",
      detail: `Human selected ${decision.action}.`,
      tool: null,
      readOnly: null
    }
  );
  if (decision.action === "reject") {
    return terminal(state, "cancelled", "rejected_by_human", "The learner rejected the proposal.");
  }
  if (decision.action === "revise") {
    if (state.budget.attemptsUsed >= state.budget.maxAttempts) {
      return terminal(
        state,
        "failed",
        "max_attempts_exhausted",
        "No planner revision attempts remain."
      );
    }
    state = {
      ...state,
      status: "running",
      node: "draft_plan",
      nextNode: "draft_plan",
      terminalReason: null,
      budget: { ...state.budget, attemptsUsed: state.budget.attemptsUsed + 1 }
    };
    return runPlannerGraph(state, dependencies);
  }
  if (state.approvalBehavior === "proposal_only") {
    return terminal(
      state,
      "completed",
      "approved_proposal_only",
      "The learner approved the proposal; no product state or external system was changed."
    );
  }
  state = {
    ...state,
    status: "running",
    node: "persist_approved_plan",
    nextNode: "persist_approved_plan",
    terminalReason: null
  };
  return runPlannerGraph(state, dependencies);
}
