import type {
  DashboardResponse,
  ErrorMuseumEntry,
  PortfolioResponse,
  ReviewsResponse,
  RoadmapResponse,
  SkillsResponse
} from "@codelift/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { AppShell } from "../components/AppShell";
import { GalleryPage } from "../features/gallery/GalleryPage";
import { SearchRagPage } from "../features/search/SearchRagPage";
import { TasksPage } from "../features/tasks/TasksPage";
import { learningApi } from "../features/workspace/api/learningApi";
import { jsonResponse, verifiedMissionFixture } from "./fixtures";

const now = "2026-08-06T20:00:00.000Z";
const summary = {
  currentDayNumber: 1,
  coreCompletions: 0,
  recoveryWins: 0,
  intentionalSkips: 0,
  totalReturns: 0,
  currentStreak: 0,
  longestStreak: 0,
  rolling7DayReturns: 0,
  rolling30DayReturns: 0,
  xp: 0,
  graceTokensAvailable: 1
} as const;
const journey = Array.from({ length: 365 }, (_, index) => ({
  dayNumber: index + 1,
  monthNumber: Math.min(12, Math.ceil((index + 1) / 31)),
  status: "not_started" as const,
  selectedMode: null
}));

const dashboard: DashboardResponse = {
  generatedAt: now,
  day: verifiedMissionFixture,
  summary,
  journey,
  reviewsDue: [],
  portfolioFocus: null,
  missedCalendarDays: 0,
  recentEvidence: [
    {
      dayNumber: 1,
      label: "Boundary test screenshot",
      kind: "screenshot_url",
      createdAt: now
    }
  ]
};

const roadmap: RoadmapResponse = {
  summary,
  milestones: Array.from({ length: 12 }, (_, index) => ({
    monthNumber: index + 1,
    title: `Month ${index + 1}`,
    focus: "Reliable full-stack AI boundaries",
    portfolioEvidence: "A tested vertical slice",
    completedDays: 0,
    totalDays: index === 11 ? 24 : 31
  })),
  days: journey,
  sevenDayPreview: [verifiedMissionFixture]
};

const reviews: ReviewsResponse = {
  due: [
    {
      id: "64f000000000000000000021",
      sourceDayNumber: 1,
      intervalDays: 1,
      dueDate: "2026-08-06",
      prompt: "Explain why network JSON remains unknown.",
      status: "due",
      question: "Where does runtime validation belong?",
      closedNote: true,
      confidenceBefore: null,
      confidenceAfter: null,
      answer: "",
      completedAt: null
    }
  ],
  upcoming: [],
  completed: []
};

const skills: SkillsResponse = {
  skills: [
    {
      skill: "runtime validation",
      state: "practiced",
      introducedDay: 1,
      practicedCount: 1,
      demonstratedCount: 0,
      prerequisiteSkills: ["TypeScript"],
      evidenceDayNumbers: [1]
    }
  ],
  counts: { introduced: 0, practiced: 1, demonstrated: 0 }
};

const portfolio: PortfolioResponse = {
  artifacts: [
    {
      id: "64f000000000000000000022",
      artifactKey: "validated-api-boundary",
      title: "Validated API boundary",
      monthNumber: 1,
      status: "draft",
      repositoryUrl: null,
      demoUrl: null,
      screenshotUrls: [],
      skillsProven: ["runtime validation"],
      testsAndEvals: ["malformed response test"],
      tradeoffs: [],
      limitations: [],
      interviewQuestions: [],
      evidenceLinks: [],
      updatedAt: now
    }
  ]
};

const errors: ErrorMuseumEntry[] = [
  {
    id: "64f000000000000000000023",
    title: "Trusted an unparsed payload",
    dayNumber: 1,
    bug: "The UI read unknown JSON directly.",
    hypothesis: "A runtime schema is missing.",
    evidence: "A malformed fixture rendered.",
    fix: "Parse with the shared strict schema.",
    test: "malformed payload returns an error",
    lesson: "Static types do not validate network bytes.",
    tags: ["validation", "http"],
    createdAt: now,
    updatedAt: now
  }
];

function mockTaskApis() {
  vi.spyOn(learningApi, "dashboard").mockResolvedValue(dashboard);
  vi.spyOn(learningApi, "errors").mockResolvedValue({ entries: errors });
  vi.spyOn(learningApi, "portfolio").mockResolvedValue(portfolio);
  vi.spyOn(learningApi, "reviews").mockResolvedValue(reviews);
  vi.spyOn(learningApi, "roadmap").mockResolvedValue(roadmap);
  vi.spyOn(learningApi, "skills").mockResolvedValue(skills);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("task, RAG, and gallery surfaces", () => {
  it("builds a backlog and searches structured cross-content metadata separately from RAG", async () => {
    mockTaskApis();
    const actor = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Find the next useful piece of work." })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backlog" })).toBeInTheDocument();
    expect(screen.getAllByText(verifiedMissionFixture.buildTask).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Explain why network JSON remains unknown.")).toBeInTheDocument();
    expect(
      screen.getByText(/never reads private note bodies or indexed RAG chunks/i)
    ).toBeInTheDocument();

    await actor.selectOptions(screen.getByLabelText("Filter by content type"), "confusion_tag");
    expect(screen.getByText("validation")).toBeInTheDocument();
    expect(screen.queryByText("runtime validation")).not.toBeInTheDocument();

    await actor.clear(screen.getByLabelText("Search task and learning metadata"));
    await actor.type(screen.getByLabelText("Search task and learning metadata"), "http");
    expect(screen.getByText("http")).toBeInTheDocument();
    expect(screen.queryByText("validation")).not.toBeInTheDocument();

    await actor.clear(screen.getByLabelText("Search task and learning metadata"));
    await actor.type(
      screen.getByLabelText("Search task and learning metadata"),
      "no-such-catalog-value"
    );
    await actor.selectOptions(screen.getByLabelText("Filter by content type"), "resource");
    expect(screen.getByText("0 matching metadata records.")).toBeInTheDocument();
    await actor.clear(screen.getByLabelText("Search task and learning metadata"));
    expect(screen.getAllByRole("link", { name: "Open verified resource" }).length).toBeGreaterThan(
      0
    );
  });

  it("confirms indexed-source deletion, sends CSRF, reloads sources, and clears cited results", async () => {
    const csrfToken = "a".repeat(43);
    const source = {
      id: "64f000000000000000000010",
      title: "Runtime validation boundary",
      dayNumber: 1,
      content: "Keep network values unknown until the runtime schema parses them.",
      contentHash: "b".repeat(64),
      version: 1,
      chunkCount: 1,
      updatedAt: now
    };
    let noteReads = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/notes" && method === "GET") {
        noteReads += 1;
        return Promise.resolve(jsonResponse({ sources: noteReads === 1 ? [source] : [] }));
      }
      if (path === "/api/v1/search/notes" && method === "POST") {
        return Promise.resolve(
          jsonResponse({
            answer: "Runtime validation protects the network boundary.",
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
                sourceId: source.id,
                chunkId: "chunk-0-abc123",
                sourceTitle: source.title,
                dayNumber: 1,
                excerpt: source.content,
                score: 0.96
              }
            ],
            retrievalMode: "hybrid_mock",
            traceId: "64f000000000000000000011"
          })
        );
      }
      if (path === `/api/v1/notes/${source.id}` && method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.reject(new Error(`Unexpected test request: ${method} ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(
      <MemoryRouter>
        <SearchRagPage csrfToken={csrfToken} />
      </MemoryRouter>
    );

    await actor.type(await screen.findByLabelText("Question"), "Why validate network input?");
    await actor.click(screen.getByRole("button", { name: "Retrieve support" }));
    expect(await screen.findByText("Source-supported")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: `Delete ${source.title}` }));
    expect(
      screen.getByText(/Delete indexed source .* and all 1 derived chunk/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm source deletion" })).toHaveFocus();

    await actor.click(screen.getByRole("button", { name: "Keep source" }));
    expect(screen.getByRole("button", { name: `Delete ${source.title}` })).toHaveFocus();

    await actor.click(screen.getByRole("button", { name: `Delete ${source.title}` }));
    const confirmDeletion = screen.getByRole("button", { name: "Confirm source deletion" });
    expect(confirmDeletion).toHaveFocus();
    await actor.click(confirmDeletion);

    expect(await screen.findByText("No private sources are indexed yet.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Indexed sources" })).toHaveFocus()
    );
    expect(screen.queryByText("Source-supported")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Delete ${source.title}` })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Deleted .* and every derived chunk from your private index/)
    ).toBeInTheDocument();

    const deleteCall = fetchMock.mock.calls.find(
      ([path, init]) => String(path) === `/api/v1/notes/${source.id}` && init?.method === "DELETE"
    );
    expect(deleteCall?.[1]).toMatchObject({
      credentials: "include",
      headers: expect.objectContaining({ "X-CSRF-Token": csrfToken })
    });
    expect(noteReads).toBe(2);
  });

  it("renders every isolated gallery state without fetching learner data", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<GalleryPage />);

    for (const title of [
      "New user",
      "Active day",
      "Core complete",
      "Recovery complete",
      "Missed return",
      "Grace token",
      "Milestone",
      "Empty",
      "Loading",
      "API error",
      "AI timeout",
      "AI refusal",
      "AI schema error",
      "RAG no-evidence",
      "Agent awaiting approval",
      "Reduced motion",
      "Narrow mobile",
      "Dark theme"
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    expect(container.querySelectorAll("[data-gallery-state]")).toHaveLength(18);
    expect(container.querySelector('[data-motion="reduced"]')).toBeInTheDocument();
    expect(container.querySelector('[data-viewport="320px"]')).toBeInTheDocument();
    expect(container.querySelector('[data-theme="dark"]')).toBeInTheDocument();
    expect(
      screen.getByText(
        "No indexed chunk met the support threshold. Add evidence or ask a narrower question."
      )
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes Tasks and clearly names private-note RAG in workspace navigation", () => {
    render(
      <MemoryRouter>
        <AppShell privateMode>
          <p>Workspace</p>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/app/tasks");
    expect(screen.getByRole("link", { name: "Private-note RAG" })).toHaveAttribute(
      "href",
      "/app/search"
    );
  });
});
