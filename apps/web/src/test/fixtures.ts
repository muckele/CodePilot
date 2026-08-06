import type { CurriculumDayResponse, ProblemDetails } from "@codelift/contracts";

export const verifiedMissionFixture: CurriculumDayResponse = {
  dayNumber: 1,
  weekNumber: 1,
  monthNumber: 1,
  phaseTitle: "Test phase",
  weekTitle: "Verified boundaries",
  modeLabel: "Concept and first example",
  title: "Trace a verified curriculum request",
  learningObjective: "Build and explain a verified curriculum request through a bounded artifact.",
  whyItMattersForAIEngineering:
    "Runtime validation prevents untrusted provider or network output from becoming application state.",
  learningSeed:
    "Follow one piece of curriculum data from the Node API through a runtime contract into the page.",
  buildTask: "Render a typed mission response and preserve its failure state.",
  corePrinciple:
    "Trust grows when boundaries reject invalid state instead of displaying convenient guesses.",
  retrievalQuestion: "Where does untrusted network data become trusted application state?",
  tinyArtifact: "A passing response-contract test.",
  recoveryTask: "Name the client boundary and verify one response field.",
  recoveryMinutes: 5,
  optionalStretchSeed:
    "Change one fixture field and explain why contract validation catches drift.",
  optionalStretchMinutes: 10,
  mentalModel:
    "Treat the request as a state transition from unknown bytes to verified curriculum data.",
  commonMistake:
    "Rendering a convenient fallback as though it came from the validated server contract.",
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
  skillTags: ["runtime-validation", "http-boundaries"],
  resourceIds: ["systemsGuide", "contractDocs"],
  resourceLinks: [
    {
      id: "systemsGuide",
      provider: "Example University",
      title: "Open systems guide",
      url: "https://example.com/systems",
      type: "guide",
      topicHint: "Use only the section that supports the bounded artifact.",
      lastCheckedStatus: "source_verified"
    },
    {
      id: "contractDocs",
      provider: "Example Foundation",
      title: "Runtime contract reference",
      url: "https://example.org/contracts",
      type: "docs",
      topicHint: "Inspect parsing and failure behavior.",
      lastCheckedStatus: "source_verified"
    }
  ],
  prerequisiteDayNumbers: [],
  knowledgeChecks: [
    {
      id: "day-1-recall",
      kind: "recall",
      prompt: "Where does untrusted network data become trusted application state?",
      hint: "Find the runtime parser.",
      explanation: "Trust begins only after runtime parsing succeeds."
    },
    {
      id: "day-1-application",
      kind: "application",
      prompt: "Which test proves malformed data stays outside the UI?",
      hint: "Change a required response field.",
      explanation: "A malformed-response test proves the failure boundary."
    },
    {
      id: "day-1-explanation",
      kind: "explanation",
      prompt: "Explain why compile-time types are insufficient at the network boundary.",
      hint: "The server response does not run the TypeScript compiler.",
      explanation: "Runtime validation checks unknown values after they cross the network."
    }
  ],
  teachBackPrompt:
    "Explain the state before parsing, the validation action, and the evidence afterward.",
  retrievalPrompts: [
    "Where does untrusted data become trusted?",
    "Which evidence proves validation worked?",
    "Which failure reveals an unsafe fallback?"
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

export const serviceProblemFixture: ProblemDetails = {
  type: "https://codelift.local/problems/curriculum-unavailable",
  title: "Curriculum unavailable",
  status: 503,
  detail: "The validated curriculum is not ready yet.",
  instance: "/api/v1/curriculum/1",
  requestId: "request-test-123"
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": status >= 400 ? "application/problem+json" : "application/json"
    }
  });
}
