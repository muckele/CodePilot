import { describe, expect, it } from "vitest";

import {
  authenticatedTodayResponseSchema,
  authSessionResponseSchema,
  curriculumBlueprintSchema,
  curriculumDayResponseSchema,
  curriculumResourceSchema,
  curriculumSeedDaySchema,
  createJobApplicationRequestSchema,
  dayTaskPlanSchema,
  onboardingRequestSchema,
  problemDetailsSchema,
  progressEvidenceRequestSchema,
  progressReflectionRequestSchema,
  progressStatusRequestSchema,
  registerRequestSchema,
  updatePortfolioArtifactRequestSchema,
  updateDayTaskPlanRequestSchema,
  updatePeriodicReflectionRequestSchema,
  type CurriculumDayResponse,
  type CurriculumSeedDay
} from "../src/index.js";

const seedDay: CurriculumSeedDay = {
  dayNumber: 1,
  weekNumber: 1,
  monthNumber: 1,
  phaseTitle: "Developer Reset and Web Foundations",
  weekTitle: "Environment, identity, shell, and Git",
  modeLabel: "Concept and first example",
  title: "Define the developer identity and learning contract",
  learningSeed: "Return, build one artifact, and record evidence.",
  buildTask: "Create a README.",
  corePrinciple: "Observable systems are easier to improve.",
  retrievalQuestion: "What proves that today counted?",
  tinyArtifact: "A committed README.",
  recoveryTask: "Write one bullet and make one tiny edit.",
  optionalStretchSeed: "Add a three-sentence teach-back.",
  coreSchedule: [
    { label: "Preview", minutes: 3 },
    { label: "Focused resource", minutes: 10 },
    { label: "Example or code", minutes: 12 },
    { label: "Closed-note recall and commit", minutes: 5 }
  ],
  skillTags: ["git"],
  resourceIds: ["example"],
  resourceLinks: [
    {
      id: "example",
      provider: "Example",
      title: "Example course",
      url: "https://example.com/course",
      type: "course"
    }
  ],
  prerequisiteDayNumbers: []
};

const runtimeDay: CurriculumDayResponse = {
  ...seedDay,
  learningObjective: "Build and explain a committed learning contract.",
  whyItMattersForAIEngineering:
    "Visible evidence makes AI application engineering progress inspectable.",
  mentalModel: "Treat learning as an observable state transition.",
  commonMistake: "Finishing steps without checking the artifact.",
  recoveryMinutes: 5,
  optionalStretchMinutes: 10,
  resourceLinks: seedDay.resourceLinks.map((resource) => ({
    ...resource,
    topicHint: "Read only the section needed for today's artifact.",
    lastCheckedStatus: "source_verified"
  })),
  knowledgeChecks: [
    {
      id: "day-1-recall",
      kind: "recall",
      prompt: "What proves that today counted?",
      hint: "Name observable evidence.",
      explanation: "A committed artifact makes the work inspectable."
    },
    {
      id: "day-1-application",
      kind: "application",
      prompt: "What changes when the artifact is committed?",
      hint: "Compare before and after.",
      explanation: "The repository now contains durable evidence."
    },
    {
      id: "day-1-explanation",
      kind: "explanation",
      prompt: "Why is observable evidence useful?",
      hint: "Consider feedback.",
      explanation: "Evidence makes progress and errors inspectable."
    }
  ],
  teachBackPrompt: "Explain the state, action, and evidence in three sentences.",
  retrievalPrompts: [
    "What proves that today counted?",
    "What evidence would disprove completion?",
    "Which shortcut hides the result?"
  ],
  acceptableEvidenceTypes: [
    "commit_url",
    "test_name",
    "screenshot_url",
    "demo_url",
    "text_explanation",
    "local_artifact_path"
  ]
};

describe("curriculum contracts", () => {
  it("parses a strict seed day and the direct API response", () => {
    expect(curriculumSeedDaySchema.parse(seedDay)).toEqual(seedDay);
    expect(curriculumDayResponseSchema.parse(runtimeDay)).toEqual(runtimeDay);
  });

  it("rejects non-HTTPS curriculum resources", () => {
    expect(() =>
      curriculumResourceSchema.parse({
        provider: "Example",
        title: "Unsafe",
        url: "http://example.com",
        type: "docs"
      })
    ).toThrow();
  });

  it("rejects unknown seed-day fields instead of silently stripping them", () => {
    expect(() =>
      curriculumSeedDaySchema.parse({
        ...seedDay,
        knowledgeChecks: []
      })
    ).toThrow();
  });

  it("parses the top-level blueprint shape", () => {
    const [resourceLink] = seedDay.resourceLinks;
    if (resourceLink === undefined) {
      throw new Error("Test fixture must contain a resource.");
    }
    const catalogResource = {
      provider: resourceLink.provider,
      title: resourceLink.title,
      url: resourceLink.url,
      type: resourceLink.type
    };

    const parsed = curriculumBlueprintSchema.parse({
      schemaVersion: "2.0.0",
      title: "Test blueprint",
      targetRoles: ["Engineer"],
      dailyCoreMinutes: 30,
      recoveryMinutesMax: 5,
      optionalStretchMinutesMax: 10,
      resourceCatalog: {
        example: catalogResource
      },
      weeks: [
        {
          weekNumber: 1,
          monthNumber: 1,
          phaseTitle: seedDay.phaseTitle,
          title: seedDay.weekTitle,
          milestone: "One verified artifact.",
          skillTags: ["git"]
        }
      ],
      days: [seedDay]
    });

    expect(parsed.schemaVersion).toBe("2.0.0");
  });
});

describe("problem details contract", () => {
  it("accepts an RFC-style application problem", () => {
    const problem = {
      type: "https://codelift.local/problems/invalid-day-number",
      title: "Invalid day number",
      status: 400,
      detail: "Day number must be an integer from 1 through 365.",
      instance: "/api/v1/curriculum/not-a-number",
      requestId: "request-123"
    };

    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it("rejects success status codes and unknown extensions", () => {
    expect(() =>
      problemDetailsSchema.parse({
        type: "about:blank",
        title: "Not a problem",
        status: 200
      })
    ).toThrow();

    expect(() =>
      problemDetailsSchema.parse({
        type: "about:blank",
        title: "Invalid request",
        status: 400,
        stack: "must not cross the API boundary"
      })
    ).toThrow();
  });
});

describe("account and progress contracts", () => {
  const profile = {
    displayName: "Mathew",
    timezone: "America/Los_Angeles",
    startDate: "2026-07-24",
    commitmentMinutes: 30,
    preferredCodingTime: "20:30",
    routineCue: "the children are asleep",
    codingPlace: "my desk",
    implementationIntention:
      "Today at 20:30, after the children are asleep, I will code at my desk for 30 minutes.",
    whyItMatters: "I want to build a durable bridge into applied AI engineering.",
    githubUsername: "mathew-builds",
    targetRoles: ["Full-Stack AI Application Engineer"],
    aiPrivacyMode: "local_only",
    themePreference: "system",
    motionPreference: "gentle",
    reviewPreference: "before_mission"
  } as const;

  it("normalizes email and rejects short passwords or unknown registration fields", () => {
    expect(
      registerRequestSchema.parse({
        email: "  MATHEW@example.com ",
        password: "a deliberately long password"
      })
    ).toEqual({
      email: "mathew@example.com",
      password: "a deliberately long password"
    });

    expect(() =>
      registerRequestSchema.parse({
        email: "mathew@example.com",
        password: "short"
      })
    ).toThrow();

    expect(() =>
      registerRequestSchema.parse({
        email: "mathew@example.com",
        password: "a deliberately long password",
        passwordConfirmation: "must stay in the browser"
      })
    ).toThrow();
  });

  it("validates the complete onboarding contract", () => {
    expect(onboardingRequestSchema.parse(profile)).toEqual(profile);
    const legacyProfile: Record<string, unknown> = { ...profile };
    delete legacyProfile.reviewPreference;
    expect(onboardingRequestSchema.parse(legacyProfile)).toEqual(legacyProfile);
    expect(() =>
      onboardingRequestSchema.parse({
        ...profile,
        commitmentMinutes: 15
      })
    ).toThrow();
    expect(() =>
      onboardingRequestSchema.parse({
        ...profile,
        reviewPreference: "disable_reviews"
      })
    ).toThrow();
    expect(() =>
      onboardingRequestSchema.parse({
        ...profile,
        startDate: "2026-02-30"
      })
    ).toThrow();
    expect(() =>
      onboardingRequestSchema.parse({
        ...profile,
        timezone: "Mars/Olympus_Mons"
      })
    ).toThrow();
  });

  it("requires HTTPS for URL evidence and bounds reflection values", () => {
    expect(
      progressEvidenceRequestSchema.parse({
        kind: "commit_url",
        label: "Day 1 commit",
        value: "https://github.com/example/codelift/commit/abc",
        idempotencyKey: "day1-evidence-1"
      })
    ).toMatchObject({ kind: "commit_url" });

    expect(() =>
      progressEvidenceRequestSchema.parse({
        kind: "commit_url",
        label: "Unsafe",
        value: "http://example.com/commit",
        idempotencyKey: "day1-evidence-2"
      })
    ).toThrow();

    expect(() =>
      progressReflectionRequestSchema.parse({
        confused: "x".repeat(1_001),
        mentalModelChanged: "",
        retrieveLater: "",
        idempotencyKey: "day1-reflection"
      })
    ).toThrow();
  });

  it("keeps Core and Recovery as explicit progress modes", () => {
    expect(
      progressStatusRequestSchema.parse({
        intent: "complete",
        mode: "recovery",
        idempotencyKey: "day1-complete-recovery",
        expectedVersion: 2
      })
    ).toEqual({
      intent: "complete",
      mode: "recovery",
      idempotencyKey: "day1-complete-recovery",
      expectedVersion: 2
    });
  });

  it("validates task plans, periodic reflections, and career evidence", () => {
    const subtask = {
      id: "test-first-boundary",
      title: "Write the failing boundary test",
      estimateMinutes: 10,
      actualMinutes: 8,
      completed: false
    };
    expect(
      dayTaskPlanSchema.parse({
        dayNumber: 1,
        status: "opened",
        estimateMinutes: 30,
        actualMinutes: 8,
        timerSeconds: 480,
        timerState: "paused",
        rescheduledFor: null,
        subtasks: [subtask],
        nextSubtask: subtask,
        updatedAt: null
      })
    ).toMatchObject({ dayNumber: 1, nextSubtask: subtask });
    expect(() =>
      updateDayTaskPlanRequestSchema.parse({
        status: "opened",
        estimateMinutes: 30,
        actualMinutes: 0,
        timerSeconds: 0,
        timerState: "paused",
        rescheduledFor: null,
        subtasks: [subtask, subtask],
        idempotencyKey: "duplicate-subtasks"
      })
    ).toThrow();
    expect(
      updatePeriodicReflectionRequestSchema.parse({
        weeklySummary: "One evidence-backed return.",
        monthlyRetrospective: "",
        idempotencyKey: "weekly-reflection-contract"
      })
    ).toMatchObject({ monthlyRetrospective: "" });
    expect(
      createJobApplicationRequestSchema.parse({
        company: "Example Product Lab",
        role: "Full-Stack AI Application Engineer",
        status: "researching",
        evidenceLinks: ["https://example.com/portfolio"],
        nextAction: "Map two role requirements to portfolio evidence.",
        idempotencyKey: "job-application-contract"
      })
    ).toMatchObject({ status: "researching" });
    expect(() =>
      updateDayTaskPlanRequestSchema.parse({
        status: "rescheduled",
        estimateMinutes: 30,
        actualMinutes: 0,
        timerSeconds: 0,
        timerState: "paused",
        rescheduledFor: "2026-13-40",
        subtasks: [subtask],
        idempotencyKey: "invalid-reschedule-date"
      })
    ).toThrow();
    expect(() =>
      updatePortfolioArtifactRequestSchema.parse({
        status: "draft",
        repositoryUrl: "javascript:alert(1)",
        demoUrl: null,
        screenshotUrls: [],
        skillsProven: [],
        testsAndEvals: [],
        tradeoffs: [],
        limitations: [],
        interviewQuestions: [],
        evidenceLinks: []
      })
    ).toThrow();
  });

  it("parses authenticated session and Today aggregate responses", () => {
    const user = {
      id: "64f000000000000000000001",
      email: "mathew@example.com",
      onboardingComplete: true,
      profile,
      createdAt: "2026-07-24T20:00:00.000Z"
    };

    expect(
      authSessionResponseSchema.parse({
        authenticated: true,
        user,
        csrfToken: "a".repeat(43)
      })
    ).toMatchObject({ authenticated: true });

    expect(
      authenticatedTodayResponseSchema.parse({
        selection: "next_incomplete",
        user,
        day: runtimeDay,
        progress: {
          dayNumber: 1,
          status: "not_started",
          selectedMode: null,
          evidence: [],
          reflection: {
            confused: "",
            mentalModelChanged: "",
            retrieveLater: "",
            updatedAt: null
          },
          version: 0,
          startedAt: null,
          completedAt: null,
          updatedAt: null
        },
        futureStartDate: null
      })
    ).toMatchObject({ selection: "next_incomplete" });
  });
});
