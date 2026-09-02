import type { PlannerRequest } from "@codelift/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  applyPlannerHumanDecision,
  createPlannerGraphState,
  parsePlannerGraphState,
  PlannerToolRegistry,
  runPlannerGraph,
  type PlannerGraphDependencies,
  type PlannerGraphState,
  type PlannerToolName
} from "../learning/planner-graph.js";

const startedAt = new Date("2026-08-03T12:00:00.000Z");

const request: PlannerRequest = {
  weekStart: "2026-08-03",
  availableMinutes: 90,
  priorities: ["typed state", "retrieval"],
  idempotencyKey: "planner-create-one"
};

function proposal(state: PlannerGraphState) {
  return {
    actions: state.evidence.roadmapDays.slice(0, 3).map((day, index) => ({
      actionId: `action-${day.dayNumber}`,
      date: `2026-08-0${index + 3}`,
      dayNumber: day.dayNumber,
      mode: "core" as const,
      minutes: 30,
      rationale: `Practice ${day.title} within the authorized weekly budget.`
    })),
    usage: { tokens: state.mode === "bounded_agent" ? 120 : 0, estimatedCostUsd: 0 }
  };
}

function harness(
  options: {
    killSwitch?: boolean;
    denyTool?: PlannerToolName;
    invalidResultTool?: PlannerToolName;
    proposal?: (state: PlannerGraphState) => Promise<unknown>;
    deterministic?: (state: PlannerGraphState) => Promise<unknown>;
  } = {}
) {
  const toolCalls: PlannerToolName[] = [];
  let clock = startedAt.getTime();
  const persist = vi.fn(async (input: unknown) => {
    void input;
    return { planId: "approved-plan-1", persisted: true as const };
  });
  const registry = new PlannerToolRegistry({
    authorize: async ({ tool }) => tool !== options.denyTool,
    handlers: {
      get_progress: async () => {
        toolCalls.push("get_progress");
        if (options.invalidResultTool === "get_progress") return { currentDayNumber: "one" };
        return { currentDayNumber: 309, incompleteDayNumbers: [309, 310, 311] };
      },
      get_curriculum_roadmap: async () => {
        toolCalls.push("get_curriculum_roadmap");
        if (options.invalidResultTool === "get_curriculum_roadmap") return { days: [] };
        return {
          days: Array.from({ length: 7 }, (_, index) => ({
            dayNumber: 309 + index,
            title: `Bounded planning concept ${index + 1}`,
            prerequisiteDayNumbers: index === 0 ? [308] : [308 + index]
          }))
        };
      },
      get_time_budget: async () => {
        toolCalls.push("get_time_budget");
        return { availableMinutes: request.availableMinutes };
      },
      search_notes: async () => {
        toolCalls.push("search_notes");
        return {
          matches: [{ sourceId: "note-1", snippet: "Typed state preserves audit evidence." }]
        };
      },
      persist_week_plan: async (input) => {
        toolCalls.push("persist_week_plan");
        return persist(input);
      }
    }
  });
  const proposePlan = vi.fn(options.proposal ?? (async (state) => proposal(state)));
  const deterministicPlan = vi.fn(
    options.deterministic ??
      (async (state) => proposal({ ...state, mode: "deterministic_workflow" }))
  );
  const dependencies: PlannerGraphDependencies = {
    tools: registry,
    proposePlan,
    deterministicPlan,
    isKillSwitchActive: async () => options.killSwitch ?? false,
    now: () => new Date(clock),
    clockMs: () => clock
  };
  return {
    dependencies,
    deterministicPlan,
    persist,
    proposePlan,
    registry,
    toolCalls,
    advanceClock(milliseconds: number) {
      clock += milliseconds;
    }
  };
}

function initial(
  overrides: Partial<Parameters<typeof createPlannerGraphState>[0]> = {}
): PlannerGraphState {
  return createPlannerGraphState({
    runId: "run-1",
    userId: "user-1",
    mode: "bounded_agent",
    request,
    now: startedAt,
    ...overrides
  });
}

describe("bounded planner graph", () => {
  it("round-trips the initial persisted state before evidence gathering", () => {
    const state = initial();

    expect(parsePlannerGraphState(structuredClone(state))).toEqual(state);
  });

  it("validates persisted graph state at the runtime boundary", async () => {
    const testHarness = harness();
    const valid = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(parsePlannerGraphState(structuredClone(valid))).toEqual(valid);
    expect(() =>
      parsePlannerGraphState({
        ...valid,
        budget: { ...valid.budget, tokensUsed: valid.budget.maxTokens + 1 }
      })
    ).toThrow(/tokensUsed exceeds its configured maximum/u);
    expect(() => parsePlannerGraphState({ ...valid, graphVersion: "planner-graph-v0" })).toThrow();
  });

  it("runs typed nodes with only authorized read-only tools before human review", async () => {
    const testHarness = harness();

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result).toMatchObject({
      graphVersion: "planner-graph-v1",
      mode: "bounded_agent",
      status: "awaiting_approval",
      node: "await_human_review",
      terminalReason: "awaiting_human_approval",
      validationErrors: []
    });
    expect(result.draft).toHaveLength(3);
    expect(result.checkpoints.map((entry) => entry.node)).toEqual([
      "gather_progress",
      "gather_roadmap",
      "gather_time_budget",
      "search_notes",
      "draft_plan",
      "validate_plan"
    ]);
    expect(testHarness.toolCalls).toEqual([
      "get_progress",
      "get_curriculum_roadmap",
      "get_time_budget",
      "search_notes"
    ]);
    expect(result.trace.filter((event) => event.kind === "tool_called")).toSatisfy(
      (events: PlannerGraphState["trace"]) => events.every((event) => event.readOnly === true)
    );
    expect(testHarness.persist).not.toHaveBeenCalled();
  });

  it("prevents bounded-agent execution when the global kill switch is active", async () => {
    const testHarness = harness({ killSwitch: true });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result.mode).toBe("deterministic_workflow");
    expect(result.fallbackReason).toBe("kill_switch");
    expect(result.status).toBe("awaiting_approval");
    expect(testHarness.proposePlan).not.toHaveBeenCalled();
    expect(testHarness.deterministicPlan).toHaveBeenCalledOnce();
  });

  it("falls back deterministically when the agent proposal fails", async () => {
    const testHarness = harness({
      proposal: async () => {
        throw new Error("provider timeout");
      }
    });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result).toMatchObject({
      mode: "deterministic_workflow",
      fallbackReason: "provider_failure",
      status: "awaiting_approval"
    });
    expect(testHarness.deterministicPlan).toHaveBeenCalledOnce();
    expect(result.trace.some((event) => event.kind === "fallback")).toBe(true);
  });

  it("fails closed when a tool returns a result outside its runtime schema", async () => {
    const testHarness = harness({ invalidResultTool: "get_progress" });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result).toMatchObject({ status: "failed", terminalReason: "tool_validation_failed" });
    expect(result.draft).toEqual([]);
  });

  it("checks authorization at execution time for every tool", async () => {
    const testHarness = harness({ denyTool: "search_notes" });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result).toMatchObject({ status: "failed", terminalReason: "tool_unauthorized" });
    expect(testHarness.proposePlan).not.toHaveBeenCalled();
  });

  it("resumes from a persisted checkpoint without replaying completed tool calls", async () => {
    const testHarness = harness();
    const interrupted = await runPlannerGraph(initial(), testHarness.dependencies, {
      maxNodeExecutions: 1
    });

    expect(interrupted.status).toBe("running");
    expect(interrupted.nextNode).toBe("gather_roadmap");
    expect(testHarness.toolCalls).toEqual(["get_progress"]);

    const resumed = await runPlannerGraph(structuredClone(interrupted), testHarness.dependencies);

    expect(resumed.status).toBe("awaiting_approval");
    expect(testHarness.toolCalls.filter((name) => name === "get_progress")).toHaveLength(1);
    expect(new Set(resumed.checkpoints.map((entry) => entry.checkpointId)).size).toBe(
      resumed.checkpoints.length
    );
  });

  it("persists every repeat-safe checkpoint before advancing", async () => {
    const testHarness = harness();
    const persistCheckpoint = vi.fn(async (state: PlannerGraphState) => {
      expect(state.checkpoints.at(-1)?.nextNode).toBe(state.nextNode);
    });

    const result = await runPlannerGraph(initial(), {
      ...testHarness.dependencies,
      persistCheckpoint
    });

    expect(result.status).toBe("awaiting_approval");
    expect(persistCheckpoint).toHaveBeenCalledTimes(result.checkpoints.length);
    expect(persistCheckpoint).toHaveBeenCalledTimes(6);
  });

  it("detects duplicate actions and uses one bounded deterministic repair attempt", async () => {
    const testHarness = harness({
      proposal: async (state) => {
        const valid = proposal(state);
        const first = valid.actions[0];
        if (first === undefined) throw new Error("Expected a proposed action.");
        return { ...valid, actions: [first, first] };
      }
    });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result.status).toBe("awaiting_approval");
    expect(result.mode).toBe("deterministic_workflow");
    expect(result.budget.attemptsUsed).toBe(2);
    expect(testHarness.deterministicPlan).toHaveBeenCalledOnce();
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "validation", detail: expect.stringContaining("failed") })
      ])
    );
  });

  it("terminates when a proposal exceeds its token or cost budget", async () => {
    const testHarness = harness({
      proposal: async (state) => ({
        ...proposal(state),
        usage: { tokens: 2_001, estimatedCostUsd: 0 }
      })
    });

    const result = await runPlannerGraph(initial(), testHarness.dependencies);

    expect(result).toMatchObject({ status: "failed", terminalReason: "budget_exhausted" });
    expect(result.draft).toEqual([]);
  });

  it("records proposal-only approval accurately and performs no side effect", async () => {
    const testHarness = harness();
    const awaiting = await runPlannerGraph(initial(), testHarness.dependencies);

    const approved = await applyPlannerHumanDecision(
      awaiting,
      { action: "approve", idempotencyKey: "approve-proposal-one" },
      testHarness.dependencies
    );

    expect(approved).toMatchObject({
      status: "completed",
      terminalReason: "approved_proposal_only"
    });
    expect(testHarness.persist).not.toHaveBeenCalled();
    expect(approved.trace.at(-1)?.detail).toContain("no product state");
  });

  it("permits a validated side effect only after approval and prevents duplicate persistence", async () => {
    const testHarness = harness();
    const awaiting = await runPlannerGraph(
      initial({ approvalBehavior: "persist_on_approval" }),
      testHarness.dependencies
    );

    const approved = await applyPlannerHumanDecision(
      awaiting,
      { action: "approve", idempotencyKey: "persist-approved-one" },
      testHarness.dependencies
    );
    const replayed = await applyPlannerHumanDecision(
      approved,
      { action: "approve", idempotencyKey: "persist-approved-one" },
      testHarness.dependencies
    );

    expect(approved).toMatchObject({ status: "completed", terminalReason: "approved_by_human" });
    expect(testHarness.persist).toHaveBeenCalledOnce();
    expect(replayed).toEqual(approved);
  });

  it("rejects direct side-effect tool use without human approval", async () => {
    const testHarness = harness();

    await expect(
      testHarness.registry.execute(
        "persist_week_plan",
        {
          userId: "user-1",
          runId: "run-1",
          idempotencyKey: "persist-without-approval",
          actions: [
            {
              actionId: "action-309",
              date: "2026-08-03",
              dayNumber: 309,
              mode: "core",
              minutes: 30,
              rationale: "Use a valid action to isolate the approval boundary."
            }
          ]
        },
        { userId: "user-1", runId: "run-1", humanApproved: false }
      )
    ).rejects.toMatchObject({ code: "TOOL_APPROVAL_REQUIRED" });
    expect(testHarness.persist).not.toHaveBeenCalled();
  });

  it("bounds human-requested revision loops with a terminal attempt reason", async () => {
    const testHarness = harness();
    const awaiting = await runPlannerGraph(initial(), testHarness.dependencies);
    const revised = await applyPlannerHumanDecision(
      awaiting,
      { action: "revise", idempotencyKey: "revision-attempt-one", note: "Prefer retrieval." },
      testHarness.dependencies
    );

    expect(revised.status).toBe("awaiting_approval");
    expect(revised.budget.attemptsUsed).toBe(2);

    const exhausted = await applyPlannerHumanDecision(
      revised,
      { action: "revise", idempotencyKey: "revision-attempt-two" },
      testHarness.dependencies
    );
    expect(exhausted).toMatchObject({
      status: "failed",
      terminalReason: "max_attempts_exhausted"
    });
  });

  it("enforces the wall-time budget across resumed execution", async () => {
    const testHarness = harness();
    const interrupted = await runPlannerGraph(initial(), testHarness.dependencies, {
      maxNodeExecutions: 1
    });
    testHarness.advanceClock(5_001);

    const expired = await runPlannerGraph(interrupted, testHarness.dependencies);

    expect(expired).toMatchObject({ status: "failed", terminalReason: "budget_exhausted" });
  });
});
