import type { AccountUser, DayTaskPlan, PlannerRun } from "@codelift/contracts";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DayTaskManager, WorkspaceExperience } from "../features/workspace/WorkspaceExperience";
import { FocusOrbTimer } from "../features/workspace/components/SignatureGraphics";
import { jsonResponse } from "./fixtures";

const user: AccountUser = {
  id: "64f000000000000000000001",
  email: "learner@example.com",
  onboardingComplete: true,
  profile: {
    displayName: "Mathew",
    timezone: "America/Los_Angeles",
    startDate: "2026-07-24",
    commitmentMinutes: 30,
    preferredCodingTime: "20:30",
    routineCue: "the children are asleep",
    codingPlace: "my desk",
    implementationIntention:
      "Today at 20:30, after the children are asleep, I will code at my desk for 30 minutes.",
    whyItMatters: "Build useful AI products.",
    githubUsername: "",
    targetRoles: ["Full-Stack AI Application Engineer"],
    aiPrivacyMode: "local_only",
    themePreference: "system",
    motionPreference: "gentle"
  },
  createdAt: "2026-07-24T20:00:00.000Z"
};

const taskPlan: DayTaskPlan = {
  dayNumber: 1,
  status: "opened",
  estimateMinutes: 30,
  actualMinutes: 8,
  timerSeconds: 480,
  timerState: "paused",
  rescheduledFor: null,
  subtasks: [
    {
      id: "boundary-test",
      title: "Write the failing boundary test",
      estimateMinutes: 10,
      actualMinutes: 8,
      completed: false
    }
  ],
  nextSubtask: {
    id: "boundary-test",
    title: "Write the failing boundary test",
    estimateMinutes: 10,
    actualMinutes: 8,
    completed: false
  },
  updatedAt: "2026-07-24T20:08:00.000Z"
};

function plannerRun(
  status: PlannerRun["status"],
  terminalReason: PlannerRun["terminalReason"]
): PlannerRun {
  return {
    id: "64f000000000000000000099",
    mode: "deterministic_workflow",
    approvalBehavior: "proposal_only",
    status,
    actions: [
      {
        actionId: "plan-1-0",
        date: "2026-07-27",
        dayNumber: 1,
        mode: "core",
        minutes: 30,
        rationale: "Start with the next incomplete dependency-aware mission."
      }
    ],
    budget: {
      maxSteps: 8,
      stepsUsed: 1,
      maxTokens: 2_000,
      tokensUsed: 0,
      maxCostUsd: 0,
      estimatedCostUsd: 0,
      maxWallTimeMs: 5_000,
      wallTimeMs: 1
    },
    terminalReason,
    trace: ["Generated one read-only action.", `Stopped: ${terminalReason}.`],
    createdAt: "2026-07-24T20:00:00.000Z",
    updatedAt: "2026-07-24T20:00:00.000Z"
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("private workspace component flows", () => {
  it("persists pause/resume state without treating elapsed time as completion", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/tasks/1" && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(jsonResponse(taskPlan));
      }
      if (path === "/api/v1/tasks/1" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({
            ...taskPlan,
            timerState: "running",
            updatedAt: "2026-07-24T20:09:00.000Z"
          })
        );
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<DayTaskManager dayNumber={1} csrfToken={"a".repeat(43)} />);

    expect(await screen.findByText("Write the failing boundary test")).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "Resume saved timer" }));

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
        status: "opened",
        actualMinutes: 8,
        timerSeconds: 480,
        timerState: "running",
        subtasks: [{ id: "boundary-test", completed: false }]
      });
    });
    expect(
      await screen.findByText(
        "Task plan saved. Completion evidence remains a separate requirement."
      )
    ).toBeInTheDocument();
  });

  it("pauses the FocusOrb without losing elapsed time", () => {
    vi.useFakeTimers();
    render(<FocusOrbTimer />);

    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer")).toHaveAccessibleName("29 minutes 59 seconds remaining");

    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByRole("timer")).toHaveAccessibleName("29 minutes 59 seconds remaining");
    expect(screen.getByRole("button", { name: "Resume timer" })).toBeInTheDocument();
  });

  it("keeps nested async states below the single page heading", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = String(input);
      if (path === "/api/v1/reviews") {
        return Promise.resolve(jsonResponse({ due: [], upcoming: [], completed: [] }));
      }
      if (path === "/api/v1/reflections/periodic") {
        return new Promise<Response>(() => undefined);
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspaceExperience pathname="/app/reviews" csrfToken={"a".repeat(43)} user={user} />);

    expect(
      await screen.findByRole("heading", { name: "Prove what you can reconstruct." })
    ).toBeInTheDocument();
    expect(screen.getByText("Loading periodic reflections…")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("keeps nested error states below the single page heading", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = String(input);
      if (path === "/api/v1/reviews") {
        return Promise.resolve(jsonResponse({ due: [], upcoming: [], completed: [] }));
      }
      if (path === "/api/v1/reflections/periodic") {
        return Promise.reject(new Error("Periodic reflections are unavailable."));
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspaceExperience pathname="/app/reviews" csrfToken={"a".repeat(43)} user={user} />);

    expect(
      await screen.findByRole("heading", { name: "Prove what you can reconstruct." })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "CodeLift could not reach its Node API. Your saved data was not changed."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders a grounded note answer with a resolvable citation panel", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/notes") {
        return Promise.resolve(jsonResponse({ sources: [] }));
      }
      if (path === "/api/v1/search/notes" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            answer:
              "Runtime validation keeps network data unknown until the shared schema parses it.",
            abstained: false,
            generated: false,
            statements: [
              {
                text: "Runtime validation protects the network boundary.",
                support: "source_supported",
                citationChunkIds: ["chunk-0-abc123"]
              }
            ],
            citations: [
              {
                sourceId: "64f000000000000000000010",
                chunkId: "chunk-0-abc123",
                sourceTitle: "Runtime validation boundary",
                dayNumber: 1,
                excerpt: "Keep network values unknown until the runtime schema parses them.",
                score: 0.96
              }
            ],
            retrievalMode: "hybrid_mock",
            traceId: "64f000000000000000000011"
          })
        );
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<WorkspaceExperience pathname="/app/search" csrfToken={"a".repeat(43)} user={user} />);

    await actor.type(await screen.findByLabelText("Question"), "Why keep network input unknown?");
    await actor.click(screen.getByRole("button", { name: "Retrieve support" }));

    expect(await screen.findByText("Source-supported")).toBeInTheDocument();
    expect(screen.getByText("Runtime validation boundary")).toBeInTheDocument();
    expect(screen.getByText(/Keep network values unknown/)).toBeInTheDocument();
    expect(screen.getByText("Support score 0.96")).toBeInTheDocument();
  });

  it("requires an explicit planner decision and sends revision through the guarded route", async () => {
    const proposed = plannerRun("awaiting_approval", "awaiting_human_approval");
    const revised = plannerRun("revision_requested", "revision_requested");
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/planner/week" && init?.method === "POST") {
        return Promise.resolve(jsonResponse(proposed, 201));
      }
      if (path === `/api/v1/planner/${proposed.id}/revise` && init?.method === "POST") {
        return Promise.resolve(jsonResponse(revised));
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<WorkspaceExperience pathname="/app/planner" csrfToken={"a".repeat(43)} user={user} />);

    expect(
      screen.getByText("Nothing can schedule or message on your behalf from this state.")
    ).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "Propose a read-only week" }));

    expect(await screen.findByText(/awaiting human approval/)).toBeInTheDocument();
    expect(screen.getByText(/does not persist these actions as tasks/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept proposal only" })).toBeInTheDocument();
    expect(screen.getByText("Inspect node and tool trace")).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "Request smaller revision" }));

    await waitFor(() => {
      const decisionCall = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/revise"));
      expect(JSON.parse(String(decisionCall?.[1]?.body))).toMatchObject({
        note: "Please create a smaller plan.",
        expectedStatus: "awaiting_approval"
      });
    });
    expect((await screen.findAllByText(/revision requested/)).length).toBeGreaterThanOrEqual(1);
  });

  it("renders case-level expected and observed behavioral eval evidence", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = String(input);
      if (path === "/api/v1/ai/operations") {
        return Promise.resolve(
          jsonResponse({
            capabilities: [],
            traces: [],
            evalRuns: [
              {
                id: "64f000000000000000000099",
                datasetVersion: "local-behavior-v2",
                datasetHash: "a".repeat(64),
                evaluatorVersion: "behavioral-evaluator-v2.0.0",
                providerConfig: {
                  provider: "deterministic-fixture-adapters",
                  model: "synthetic-structured-model",
                  promptVersion: "coach-v1",
                  sampling: "deterministic-no-sampling",
                  externalCallsAllowed: false,
                  fixtureProfile: "synthetic-private-data-only",
                  datasetHashAlgorithm: "sha256",
                  redactionPolicy: "synthetic-fixtures-only"
                },
                passed: true,
                score: 1,
                passingScore: 1,
                criticalFailures: [],
                negativeControlsPassed: true,
                durationMs: 12,
                estimatedCostUsd: 0,
                cases: [
                  {
                    caseId: "coach-valid-strict-schema",
                    category: "schema",
                    critical: true,
                    scenarioKind: "coach",
                    input: { providerScenario: "valid" },
                    expectedBehavior:
                      "A schema-conformant provider response is accepted after runtime validation.",
                    expectedAssertions: [
                      {
                        assertionId: "schema-valid",
                        field: "schemaValid",
                        operator: "equals",
                        expected: true
                      }
                    ],
                    observed: { schemaValid: true, outcome: "success" },
                    assertions: [
                      {
                        assertionId: "schema-valid",
                        field: "schemaValid",
                        operator: "equals",
                        expected: true,
                        actual: true,
                        passed: true,
                        detail: "schemaValid satisfied equals."
                      }
                    ],
                    passed: true,
                    detail: "1 behavioral assertion passed.",
                    latencyMs: 1,
                    estimatedCostUsd: 0
                  }
                ],
                createdAt: "2026-08-06T12:00:00.000Z"
              }
            ],
            estimatedCostUsd: 0,
            killSwitchActive: false
          })
        );
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkspaceExperience pathname="/app/evals" csrfToken={"a".repeat(43)} user={user} />);

    expect(
      await screen.findByText("Expected behavior compared with observed output")
    ).toBeInTheDocument();
    expect(screen.getByText("coach-valid-strict-schema")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A schema-conformant provider response is accepted after runtime validation."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("schemaValid equals expected true; observed true")).toBeInTheDocument();
    expect(screen.getByText("schemaValid satisfied equals.")).toBeInTheDocument();
    expect(screen.getByText(/dataset hash aaaaaaaaaaaa/)).toBeInTheDocument();
  });
});
