# Milestone 1 — Trusted Day 1 Preview

## Outcome

Milestone 1 proves that CodeLift AI can validate, serve, and render the
canonical Day 1 blueprint through a typed, no-key React → Express path. It does
not save learner state and does not claim that the blueprint already satisfies
the final display-ready `CurriculumDay` schema.

## User-visible acceptance criteria

- [x] A fresh local start opens a responsive CodeLift AI curriculum preview.
- [x] `/curriculum/1` loads Day 1 through the Node API from the supplied
      canonical JSON; the web production source contains no copied Day 1 data.
- [x] The page faithfully displays day/week/month context, phase, week, mission
      title, learning seed, build task, Core principle, retrieval question,
      exact Core schedule, tiny artifact, Recovery task, optional Stretch task,
      skill tags, and every resource.
- [x] The calculated Core total is visibly 30 minutes.
- [x] Core, five-minute Recovery, and optional Stretch are text-labeled and not
      communicated by color alone.
- [x] The page clearly says “Preview mode — progress is not saved yet.”
- [x] Loading, non-2xx, malformed-response, and retry states are accessible and
      never substitute hard-coded success content.
- [x] Resource links use canonical HTTPS URLs, meaningful names,
      `target="_blank"`, and `rel="noopener noreferrer"`.
- [x] The critical flow is usable by keyboard, at 320 CSS pixels, with dark
      color-scheme preferences, and with reduced motion.
- [x] Normal rendering makes no provider, analytics, telemetry, database,
      Python, model, live-link-check, or third-party content request.

## Blueprint and contract acceptance criteria

- [x] Runtime Zod schemas parse the top-level blueprint, weeks, resources,
      seed-day records, API success records, and API problem records.
- [x] The preflight reports `validationProfile: "blueprint"` and
      `displayReady: false`.
- [x] The preflight records the source SHA-256 and exact structural counts.
- [x] Exactly 365 sequential unique days validate.
- [x] Days 1–364 form 52 seven-day weeks; Day 365 is the final evidence day.
- [x] Every Core schedule totals exactly 30 minutes.
- [x] Every day has a resource, artifact, Recovery task, optional Stretch seed,
      skills, and valid past-only prerequisites.
- [x] Catalog URLs are HTTPS; resource IDs and embedded links match the catalog.
- [x] Missing final display fields, per-day Recovery estimates, and link status
      are disclosed as blueprint limitations, never reported as passed.
- [x] A corrupt blueprint fails readiness and is never partially served.

## Service acceptance criteria

- [x] `GET /health` reports process health without pretending curriculum
      readiness.
- [x] `GET /ready` reports the real curriculum load/validation state.
- [x] `GET /api/v1/curriculum/1` returns the validated Day 1 seed-day contract.
- [x] `GET /api/v1/curriculum/:dayNumber` supports integers 1–365.
- [x] `0`, negative, decimal, nonnumeric, and greater-than-365 parameters return
      a consistent `application/problem+json` response.
- [x] Production errors expose no stack trace or local filesystem path.
- [x] The API uses an explicit origin, Helmet, a bounded JSON body, request IDs,
      and response/runtime validation.
- [x] The browser calls only the Node API and validates the response again.

## Test and quality gates

- [x] Curriculum preflight and negative-fixture tests pass.
- [x] Shared contract tests pass.
- [x] Node API integration/security/readiness tests pass.
- [x] Frontend loading/success/error/retry and accessibility tests pass.
- [x] A browser-level golden-path and failure-path test passes.
- [x] Strict TypeScript typecheck passes across every M1 workspace.
- [x] Lint and formatting checks pass.
- [x] Production web and API builds pass.
- [x] Security checks are real and pass.
- [x] `quality:report` writes machine-readable criterion/command evidence and
      exits nonzero if a required M1 gate fails.
- [x] Not-yet-applicable seed/database, live-link, AI eval, auth, and Python
      gates are reported as `not_applicable` with reasons, never fake-green.
- [x] Visual QA covers wide, narrow, dark, reduced-motion, success, and
      unverified/error states.
- [x] Score is at least 95/100 and no critical failure remains.

## Explicitly deferred

- final enrichment into all required `CurriculumDay` teaching fields;
- per-day generated Recovery estimates and live resource-link status;
- start-date mapping and a true “Today” route;
- timer, evidence, reflection, progress, Core/Recovery completion, XP, streaks,
  reviews, achievements, and all persistence;
- registration, secure cookies, CSRF, MongoDB, authorization, and deletion;
- Python/FastAPI, PostgreSQL, Docker Compose, and internal service calls;
- AI Coach, providers, evals, embeddings, RAG, citations, agents, and MCP;
- the full Journey Map, Skill Constellation, Code Garden, Momentum Orbit,
  Milestone Peak, Error Museum, and production deployment.

Deferral must never be disguised as a completed capability.

## Scorecard

| Area                                   |  Points | Required M1 evidence                                                            |
| -------------------------------------- | ------: | ------------------------------------------------------------------------------- |
| User-visible acceptance criteria       |      20 | Real Day 1 path, source fidelity, safe resources, honest loading/error/retry    |
| Type safety and runtime validation     |      10 | Strict TS and shared Zod boundary schemas                                       |
| Unit/integration/browser evidence      |      15 | Curriculum, API, frontend, and golden/failure path suites                       |
| Curriculum and seed integrity          |      15 | 365-day blueprint preflight, SHA, source/display distinction                    |
| Accessibility and responsive visual QA |      10 | Keyboard, semantics, contrast, 320px, dark, reduced motion                      |
| Security and privacy                   |      10 | Fail-closed API, safe output/links, no data collection or secrets               |
| Pre-AI/free-mode reliability           |      10 | No provider dependency or invented AI/progress state                            |
| Documentation and maintainability      |       5 | AGENTS, plan, README, ADR/security/limitations                                  |
| Performance, cost, and operations      |       5 | Seed excluded from browser, health/readiness, bounded payload, $0 provider cost |
| **Total required**                     | **100** | **At least 95 and zero critical failures**                                      |

## Completion evidence

- Closed: 2026-07-24 (America/Los_Angeles)
- Aggregate result: **100/100, passed, zero critical failures**
- Machine report: `reports/milestone-1-quality.json`
- Source-bound browser digest:
  `82e9c69bd76baa43a5a8a14f33ac2b718b37ff33f63564016f12812540772b59`
- Browser evidence: `docs/quality/milestone-1-manual.json`
- Final browser repairs: direct dotted `/curriculum/*` HTML fallback and a
  code-native favicon; both were included in the clean-profile rerun.
- Automated evidence: 6 shared-contract tests, 11 curriculum tests, 18 API
  tests, 12 web tests, component golden/failure flow, strict typecheck, lint,
  formatting, production builds, curriculum preflight/link integrity, static
  security, registry audit, no-provider eval, and bundle budget all passed.

## Critical failures

- build failure;
- invalid or incomplete 365-day blueprint;
- serving a curriculum record before runtime validation;
- hard-coded/stale client success when the API or contract fails;
- exposing the complete seed in the browser bundle;
- secret, telemetry, or learner-data collection;
- arbitrary user-controlled URL fetching;
- unsafe resource links;
- inaccessible critical preview/retry path;
- production stack/path leakage;
- claiming the raw blueprint is already final display-ready curriculum;
- a quality report that hides or converts a required failure into a pass.
