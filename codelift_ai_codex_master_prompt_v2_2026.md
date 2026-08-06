# CodeLift AI V2 — Codex Master Build Prompt (2026 Reassessed Roadmap)

Copy everything between **MASTER PROMPT START** and **MASTER PROMPT END** into Codex from the root of a new or existing repository.

This V2 supersedes the earlier CodeLift AI prompt. It retains MERN as the product foundation and adds the production skills that a modern full-stack AI application engineer needs: TypeScript earlier, Python/FastAPI, SQL, machine-learning fundamentals, reliable LLM integration, retrieval, evaluation, security, observability, local/open-model awareness, agents, MCP, system design, and job evidence.

---

## MASTER PROMPT START

You are Codex acting as a principal full-stack engineer, AI application engineer, UX engineer, learning-science-aware curriculum designer, security reviewer, test engineer, and technical mentor.

Build a production-shaped application named **CodeLift AI** for Mathew. Mathew completed a General Assembly coding bootcamp from Winter 2023 through Spring 2024, paused coding after having children, and now wants to rebuild from fundamentals with **30 focused minutes per day**. The application itself must become the central portfolio project while teaching the skills used to build it.

Do not ask routine clarifying questions. Inspect the repository, choose sensible defaults, document assumptions, and execute the build in verifiable slices. Ask only when a missing credential or an irreversible external action makes progress impossible. Never put secrets in source code or the browser.

# 1. Product and Career North Star

The target is **Full-Stack AI Application Engineer / Applied AI Engineer / AI Solutions Engineer**, not frontier-model research scientist.

By the end of the curriculum, Mathew should be able to:

- reason about core computer-science and software-systems concepts;
- build, test, secure, deploy, and explain a typed MERN application;
- use Python for data, machine learning, APIs, and AI-service work;
- model both document and relational data;
- integrate LLM providers behind application-owned interfaces;
- build structured-output, tool-calling, embedding, RAG, and bounded-agent features;
- create local evaluation suites, trace failures, control cost/latency, and red-team AI features;
- experiment with open models and parameter-efficient tuning without making fine-tuning the default solution;
- produce a capstone, system-design packet, demo, resume evidence, and interview stories.

The curriculum contains exactly **365 sequential learning days**. It is not tied to a hardcoded calendar. The user chooses a start date, and the app maps `dayNumber` to a date. A missed calendar day must never silently skip curriculum.

The core commitment is 30 minutes. Every day offers:

- **Core mission — 30 minutes:** the default;
- **Recovery win — 5 minutes:** preserves identity and continuity without pretending the full mission was completed;
- **Stretch — up to 10 optional minutes:** hidden by default and never required for completion.

Every completed day must produce an artifact: code, test, diagram, explanation, issue, screenshot, reflection, benchmark, eval result, or commit.

# 2. Why This Roadmap Order Is Non-Negotiable

Implement the seed curriculum in the supplied order.

1. **TypeScript precedes the main React/MERN build.** The learner should understand contracts, states, and boundary validation before the codebase grows.
2. **MERN remains the product spine.** React, Node/Express, and MongoDB are the primary application stack.
3. **Python/FastAPI and SQL are mandatory additions.** Modern AI application work commonly crosses Python services, tabular/model tooling, and relational data.
4. **Computer-science fundamentals spiral through the project.** Teach files/processes, HTTP, state machines, data structures, complexity, databases, concurrency, reliability, security, and distributed systems at the moment they become useful.
5. **Evaluation begins with the first LLM feature.** Never teach “prompt until it looks good.”
6. **RAG precedes agents.** Retrieval, citations, data governance, evals, cost, and security must be dependable before autonomy is added.
7. **Agents are bounded workflows with tools, state, budgets, traces, and human control.** Do not build a magical unbounded chatbot loop.
8. **Fine-tuning is late and optional.** First improve the problem definition, prompt, context, retrieval, tools, data, and evals. Use Hugging Face PEFT/LoRA for a small educational lab.
9. **Production quality is part of AI engineering.** Testing, CI/CD, security, observability, latency, cost, privacy, accessibility, and documentation are curriculum content and application requirements.
10. **AI-assisted coding must preserve learning.** Require explain-back, tests, diff review, and periodic closed-note reconstruction. The app must not reward copying generated code without comprehension.

# 3. Required Repository Architecture

Use a TypeScript-first monorepo. Prefer `pnpm`; use npm workspaces only when pnpm is unavailable.

```text
codelift-ai/
  AGENTS.md
  PLANS.md
  README.md
  SECURITY.md
  CONTRIBUTING.md
  BLOCKERS.md
  .env.example
  .gitignore
  package.json
  pnpm-workspace.yaml
  apps/
    web/
      src/
        app/
        components/
        features/
        pages/
        routes/
        hooks/
        lib/
        styles/
        test/
    api/
      src/
        config/
        controllers/
        domain/
        middleware/
        models/
        repositories/
        routes/
        services/
        seed/
        validators/
        test/
  services/
    ai/
      app/
        api/
        domain/
        infrastructure/
        providers/
        evals/
        tests/
      pyproject.toml
      Dockerfile
  packages/
    contracts/
    curriculum/
    ui/
    config/
  infra/
    compose.yaml
    docker/
    scripts/
  evals/
    datasets/
    promptfoo/
    reports/
  docs/
    architecture/
    adr/
    curriculum/
    runbooks/
    portfolio/
```

## 3.1 Core application stack

**Web**

- React + TypeScript + Vite
- React Router
- TanStack Query or a small well-tested server-state layer
- React Hook Form and Zod when practical
- Tailwind CSS or CSS Modules with design tokens
- Framer Motion for purposeful motion, with `prefers-reduced-motion`
- Recharts only where a chart conveys real information; custom SVG for signature graphics
- Vitest + React Testing Library
- Playwright for a few critical journeys

**Node API**

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- Zod runtime validation
- HTTP-only secure cookie authentication; include CSRF protection appropriate to the chosen cookie strategy
- Argon2 or bcrypt password hashing
- Helmet, explicit CORS, input/body limits, rate limiting, structured logs, request IDs
- Vitest/Jest + Supertest

**Python AI/data service**

- Python 3.12-compatible project
- FastAPI + Pydantic v2
- pytest
- pandas and scikit-learn for learning-data/ML modules
- optional PyTorch/Transformers extras; the base service must start without downloading a model
- provider protocols for coach, embeddings, reranking, and local inference
- typed Node-to-Python client with timeouts, validation, and fallback

**Data and delivery**

- MongoDB is the product database.
- PostgreSQL runs as a curriculum lab and may optionally back analytics/pgvector, but do not replace the MERN core.
- Docker Compose starts web, Node API, MongoDB, PostgreSQL lab, and Python service.
- GitHub Actions runs install, lint, typecheck, tests, seed validation, curriculum link checks, local evals, and builds.
- Use health/readiness checks and named volumes.

## 3.2 AI provider rules

The entire product must work without a paid API or downloaded model.

Implement:

- `MockCoachProvider`, `MockEmbeddingProvider`, `MockReranker`, and deterministic mock agent decisions;
- optional OpenAI provider using the server-side Responses API, configured by environment variables;
- optional local provider through an Ollama- or vLLM-compatible adapter;
- provider capability metadata for structured output, tools, embeddings, streaming, context, and privacy mode;
- backend-only secrets, bounded timeout/retry, rate limits, error normalization, fallback, and trace metadata;
- no hardcoded model snapshot as the only working choice; read model IDs from config.

Do **not** build against the deprecated hosted OpenAI Evals platform or make OpenAI-hosted fine-tuning a requirement. Use provider-independent local datasets and Promptfoo-style evals. Teach fine-tuning through Hugging Face PEFT/LoRA as an optional lab.

# 4. Mandatory Codex Looping Protocol

Operate in nested, closed feedback loops. Never stop at scaffolding and never claim completion without command evidence.

## 4.1 Outer milestone loop

For each coherent milestone:

```text
INSPECT
→ STATE ASSUMPTIONS
→ PLAN A VERTICAL SLICE
→ DEFINE ACCEPTANCE CHECKS
→ WRITE OR UPDATE TESTS
→ BUILD
→ RUN QUALITY GATES
→ SCORE
→ REPAIR ROOT CAUSES
→ RUN VISUAL/ACCESSIBILITY QA
→ DOCUMENT
→ REPEAT
```

Maintain `PLANS.md` with:

- current milestone and user value;
- acceptance criteria;
- files/components affected;
- security/privacy implications;
- test/eval plan;
- commands and results;
- unresolved risks and next slice.

## 4.2 Red–green–refactor loop

For domain logic, auth, progress transitions, seed validation, AI schemas, retrieval, and agents:

1. write or identify a failing test;
2. implement the smallest correct behavior;
3. rerun the focused test;
4. refactor while green;
5. run the broader affected suite.

## 4.3 Quality score

After each milestone, score the implementation out of 100:

| Area | Points |
|---|---:|
| User-visible acceptance criteria | 20 |
| Type safety and runtime validation | 10 |
| Unit/integration/E2E evidence | 15 |
| Curriculum and seed integrity | 15 |
| Accessibility and responsive visual QA | 10 |
| Security and privacy | 10 |
| AI evals, grounding, and failure handling where applicable | 10 |
| Documentation and maintainability | 5 |
| Performance, cost, and operational evidence | 5 |

A milestone passes only at **95/100 or higher** and with **zero critical failures**. Critical failures include build failure, auth bypass, cross-user data access, secret exposure, invalid 365-day seed, data loss, unsafe tool execution, fabricated success state, inaccessible critical flow, or an unhandled provider outage.

Perform at most 12 focused repair attempts on one blocker. Then document exact evidence and attempted fixes in `BLOCKERS.md`, choose a safe fallback, and continue any unblocked work. Do not loop forever and do not hide the blocker.

## 4.4 Final quality commands

Create root commands equivalent to:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm seed
pnpm seed:validate
pnpm curriculum:validate
pnpm curriculum:links
pnpm eval:local
pnpm security:check
pnpm quality:report
```

Paid-provider evals must be opt-in and separately named. `quality:report` must aggregate command status and write a machine-readable report.

# 5. Ethical Learning Psychology

Use learning science and positive reinforcement, never compulsion.

## 5.1 Motivation design

Support:

- **Autonomy:** Core, Recovery, and optional Stretch choices; editable implementation intention; ability to pause or reschedule.
- **Competence:** visible mastery evidence, progressively harder but small challenges, actionable feedback, and “show me why” explanations.
- **Relatedness:** optional buddy/share card or mentor-ready weekly summary, with no leaderboard or public ranking.
- **Implementation intention:** “Today at [time], after [existing routine], I will code at [place] for 30 minutes.”
- **Identity reinforcement:** celebrate returning, testing, explaining, debugging, and shipping—not innate talent.
- **Spaced retrieval:** resurface concepts after approximately 1, 3, 7, 14, and 30 days.
- **Interleaving:** mix recall, explanation, code, tests, debugging, and product connection.
- **Error-based learning:** maintain an “Error Museum” where fixed bugs become searchable learning artifacts.

Never use:

- shame, red failure banners, “you ruined your streak,” or identity attacks;
- random variable rewards, fake urgency, scarcity, loss framing, or manipulative notifications;
- destructive streak resets as the main progress representation;
- forced social comparison;
- celebration for unverified work;
- AI praise that claims understanding without evidence.

## 5.2 Progress model

Track several honest measures:

- current streak and longest streak;
- rolling 7-day and 30-day momentum;
- total returns, including nonconsecutive days;
- Core completions and Recovery wins separately;
- skill state: `introduced → practiced → demonstrated`;
- artifacts, tests, explanations, and portfolio milestones;
- retrieval-review queue and corrected misconceptions.

Grace tokens protect one calendar streak event but never convert an uncompleted Core mission into a completed one.

## 5.3 Copy tone

Use concise, specific reinforcement:

- “You returned. That is the habit.”
- “You made the state transition testable.”
- “A five-minute recovery win still protects your next step.”
- “You fixed a bug by using evidence, not guessing.”
- “Today’s artifact is now part of your portfolio story.”
- “No perfect streak required. Continue from the next useful step.”

# 6. Visual and Graphic Direction

The application should feel like a **Cosmic Sunrise Workshop**: warm, optimistic, technically credible, and calmer than a game casino.

Create original graphics with SVG/CSS/canvas; do not depend on copyrighted artwork or paid image assets.

## 6.1 Signature components

Build these reusable components:

1. **JourneyMap** — twelve mountain/planet milestones connected by a path of 365 stars. Completed days glow; Recovery wins have a distinct gentle mark; future days remain visible.
2. **SkillConstellation** — skill nodes connect as prerequisites unlock. A node changes from introduced to practiced to demonstrated.
3. **CodeGarden** — each artifact grows a geometric plant/circuit motif; tests add leaves, documentation adds roots, deployments add a sunrise.
4. **MomentumOrbit** — a nonpunitive 7/30-day orbit chart that emphasizes returns over perfect streaks.
5. **MilestonePeak** — a celebratory scene for major project releases with a reduced-motion alternative.
6. **ErrorMuseum** — cards for bug, hypothesis, evidence, fix, test, and lesson.
7. **WeeklyStory** — a generated but factual visual recap using actual events and artifacts.
8. **AchievementShelf** — badges tied to meaningful evidence, not random actions.
9. **FocusOrb** — a calm 30-minute timer with review/build/reflect segments and pause/resume.
10. **ParticleBurst** — a small, bounded SVG celebration; disable under reduced motion.
11. **CourseTrail** — today’s resources displayed as a short ordered trail, not an overwhelming resource dump.
12. **EvidenceCard** — shows commit, test, screenshot, explanation, or eval result proving the day’s work.

## 6.2 Design system

Use semantic design tokens, not scattered raw values. Include:

- sunrise gold, coral, violet, midnight, cloud, success, warning, and neutral semantic roles;
- accessible contrast in light and dark themes;
- readable body typography and a distinctive but legible display face using system/web-safe fallbacks;
- 8-point spacing rhythm;
- rounded but not childish surfaces;
- visible keyboard focus;
- responsive mobile-first layouts;
- no information encoded by color alone;
- no autoplay sound;
- reduced-motion behavior for every animated component.

# 7. Core Product Features

## 7.1 Onboarding and account

Implement registration, login, logout, password handling, protected routes, and account deletion.

Onboarding asks for:

- display name, timezone, and start date;
- 30-minute default commitment;
- preferred coding window and implementation intention;
- “why this matters” statement;
- GitHub username optional;
- target roles;
- data/privacy choices for optional AI providers;
- motion/theme preference.

The learner may start on any date. The app defaults to “continue from the next incomplete curriculum day.” Offer explicit alternatives: continue, calendar catch-up plan, or intentionally skip with a written reason. Never auto-skip.

## 7.2 Today dashboard

The first screen must make one action obvious: **Start Today’s Mission**.

Include:

- greeting and identity statement;
- FocusOrb and 30-minute schedule;
- Core/Recovery/Stretch mode choice;
- current day, week, phase, and milestone;
- CourseTrail with direct links;
- one-sentence computer-science principle;
- JourneyMap mini-view;
- MomentumOrbit;
- review items due today;
- current portfolio artifact;
- “resume where I stopped” state;
- no-shame missed-day recovery card;
- actual recent evidence, not invented AI praise.

## 7.3 Daily mission experience

Each curriculum day must include:

```ts
type CurriculumDay = {
  dayNumber: number;              // 1..365, unique
  weekNumber: number;             // 1..53; day 365 is final evidence day
  monthNumber: number;            // 1..12
  phaseTitle: string;
  weekTitle: string;
  modeLabel: string;
  title: string;
  learningObjective: string;
  whyItMattersForAIEngineering: string;
  corePrinciple: string;
  mentalModel: string;
  commonMistake: string;
  coreSchedule: TimeBlock[];      // totals exactly 30
  recoveryTask: string;           // <=5 minutes
  optionalStretch?: string;       // <=10 minutes
  buildTask: string;
  tinyArtifact: string;
  resourceLinks: ResourceLink[];  // >=1 valid free/official link
  skillTags: string[];
  knowledgeChecks: KnowledgeCheck[];
  teachBackPrompt: string;
  retrievalPrompts: string[];
  prerequisiteDayNumbers: number[];
  portfolioMilestone?: string;
};
```

The page provides:

- a short original explanation, never a copied course transcript;
- a mental model and one common misconception;
- direct course/docs links opening safely in a new tab;
- a built-in notes/code scratch area;
- three knowledge checks: recall, application, and “explain why”;
- a “show hint” before “show explanation” flow;
- completion evidence: commit URL, test name, screenshot, demo, text explanation, or generated local artifact;
- “What confused me?”, “What changed in my mental model?”, and “What will I retrieve later?”;
- completion only after an artifact or explicit Recovery evidence;
- due-review scheduling at +1/+3/+7/+14/+30 days, adjusted to valid curriculum dates.

## 7.4 Task manager

Support:

- today, backlog, review queue, seven-day preview, roadmap, milestones;
- status: not started, opened, in progress, core completed, recovery completed, intentionally skipped, rescheduled;
- user-created subtasks attached to a curriculum day;
- estimates and actual minutes;
- dependency-aware next task;
- pause/resume timer;
- saved draft reflection;
- calendar-independent catch-up plan that never schedules more than one Core mission per day by default;
- search and filters by skill, resource, project, confusion tag, and artifact;
- weekly planning agent only after Month 11 is unlocked; before then use deterministic planning logic.

## 7.5 Learning and review system

Implement:

- spaced-review queue;
- closed-note mode that hides the explanation;
- confidence before and after retrieval;
- misconception log;
- Error Museum;
- code reconstruction prompts;
- flashcard-like checks without turning the app into rote trivia;
- prerequisites and concept graph;
- weekly reflection and monthly retrospective;
- mastery based on retrieval and artifacts, not lesson completion alone.

## 7.6 Portfolio and career areas

Track:

- Coding Dashboard v1;
- typed MERN accountability MVP;
- secure/authenticated product release;
- SQL lab;
- Python analysis package;
- FastAPI service;
- ML notebooks/model card;
- structured AI Coach;
- RAG notes search with citations;
- eval/observability dashboard;
- safe study-planning workflow;
- MCP demo;
- capstone architecture and release;
- README, screenshots, demo, resume bullets, interview stories, and job applications.

Each artifact records status, repository, demo, screenshots, skills proven, tests/evals, tradeoffs, limitations, interview questions, and evidence links.

## 7.7 AI Coach

The AI Coach is a bounded feature, not a therapist, evaluator of human worth, or autonomous decision-maker.

It may:

- explain the current concept using the day’s context;
- ask a Socratic question;
- summarize a reflection;
- suggest one next tiny step;
- produce a factual weekly recap from stored events;
- connect the artifact to a portfolio story.

It must:

- use structured output where machine-consumed;
- identify generated content;
- never claim the learner understood something without retrieval/artifact evidence;
- never diagnose burnout, mental health, or parenting issues;
- not make employment guarantees;
- not send private notes externally without opt-in;
- fallback cleanly to deterministic local guidance.

## 7.8 Admin and content tools

Add a protected development/admin area for:

- curriculum day preview;
- resource/link status;
- duplicate/missing field report;
- seed versions and migrations;
- eval runs and trace inspection;
- feature flags;
- mock-provider scenarios;
- accessibility/visual test states;
- reset demo data.

# 8. Data Model Requirements

Use MongoDB/Mongoose for product state with TypeScript interfaces and runtime schemas.

Required collections:

- `User`
- `CurriculumDay`
- `Resource`
- `ProgressLog`
- `Reflection`
- `XpEvent`
- `Achievement`
- `UserAchievement`
- `SkillEvidence`
- `ReviewItem`
- `Misconception`
- `ErrorMuseumEntry`
- `PortfolioArtifact`
- `AiTrace`
- `EvalDataset`
- `EvalRun`
- `IndexedSource`
- `AgentRun`
- `JobApplication`
- `FeatureFlag`

Important invariants:

- `(userId, dayNumber)` progress uniqueness;
- day numbers 1–365, no gaps;
- Core schedule totals exactly 30 minutes;
- Recovery task estimated at five minutes or less;
- XP events have stable idempotency keys;
- all user-owned queries include user scope;
- derived embeddings carry user/source/version metadata and delete with the source;
- AI traces store configuration/metrics but minimize or hash sensitive content;
- agent runs have attempt, tool, token/cost, and wall-time budgets plus terminal reason;
- resource URLs use HTTPS and have a last-checked status.

Create a PostgreSQL lab schema and exercises, but product operation must not depend on completing that lab.

# 9. API Contract

Use versioned routes, consistent problem/error responses, runtime validation, and OpenAPI documentation for the Python service.

Representative Node routes:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/me
DELETE /api/v1/me

GET    /api/v1/curriculum
GET    /api/v1/curriculum/today
GET    /api/v1/curriculum/:dayNumber
GET    /api/v1/reviews/due

GET    /api/v1/progress
PUT    /api/v1/progress/:dayNumber/status
PUT    /api/v1/progress/:dayNumber/reflection
POST   /api/v1/progress/:dayNumber/evidence
POST   /api/v1/progress/catch-up-plan

GET    /api/v1/skills
GET    /api/v1/achievements
GET    /api/v1/portfolio
PUT    /api/v1/portfolio/:artifactKey

POST   /api/v1/coach/explain
POST   /api/v1/coach/reflect
POST   /api/v1/search/notes
POST   /api/v1/planner/week
POST   /api/v1/planner/:runId/approve
POST   /api/v1/planner/:runId/revise

GET    /api/v1/ai/traces
GET    /api/v1/evals/runs
POST   /api/v1/evals/local
```

Representative Python routes:

```text
GET  /health
POST /v1/analyze/progress
POST /v1/ml/risk-assist
POST /v1/embeddings
POST /v1/rerank
POST /v1/local/generate
```

The browser calls only the Node API. The Node API owns auth and public policy; it calls the Python service through an internal typed client.

# 10. AI Reliability, Evaluation, and Security

## 10.1 Local evaluation harness

Create provider-independent eval datasets in version control.

Cover:

- schema validity;
- required/forbidden language;
- explanation usefulness;
- evidence/grounding;
- citation validity and completeness;
- retrieval relevance and recall@k;
- abstention when notes do not support an answer;
- tool selection, arguments, authorization, and step budgets;
- latency and estimated cost ceilings;
- prompt injection, cross-user access, excessive agency, and unsafe output handling.

Local deterministic/mock evals run in CI. External-model evals are explicit opt-in commands and save model/config/version metadata. LLM-as-judge may supplement but never replace deterministic checks or calibrated human review.

## 10.2 RAG requirements

Implement ingestion, chunking, hashing, versioning, embedding, indexing, metadata filtering, retrieval, optional hybrid search/reranking, bounded context assembly, grounded generation, citations, and deletion.

Every answer must distinguish:

- source-supported statement;
- inference;
- unsupported/unknown.

Never expose one user’s source or vector to another user.

## 10.3 Agent requirements

Agents appear only after the curriculum unlocks them.

Every agent has:

- typed graph/state;
- narrow allowlisted tools;
- authorization at execution time;
- read-only default;
- human approval before side effects;
- maximum steps, tokens/cost, and wall time;
- duplicate-action detection;
- checkpoint/resume rules;
- trace viewer;
- deterministic fallback workflow;
- kill switch/feature flag;
- terminal reason;
- trace-level evals and red-team tests.

## 10.4 Security requirements

Threat-model both ordinary web risks and AI-specific risks:

- auth/session/CSRF/XSS/injection;
- broken object-level authorization;
- secret and log leakage;
- unsafe uploads/URLs;
- prompt injection and poisoned retrieval;
- improper output handling;
- excessive agency;
- vector/embedding tenant leakage;
- model/provider supply-chain risk;
- denial of wallet/resource exhaustion;
- deletion and retention failures.

Create `SECURITY.md`, a threat-model document, and regression tests for fixed critical vulnerabilities.

# 11. Curriculum Resource Catalog

Use these free course pages and official/open documentation. Do not scrape or reproduce lessons. Link to them and write short original summaries, examples, questions, and project connections. An optional provider API may cost money, so the default learning/application path must use mock or local behavior.


| ID | Provider | Resource | Type | URL |
|---|---|---|---|---|
| `cs50x` | Harvard CS50 | CS50x: Introduction to Computer Science | course | https://cs50.harvard.edu/x/ |
| `cs50p` | Harvard CS50 | CS50P: Introduction to Programming with Python | course | https://cs50.harvard.edu/python/ |
| `cs50sql` | Harvard CS50 | CS50 SQL: Introduction to Databases with SQL | course | https://cs50.harvard.edu/sql/ |
| `missing2026` | MIT Missing Semester | 2026 Course Index | course | https://missing.csail.mit.edu/2026/ |
| `missingShell` | MIT Missing Semester | Course Overview and Shell | lesson | https://missing.csail.mit.edu/2026/course-shell/ |
| `missingCli` | MIT Missing Semester | Command-line Environment | lesson | https://missing.csail.mit.edu/2026/command-line-environment/ |
| `missingDev` | MIT Missing Semester | Development Environment and Tools | lesson | https://missing.csail.mit.edu/2026/development-environment/ |
| `missingDebug` | MIT Missing Semester | Debugging and Profiling | lesson | https://missing.csail.mit.edu/2026/debugging-profiling/ |
| `missingGit` | MIT Missing Semester | Version Control and Git | lesson | https://missing.csail.mit.edu/2026/version-control/ |
| `missingShip` | MIT Missing Semester | Packaging and Shipping Code | lesson | https://missing.csail.mit.edu/2026/shipping-code/ |
| `missingAgentic` | MIT Missing Semester | Agentic Coding | lesson | https://missing.csail.mit.edu/2026/agentic-coding/ |
| `missingBeyond` | MIT Missing Semester | Beyond the Code | lesson | https://missing.csail.mit.edu/2026/beyond-code/ |
| `missingQuality` | MIT Missing Semester | Code Quality | lesson | https://missing.csail.mit.edu/2026/code-quality/ |
| `odinFoundations` | The Odin Project | Foundations | course | https://www.theodinproject.com/paths/foundations/courses/foundations |
| `odinJs` | The Odin Project | JavaScript Course | course | https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript |
| `odinNode` | The Odin Project | NodeJS Course | course | https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs |
| `mdnHtml` | MDN | Structuring the web with HTML | course | https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content |
| `mdnCss` | MDN | CSS Styling Basics | course | https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics |
| `mdnJs` | MDN | Dynamic scripting with JavaScript | course | https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting |
| `mdnHttp` | MDN | HTTP Overview | docs | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview |
| `mdnA11y` | MDN | Accessibility | course | https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility |
| `fccRwd` | freeCodeCamp | Responsive Web Design Certification | course | https://www.freecodecamp.org/learn/responsive-web-design-v9 |
| `fccJs` | freeCodeCamp | JavaScript Certification | course | https://www.freecodecamp.org/learn/javascript-v9 |
| `fccFrontend` | freeCodeCamp | Front-End Development Libraries Certification | course | https://www.freecodecamp.org/learn/front-end-development-libraries-v9 |
| `fccBackend` | freeCodeCamp | Back-End Development and APIs Certification | course | https://www.freecodecamp.org/learn/back-end-development-and-apis-v9 |
| `fccPython` | freeCodeCamp | Python Certification | course | https://www.freecodecamp.org/learn/python-v9 |
| `fccRelDb` | freeCodeCamp | Relational Databases Certification | course | https://www.freecodecamp.org/learn/relational-databases-v9 |
| `reactLearn` | React | React Learn | course | https://react.dev/learn |
| `typescriptHandbook` | TypeScript | The TypeScript Handbook | docs | https://www.typescriptlang.org/docs/handbook/intro.html |
| `nodeLearn` | Node.js | Node.js Learn | docs | https://nodejs.org/en/learn |
| `expressDocs` | Express | Express Getting Started | docs | https://expressjs.com/en/starter/installing.html |
| `fso` | University of Helsinki | Full Stack Open | course | https://fullstackopen.com/en/ |
| `fso0` | University of Helsinki | Full Stack Open Part 0: Fundamentals of Web Apps | course | https://fullstackopen.com/en/part0 |
| `fso1` | University of Helsinki | Full Stack Open Part 1: React | course | https://fullstackopen.com/en/part1 |
| `fso2` | University of Helsinki | Full Stack Open Part 2: Communicating with Server | course | https://fullstackopen.com/en/part2 |
| `fso3` | University of Helsinki | Full Stack Open Part 3: Node.js and Express | course | https://fullstackopen.com/en/part3 |
| `fso4` | University of Helsinki | Full Stack Open Part 4: Testing and User Administration | course | https://fullstackopen.com/en/part4 |
| `fso5` | University of Helsinki | Full Stack Open Part 5: Testing React Apps | course | https://fullstackopen.com/en/part5 |
| `fso9` | University of Helsinki | Full Stack Open Part 9: TypeScript | course | https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript |
| `fso11` | University of Helsinki | Full Stack Open Part 11: CI/CD | course | https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-continuous-integration |
| `fso12` | University of Helsinki | Full Stack Open Part 12: Containers | course | https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers |
| `fso13` | University of Helsinki | Full Stack Open Part 13: Relational Databases | course | https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases |
| `mongoUniversity` | MongoDB University | MongoDB University Learning Paths | course | https://learn.mongodb.com/ |
| `mongoNode` | MongoDB | MongoDB Node.js Driver Quick Start | docs | https://www.mongodb.com/docs/drivers/node/current/quick-start/ |
| `mongooseDocs` | Mongoose | Mongoose Guide | docs | https://mongoosejs.com/docs/guide.html |
| `postgresTutorial` | PostgreSQL | PostgreSQL Tutorial | docs | https://www.postgresql.org/docs/current/tutorial.html |
| `dockerStart` | Docker | Docker Get Started | course | https://docs.docker.com/get-started/ |
| `githubActions` | GitHub | Understanding GitHub Actions | docs | https://docs.github.com/en/actions/about-github-actions/understanding-github-actions |
| `owaspTop10` | OWASP | OWASP Top 10 Web Application Security Risks | reference | https://owasp.org/www-project-top-ten/ |
| `pythonTutorial` | Python | The Python Tutorial | docs | https://docs.python.org/3/tutorial/ |
| `pytestDocs` | pytest | pytest Get Started | docs | https://docs.pytest.org/en/stable/getting-started.html |
| `fastapiTutorial` | FastAPI | FastAPI Tutorial | course | https://fastapi.tiangolo.com/tutorial/ |
| `pydanticDocs` | Pydantic | Pydantic Documentation | docs | https://docs.pydantic.dev/latest/ |
| `kagglePython` | Kaggle Learn | Python | course | https://www.kaggle.com/learn/python |
| `kagglePandas` | Kaggle Learn | Pandas | course | https://www.kaggle.com/learn/pandas |
| `kaggleIntroMl` | Kaggle Learn | Intro to Machine Learning | course | https://www.kaggle.com/learn/intro-to-machine-learning |
| `googleMlcc` | Google for Developers | Machine Learning Crash Course | course | https://developers.google.com/machine-learning/crash-course |
| `fastai` | fast.ai | Practical Deep Learning for Coders | course | https://course.fast.ai/ |
| `pytorchBasics` | PyTorch | Learn the Basics | course | https://pytorch.org/tutorials/beginner/basics/intro.html |
| `openaiText` | OpenAI Developers | Text Generation with the Responses API | docs | https://developers.openai.com/api/docs/guides/text |
| `openaiPrompt` | OpenAI Developers | Prompt Engineering | docs | https://developers.openai.com/api/docs/guides/prompt-engineering |
| `openaiStructured` | OpenAI Developers | Structured Outputs | docs | https://developers.openai.com/api/docs/guides/structured-outputs |
| `openaiFunctions` | OpenAI Developers | Function Calling | docs | https://developers.openai.com/api/docs/guides/function-calling |
| `openaiTools` | OpenAI Developers | Using Tools | docs | https://developers.openai.com/api/docs/guides/tools |
| `openaiEmbeddings` | OpenAI Developers | Vector Embeddings | docs | https://developers.openai.com/api/docs/guides/embeddings |
| `openaiRetrieval` | OpenAI Developers | Retrieval and Vector Stores | docs | https://developers.openai.com/api/docs/guides/retrieval |
| `openaiPromptEval` | OpenAI Developers | Prompt Engineering: Tests and Evaluation Suites | docs | https://developers.openai.com/api/docs/guides/prompt-engineering |
| `openaiOptimization` | OpenAI Developers | Model Optimization | docs | https://developers.openai.com/api/docs/guides/model-optimization |
| `openaiData` | OpenAI Developers | Data Controls | docs | https://developers.openai.com/api/docs/guides/your-data |
| `openaiCodexLoop` | OpenAI Developers | Build Iterative Repair Loops with Codex | guide | https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex |
| `hfLlm` | Hugging Face | LLM Course | course | https://huggingface.co/learn/llm-course/chapter1/1 |
| `hfTokenizers` | Hugging Face | Tokenizers | course | https://huggingface.co/learn/llm-course/chapter6/1 |
| `hfFineTune` | Hugging Face | Fine-tuning a Pretrained Model | course | https://huggingface.co/learn/llm-course/chapter3/1 |
| `hfLora` | Hugging Face | LoRA and PEFT | course | https://huggingface.co/learn/llm-course/chapter11/4 |
| `hfSmol` | Hugging Face | Smol Course: Fine-tuning Language Models | course | https://huggingface.co/learn/smol-course/unit0/1 |
| `hfAgents` | Hugging Face | AI Agents Course | course | https://huggingface.co/learn/agents-course/unit0/introduction |
| `hfMcp` | Hugging Face | MCP Course | course | https://huggingface.co/learn/mcp-course/unit0/introduction |
| `hfAdvancedRag` | Hugging Face | Advanced RAG Cookbook | guide | https://huggingface.co/learn/cookbook/advanced_rag |
| `langgraph` | LangChain Academy | Introduction to LangGraph | course | https://academy.langchain.com/courses/intro-to-langgraph |
| `promptfoo` | Promptfoo | LLM Evaluation Quick Start | docs | https://www.promptfoo.dev/docs/intro/ |
| `promptfooRed` | Promptfoo | LLM Red Teaming | docs | https://www.promptfoo.dev/docs/red-team/ |
| `owaspLlm` | OWASP GenAI Security Project | OWASP Top 10 for LLM Applications | reference | https://genai.owasp.org/llm-top-10/ |
| `langfuse` | Langfuse | LLM Observability Documentation | docs | https://langfuse.com/docs |
| `ollama` | Ollama | Ollama Documentation | docs | https://docs.ollama.com/ |
| `vllm` | vLLM | vLLM Documentation | docs | https://docs.vllm.ai/en/latest/ |
| `pgvector` | pgvector | pgvector Documentation | docs | https://github.com/pgvector/pgvector |
| `mermaid` | Mermaid | Mermaid Diagram Syntax | docs | https://mermaid.js.org/intro/ |
| `systemDesignPrimer` | GitHub | System Design Primer | reference | https://github.com/donnemartin/system-design-primer |


## 11.1 Twelve-Month Roadmap Overview

| Month | Weeks | Focus | Portfolio evidence |
|---|---:|---|---|
| 1 | 1–4 | Developer tools, HTML/CSS, accessibility, JavaScript state/control flow | Public learning repo and responsive homepage |
| 2 | 5–8 | JavaScript data modeling, DOM, algorithms, async/HTTP | Coding Dashboard v1 |
| 3 | 9–13 | TypeScript, React, routing/server state, Node/Express, first vertical slice | Typed frontend and working React→Express flow |
| 4 | 14–17 | MongoDB, auth/security, progress engine, tests/CI/deploy | Secure MERN accountability MVP |
| 5 | 18–21 | SQL, containers, architecture/reliability/security, Python entry | SQL lab, Docker environment, architecture packet, Python package |
| 6 | 22–26 | Python engineering, Pandas, FastAPI, regression/classification | Python AI/data service and responsible ML artifacts |
| 7 | 27–30 | Neural networks, embeddings, transformers, first LLM feature | PyTorch/LLM notebooks and eval-baselined AI Coach |
| 8 | 31–34 | Structured outputs, tools, eval-first development, vector ingestion | Schema-safe coach, tool loop, CI evals, embedding pipeline |
| 9 | 35–39 | RAG, hybrid retrieval, advanced knowledge quality, observability, AI security | Cited RAG, retrieval report, AI ops dashboard, red-team report |
| 10 | 40–43 | Prompt/system optimization, open models, quantization, PEFT/LoRA | Optimization ADR, local-model benchmark, optional tuning lab |
| 11 | 44–47 | Serving, bounded agents, durable graphs, MCP/context engineering | Provider gateway, approved planning workflow, MCP demo |
| 12 | 48–52 plus Day 365 | Agent quality, system design, capstone, portfolio, targeted job search | Public capstone release, system-design packet, demo, resume/interview evidence |

Treat this as a one-year **bridge-role** curriculum. At 30 minutes per day, it represents approximately 182.5 hours. Prioritize durable understanding and demonstrated product work over certificate accumulation. Do not imply that completing a calendar guarantees employment.



# 12. Exact 365-Day Curriculum Blueprint

Seed exactly the following content. Preserve day numbers, order, learning intent, build task, principle, retrieval question, Recovery task, and links. You may improve grammar and add original mental models/common mistakes, but do not silently change the learning sequence.

## 12.1 Seven-day learning rhythm

For Days 1–364, each week follows this rhythm. Store the applicable schedule on each day so the Core plan totals exactly 30 minutes.

| Cycle position | Purpose | Core schedule |
|---|---|---|
| 1 | Concept and first example | 3 preview · 10 resource · 12 example/code · 5 recall/commit |
| 2 | Guided practice and variation | 3 retrieve · 8 resource · 14 practice/variation · 5 explain/commit |
| 3 | Closed-note reconstruction | 5 recall · 7 gap-fill · 13 rebuild · 5 compare/commit |
| 4 | Product connection | 3 acceptance check · 5 docs · 17 feature · 5 evidence/reflection |
| 5 | Quality/debug/security | 3 predict failure · 7 resource · 15 test/debug/harden · 5 explain |
| 6 | Integrate and ship | 3 choose slice · 22 integrate/build · 5 test/screenshot/README proof |
| 7 | Review and recovery | 7 closed-note retrieval · 8 review misses · 10 repair/refactor · 5 next intention |

For every day, generate an optional Stretch task of no more than ten minutes. It must be an extra edge case, teach-back, diagram, benchmark, or refactor; never make it required.



## Month 1 — Developer Reset and Web Foundations


### Week 1 — Environment, identity, shell, and Git

**Milestone:** A reproducible development workspace and a public learning repository with a clear goal.

**Skills:** `git`, `shell`, `developer-tools`, `professional-practice`


#### Day 001 — Define the developer identity and learning contract

- **Learn:** Turn the year goal into a process goal: return for 30 minutes, produce one small artifact, and record evidence. Review how the curriculum and repository will work.
- **Do:** Create `README.md` with the target role, 30-minute rule, definition of a daily win, and a twelve-month milestone table.
- **Principle:** Systems improve when goals are observable and work is decomposed into repeatable state transitions.
- **Retrieve:** What observable evidence proves that today counted?
- **Recovery:** Open the first resource, write three bullets explaining “Define the developer identity and learning contract,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations); [MIT Missing Semester — 2026 Course Index](https://missing.csail.mit.edu/2026/)

#### Day 002 — Audit the development environment

- **Learn:** Understand the roles of editor, terminal, runtime, package manager, browser, and Git. Distinguish source code from the tools that execute or transform it.
- **Do:** Record versions of Node, npm or pnpm, Git, Python, and the editor; create a troubleshooting checklist.
- **Principle:** A reproducible environment reduces hidden variables and makes failures diagnosable.
- **Retrieve:** Which tool executes JavaScript outside the browser?
- **Recovery:** Open the first resource, write three bullets explaining “Audit the development environment,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Development Environment and Tools](https://missing.csail.mit.edu/2026/development-environment/); [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations)

#### Day 003 — Navigate the filesystem from the shell

- **Learn:** Practice paths, working directory, files, folders, standard input/output, exit status, and safe command habits.
- **Do:** Create `notes/`, `exercises/`, `projects/`, and `proof/` only from the terminal; save the exact commands in notes.
- **Principle:** An operating system exposes resources through abstractions such as processes, files, paths, streams, and permissions.
- **Retrieve:** What is the difference between an absolute and a relative path?
- **Recovery:** Open the first resource, write three bullets explaining “Navigate the filesystem from the shell,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Course Overview and Shell](https://missing.csail.mit.edu/2026/course-shell/); [MIT Missing Semester — Command-line Environment](https://missing.csail.mit.edu/2026/command-line-environment/)

#### Day 004 — Create snapshots with Git

- **Learn:** Learn repository, working tree, staging area, commit, hash, branch, and log. Treat commits as meaningful checkpoints rather than backups.
- **Do:** Initialize the repository, stage files deliberately, make two focused commits, and inspect `git log` and a diff.
- **Principle:** Version control models project history as immutable snapshots connected by references.
- **Retrieve:** What problem does the staging area solve?
- **Recovery:** Open the first resource, write three bullets explaining “Create snapshots with Git,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Version Control and Git](https://missing.csail.mit.edu/2026/version-control/); [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations)

#### Day 005 — Publish safely to GitHub

- **Learn:** Understand local versus remote repositories, push/pull, authentication, `.gitignore`, and why secrets never belong in Git history.
- **Do:** Create the remote repository, add `.gitignore`, push the branch, and verify the README from a browser.
- **Principle:** Distributed systems keep multiple copies of state and require explicit synchronization.
- **Retrieve:** Why can deleting a secret in a later commit still be unsafe?
- **Recovery:** Open the first resource, write three bullets explaining “Publish safely to GitHub,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Version Control and Git](https://missing.csail.mit.edu/2026/version-control/); [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/)

#### Day 006 — Integrate Week 1: Environment, identity, shell, and Git

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A reproducible development workspace and a public learning repository with a clear goal.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A reproducible development workspace and a public learning repository with a clear goal. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A reproducible development workspace and a public learning repository with a clear goal.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations); [MIT Missing Semester — 2026 Course Index](https://missing.csail.mit.edu/2026/); [MIT Missing Semester — Development Environment and Tools](https://missing.csail.mit.edu/2026/development-environment/)

#### Day 007 — Retrieve, review, and plan after Week 1

- **Learn:** Without notes, explain the five concepts from **Environment, identity, shell, and Git**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A reproducible development workspace and a public learning repository with a clear goal. **Evidence:** Week 1 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations); [MIT Missing Semester — 2026 Course Index](https://missing.csail.mit.edu/2026/); [MIT Missing Semester — Development Environment and Tools](https://missing.csail.mit.edu/2026/development-environment/)

### Week 2 — HTML, the browser, and accessible document structure

**Milestone:** A semantic, accessible learning-homepage skeleton that explains the journey.

**Skills:** `html`, `http`, `accessibility`, `web-platform`


#### Day 008 — Trace a web request from URL to page

- **Learn:** Learn the client/server model, DNS at a conceptual level, HTTP request/response, status codes, HTML parsing, and the browser rendering pipeline.
- **Do:** Draw a Mermaid sequence diagram showing browser → DNS/server → response → DOM/CSSOM → rendered page.
- **Principle:** Networked software is built from protocols: agreed message formats and state transitions between independent systems.
- **Retrieve:** What information belongs in an HTTP response besides the body?
- **Recovery:** Open the first resource, write three bullets explaining “Trace a web request from URL to page,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 009 — Build a valid HTML document

- **Learn:** Study doctype, document metadata, headings, paragraphs, lists, links, images, and relative paths.
- **Do:** Create `index.html` with a title, journey summary, goals, and resource section; validate nesting and heading order.
- **Principle:** HTML describes semantic structure; presentation and behavior belong to other layers.
- **Retrieve:** Why is a heading not merely large text?
- **Recovery:** Open the first resource, write three bullets explaining “Build a valid HTML document,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content)

#### Day 010 — Use semantic landmarks

- **Learn:** Learn `header`, `nav`, `main`, `section`, `article`, `aside`, and `footer`, plus the accessibility value of meaningful elements.
- **Do:** Refactor the page to use landmarks and add skip navigation.
- **Principle:** Good abstractions communicate intent to humans, assistive technology, and machines.
- **Retrieve:** When is a `button` more appropriate than a clickable `div`?
- **Recovery:** Open the first resource, write three bullets explaining “Use semantic landmarks,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 011 — Design forms as input contracts

- **Learn:** Study labels, input types, names, constraints, validation messages, and the GET/POST distinction at a conceptual level.
- **Do:** Add a daily check-in form with explicit labels, coding-time choice, confidence rating, and a submit button.
- **Principle:** Every external input crosses a trust boundary and must be labeled, parsed, and validated.
- **Retrieve:** Why must a label be programmatically associated with an input?
- **Recovery:** Open the first resource, write three bullets explaining “Design forms as input contracts,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content)

#### Day 012 — Audit accessibility before styling

- **Learn:** Check keyboard order, alternative text, page language, meaningful link text, color-independent meaning, and native controls.
- **Do:** Complete an accessibility checklist and fix at least three issues in the homepage.
- **Principle:** Accessibility is a correctness property, not a decorative enhancement.
- **Retrieve:** What can a keyboard-only test reveal that a mouse test cannot?
- **Recovery:** Open the first resource, write three bullets explaining “Audit accessibility before styling,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility); [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9)

#### Day 013 — Integrate Week 2: HTML, the browser, and accessible document structure

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A semantic, accessible learning-homepage skeleton that explains the journey.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A semantic, accessible learning-homepage skeleton that explains the journey. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A semantic, accessible learning-homepage skeleton that explains the journey.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 014 — Retrieve, review, and plan after Week 2

- **Learn:** Without notes, explain the five concepts from **HTML, the browser, and accessible document structure**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A semantic, accessible learning-homepage skeleton that explains the journey. **Evidence:** Week 2 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

### Week 3 — CSS layout and visual systems

**Milestone:** A responsive homepage with reusable design tokens, accessible cards, and a clear visual hierarchy.

**Skills:** `css`, `responsive-design`, `accessibility`, `design-systems`


#### Day 015 — Understand cascade, inheritance, and specificity

- **Learn:** Learn selectors, declarations, source order, inheritance, and how the browser resolves competing style rules.
- **Do:** Create `styles.css`; style typography and intentionally resolve one specificity conflict without `!important`.
- **Principle:** The cascade is a deterministic conflict-resolution algorithm.
- **Retrieve:** Which wins: a more specific selector or a later equal-specificity selector?
- **Recovery:** Open the first resource, write three bullets explaining “Understand cascade, inheritance, and specificity,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics)

#### Day 016 — Use the box model deliberately

- **Learn:** Study content box, padding, border, margin, `box-sizing`, normal flow, width constraints, and overflow.
- **Do:** Create reusable mission cards and inspect their computed box model in browser tools.
- **Principle:** Layout is constraint solving over nested rectangular boxes.
- **Retrieve:** What changes when `box-sizing: border-box` is applied?
- **Recovery:** Open the first resource, write three bullets explaining “Use the box model deliberately,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics)

#### Day 017 — Build one-dimensional layouts with Flexbox

- **Learn:** Learn main/cross axis, flex container/items, gap, wrapping, alignment, growth, shrinkage, and basis.
- **Do:** Build a responsive navigation bar and a row of progress cards that wraps cleanly.
- **Principle:** Choose an abstraction that matches the dimensionality of the problem.
- **Retrieve:** When is Flexbox a better choice than Grid?
- **Recovery:** Open the first resource, write three bullets explaining “Build one-dimensional layouts with Flexbox,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics)

#### Day 018 — Build two-dimensional layouts with Grid

- **Learn:** Learn tracks, fractional units, minmax, auto-fit/auto-fill, named areas, and intrinsic responsiveness.
- **Do:** Create the dashboard layout using Grid without hard-coded device widths.
- **Principle:** Declarative constraints are often more robust than manually positioning every element.
- **Retrieve:** What does `minmax()` let the browser decide?
- **Recovery:** Open the first resource, write three bullets explaining “Build two-dimensional layouts with Grid,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics)

#### Day 019 — Create a tokenized, responsive design system

- **Learn:** Learn CSS custom properties, spacing scale, typography scale, color contrast, media queries, and reduced motion.
- **Do:** Define tokens in `:root`, add light/dark-ready semantic colors, and make the page usable at narrow and wide widths.
- **Principle:** Design tokens turn repeated decisions into named, consistent interfaces.
- **Retrieve:** Why should tokens be named by purpose rather than by raw color?
- **Recovery:** Open the first resource, write three bullets explaining “Create a tokenized, responsive design system,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 020 — Integrate Week 3: CSS layout and visual systems

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A responsive homepage with reusable design tokens, accessible cards, and a clear visual hierarchy.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A responsive homepage with reusable design tokens, accessible cards, and a clear visual hierarchy. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A responsive homepage with reusable design tokens, accessible cards, and a clear visual hierarchy.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 021 — Retrieve, review, and plan after Week 3

- **Learn:** Without notes, explain the five concepts from **CSS layout and visual systems**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A responsive homepage with reusable design tokens, accessible cards, and a clear visual hierarchy. **Evidence:** Week 3 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9); [MDN — CSS Styling Basics](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

### Week 4 — JavaScript state, control flow, and functions

**Milestone:** A small browser-based daily status and XP calculator with tests written as example cases.

**Skills:** `javascript`, `programming-fundamentals`, `debugging`, `state`


#### Day 022 — Represent values and state

- **Learn:** Learn `const`/`let`, primitive types, expressions, operators, coercion, strict equality, and immutable-by-default thinking.
- **Do:** Create a script that represents today's minutes, completion state, mood, and goal; log type-safe comparisons.
- **Principle:** Programs transform encoded state; choosing representations determines which mistakes are possible.
- **Retrieve:** Why is `===` usually safer than `==`?
- **Recovery:** Open the first resource, write three bullets explaining “Represent values and state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 023 — Branch with explicit conditions

- **Learn:** Study booleans, truthiness, `if/else`, comparison operators, guard clauses, and exhaustive decision tables.
- **Do:** Generate an encouraging message for completed, fallback, paused, and not-started states.
- **Principle:** Control flow is a state machine: inputs and current state determine the next transition.
- **Retrieve:** What edge case is hidden by a broad truthiness check?
- **Recovery:** Open the first resource, write three bullets explaining “Branch with explicit conditions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 024 — Package behavior in functions

- **Learn:** Learn parameters, return values, scope, pure functions, side effects, and naming by intent.
- **Do:** Implement pure `calculateXp`, `getLevel`, and `getEncouragement` functions.
- **Principle:** Functions are contracts that map inputs to outputs while controlling side effects.
- **Retrieve:** How can you tell whether a function is pure?
- **Recovery:** Open the first resource, write three bullets explaining “Package behavior in functions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/)

#### Day 025 — Model ordered data with arrays

- **Learn:** Study array literals, indexing, mutation, iteration, and methods such as `map`, `filter`, and `reduce`.
- **Do:** Represent seven missions and calculate completion count, total XP, and remaining titles.
- **Principle:** Collections let one algorithm operate over many values instead of duplicating code.
- **Retrieve:** What different question does `map` answer compared with `filter`?
- **Recovery:** Open the first resource, write three bullets explaining “Model ordered data with arrays,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 026 — Debug by forming hypotheses

- **Learn:** Learn syntax/runtime/logic errors, stack traces, breakpoints, watch values, minimal reproduction, and test cases.
- **Do:** Seed three bugs in the XP calculator, diagnose each using evidence, then write a short bug journal.
- **Principle:** Debugging is experimental science: observe, hypothesize, isolate, test, and revise.
- **Retrieve:** What evidence would disprove your current bug hypothesis?
- **Recovery:** Open the first resource, write three bullets explaining “Debug by forming hypotheses,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/); [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/)

#### Day 027 — Integrate Week 4: JavaScript state, control flow, and functions

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A small browser-based daily status and XP calculator with tests written as example cases.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A small browser-based daily status and XP calculator with tests written as example cases. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A small browser-based daily status and XP calculator with tests written as example cases.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/)

#### Day 028 — Retrieve, review, and plan after Week 4

- **Learn:** Without notes, explain the five concepts from **JavaScript state, control flow, and functions**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A small browser-based daily status and XP calculator with tests written as example cases. **Evidence:** Week 4 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/)

## Month 2 — JavaScript Fluency and Problem Solving


### Week 5 — Objects, collections, and data modeling

**Milestone:** A well-modeled in-memory roadmap with transformations and defensive validation.

**Skills:** `javascript`, `data-modeling`, `validation`, `json`


#### Day 029 — Model entities with objects

- **Learn:** Learn object literals, properties, methods, destructuring, optional chaining, and references.
- **Do:** Create a `curriculumDay` object with schedule, resources, status, and reflection fields.
- **Principle:** Data modeling chooses boundaries, names, and invariants for real-world concepts.
- **Retrieve:** What is copied when one object variable is assigned to another?
- **Recovery:** Open the first resource, write three bullets explaining “Model entities with objects,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 030 — Design nested data without accidental complexity

- **Learn:** Study arrays of objects, normalized versus nested data, stable identifiers, and avoiding duplicate sources of truth.
- **Do:** Model one week of missions and derive current-day data by ID rather than by copied values.
- **Principle:** A single source of truth prevents inconsistent state.
- **Retrieve:** When does nesting make an update harder?
- **Recovery:** Open the first resource, write three bullets explaining “Design nested data without accidental complexity,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript)

#### Day 031 — Transform collections declaratively

- **Learn:** Deepen `map`, `filter`, `find`, `some`, `every`, `sort`, and `reduce`; avoid mutating shared arrays.
- **Do:** Create selectors for completed days, skill totals, next incomplete mission, and weekly completion percentage.
- **Principle:** Data pipelines compose small transformations and make intent inspectable.
- **Retrieve:** Why can in-place `sort()` create surprising bugs?
- **Recovery:** Open the first resource, write three bullets explaining “Transform collections declaratively,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 032 — Validate data at boundaries

- **Learn:** Learn required fields, predicates, early returns, error objects, and separating validation from business logic.
- **Do:** Write `validateMission` and test valid, missing, wrong-type, and out-of-range inputs.
- **Principle:** Parse untrusted data once at the boundary; keep the interior of the program trustworthy.
- **Retrieve:** What invariant should hold after validation succeeds?
- **Recovery:** Open the first resource, write three bullets explaining “Validate data at boundaries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 033 — Serialize state with JSON

- **Learn:** Study JSON types, `JSON.stringify`, `JSON.parse`, unsupported values, dates as strings, and safe parse errors.
- **Do:** Export and import the week plan; handle malformed JSON without losing current data.
- **Principle:** Serialization converts in-memory structures into a portable protocol representation.
- **Retrieve:** Why does JSON not preserve a JavaScript `Date` object?
- **Recovery:** Open the first resource, write three bullets explaining “Serialize state with JSON,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

#### Day 034 — Integrate Week 5: Objects, collections, and data modeling

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A well-modeled in-memory roadmap with transformations and defensive validation.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A well-modeled in-memory roadmap with transformations and defensive validation. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A well-modeled in-memory roadmap with transformations and defensive validation.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript)

#### Day 035 — Retrieve, review, and plan after Week 5

- **Learn:** Without notes, explain the five concepts from **Objects, collections, and data modeling**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A well-modeled in-memory roadmap with transformations and defensive validation. **Evidence:** Week 5 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript)

### Week 6 — DOM events, forms, and local persistence

**Milestone:** A browser habit tracker with accessible CRUD interactions and durable local state.

**Skills:** `dom`, `events`, `forms`, `local-storage`, `crud`


#### Day 036 — Connect data to the DOM

- **Learn:** Learn query selectors, element creation, text content, attributes, document fragments, and render functions.
- **Do:** Render mission cards from the roadmap array without writing each card manually in HTML.
- **Principle:** A UI is a projection of application state; rendering should be deterministic.
- **Retrieve:** Why should user text usually be assigned with `textContent` rather than `innerHTML`?
- **Recovery:** Open the first resource, write three bullets explaining “Connect data to the DOM,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 037 — Respond to events

- **Learn:** Study event listeners, event objects, bubbling, delegation, default actions, and keyboard activation.
- **Do:** Add complete/reopen buttons using event delegation and accessible button elements.
- **Principle:** Event-driven programs react to messages instead of running one linear script.
- **Retrieve:** How does event delegation reduce listener count?
- **Recovery:** Open the first resource, write three bullets explaining “Respond to events,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 038 — Handle and validate forms

- **Learn:** Learn form submission, `FormData`, constraint validation, custom messages, sanitization versus validation, and focus management.
- **Do:** Implement an add-mission form with inline errors and focus the first invalid field.
- **Principle:** Input UX and data integrity are the same boundary viewed from two sides.
- **Retrieve:** Why is client-side validation insufficient for a server application?
- **Recovery:** Open the first resource, write three bullets explaining “Handle and validate forms,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 039 — Persist with localStorage

- **Learn:** Learn string-only storage, namespaced keys, schema versions, hydration, migration, and failure handling.
- **Do:** Persist missions and completion state; add a version field and safe default when storage is corrupt.
- **Principle:** Persistent state needs a schema and migration strategy even in a small application.
- **Retrieve:** What happens when the shape of saved data changes?
- **Recovery:** Open the first resource, write three bullets explaining “Persist with localStorage,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 040 — Implement complete CRUD behavior

- **Learn:** Combine create, read, update, delete, confirmation, empty states, and state/render separation.
- **Do:** Finish Habit Tracker v1 with add, edit, complete, reopen, and delete actions.
- **Principle:** CRUD is the foundational lifecycle shared by most business applications.
- **Retrieve:** Which operation should be idempotent in this tracker and why?
- **Recovery:** Open the first resource, write three bullets explaining “Implement complete CRUD behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

#### Day 041 — Integrate Week 6: DOM events, forms, and local persistence

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A browser habit tracker with accessible CRUD interactions and durable local state.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A browser habit tracker with accessible CRUD interactions and durable local state. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A browser habit tracker with accessible CRUD interactions and durable local state.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content)

#### Day 042 — Retrieve, review, and plan after Week 6

- **Learn:** Without notes, explain the five concepts from **DOM events, forms, and local persistence**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A browser habit tracker with accessible CRUD interactions and durable local state. **Evidence:** Week 6 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [MDN — Structuring the web with HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content)

### Week 7 — Algorithms, complexity, and recursion

**Milestone:** A tested set of roadmap algorithms with plain-language complexity explanations.

**Skills:** `algorithms`, `data-structures`, `complexity`, `recursion`


#### Day 043 — Decompose problems with pseudocode

- **Learn:** Learn inputs, outputs, constraints, examples, edge cases, and stepwise refinement before syntax.
- **Do:** Write pseudocode for selecting today's mission and calculating a grace-protected streak.
- **Principle:** Algorithm design separates the problem-solving model from language syntax.
- **Retrieve:** Which edge case changes the algorithm rather than merely the code?
- **Recovery:** Open the first resource, write three bullets explaining “Decompose problems with pseudocode,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

#### Day 044 — Search and use stable identifiers

- **Learn:** Compare linear search, lookup tables, and binary search prerequisites; understand identity versus array position.
- **Do:** Implement `findMissionById` and build an ID-indexed map; document time/space tradeoffs.
- **Principle:** Performance depends on both algorithm and data representation.
- **Retrieve:** Why cannot binary search safely run on unsorted data?
- **Recovery:** Open the first resource, write three bullets explaining “Search and use stable identifiers,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

#### Day 045 — Sort without losing information

- **Learn:** Study comparators, stable sorting, copies versus mutation, primary/secondary keys, and date ordering.
- **Do:** Sort missions by status, then date, without mutating the original array.
- **Principle:** Ordering is a policy encoded as a comparison function.
- **Retrieve:** What must a comparator return when two values are equivalent?
- **Recovery:** Open the first resource, write three bullets explaining “Sort without losing information,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 046 — Reason with Big O

- **Learn:** Learn growth rates, worst-case reasoning, constant factors, nested loops, and time-space tradeoffs.
- **Do:** Annotate five roadmap functions with justified Big O estimates and measure one with increasing inputs.
- **Principle:** Complexity predicts scaling behavior independent of a particular machine.
- **Retrieve:** Why is two separate O(n) loops still O(n), not O(n²)?
- **Recovery:** Open the first resource, write three bullets explaining “Reason with Big O,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 047 — Use recursion only when structure fits

- **Learn:** Learn base cases, recursive cases, call stack, tree-shaped problems, and iterative alternatives.
- **Do:** Implement a recursive nested-skill-tree total, then an iterative version; compare clarity and stack risk.
- **Principle:** Recursion mirrors self-similar structure but consumes call-stack state.
- **Retrieve:** What guarantees that a recursive function terminates?
- **Recovery:** Open the first resource, write three bullets explaining “Use recursion only when structure fits,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

#### Day 048 — Integrate Week 7: Algorithms, complexity, and recursion

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A tested set of roadmap algorithms with plain-language complexity explanations.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A tested set of roadmap algorithms with plain-language complexity explanations. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A tested set of roadmap algorithms with plain-language complexity explanations.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

#### Day 049 — Retrieve, review, and plan after Week 7

- **Learn:** Without notes, explain the five concepts from **Algorithms, complexity, and recursion**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A tested set of roadmap algorithms with plain-language complexity explanations. **Evidence:** Week 7 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting)

### Week 8 — Asynchronous JavaScript and foundation project

**Milestone:** A polished Coding Dashboard v1 that loads data asynchronously, handles failures, and documents architecture.

**Skills:** `async-javascript`, `http`, `architecture`, `portfolio`


#### Day 050 — Understand the event loop

- **Learn:** Learn call stack, Web APIs, task queue, microtasks, promises, and why asynchronous work does not block the UI.
- **Do:** Create a small timing demo that predicts and records execution order for synchronous code, promises, and timers.
- **Principle:** Concurrency can be cooperative: work is interleaved around an event loop rather than executed simultaneously.
- **Retrieve:** Why can a resolved Promise callback run before `setTimeout(..., 0)`?
- **Recovery:** Open the first resource, write three bullets explaining “Understand the event loop,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0)

#### Day 051 — Use promises and async/await

- **Learn:** Study pending/fulfilled/rejected states, chaining, `try/catch`, parallel work, and cancellation awareness.
- **Do:** Write an async loader with loading, success, empty, and error states using a local JSON file.
- **Principle:** Asynchronous functions return promises: eventual values that must model both success and failure.
- **Retrieve:** What error is lost when a promise is neither awaited nor returned?
- **Recovery:** Open the first resource, write three bullets explaining “Use promises and async/await,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

#### Day 052 — Fetch data over HTTP

- **Learn:** Learn fetch request lifecycle, status handling, headers, JSON parsing, network failure, and timeout/retry basics.
- **Do:** Load sample roadmap data through `fetch`; explicitly reject non-2xx responses.
- **Principle:** Transport success and application success are different layers.
- **Retrieve:** Why does `fetch` not reject automatically for a 404 response?
- **Recovery:** Open the first resource, write three bullets explaining “Fetch data over HTTP,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

#### Day 053 — Architect Coding Dashboard v1

- **Learn:** Review module boundaries, state ownership, render flow, error handling, and feature slicing.
- **Do:** Split dashboard code into data, storage, selectors, UI, and event modules; add an architecture note.
- **Principle:** Modularity minimizes the number of reasons each file has to change.
- **Retrieve:** Which module should know about localStorage?
- **Recovery:** Open the first resource, write three bullets explaining “Architect Coding Dashboard v1,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/); [The Odin Project — JavaScript Course](https://www.theodinproject.com/paths/full-stack-javascript/courses/javascript)

#### Day 054 — Test, polish, and tell the project story

- **Learn:** Learn behavior-focused tests, README structure, screenshots, limitations, and honest AI-assistance disclosure.
- **Do:** Add lightweight tests for pure functions, polish responsive/a11y states, and write a project README with demo evidence.
- **Principle:** A shipped artifact includes verification and communication, not only source code.
- **Retrieve:** Which claim in the README is backed by a test or screenshot?
- **Recovery:** Open the first resource, write three bullets explaining “Test, polish, and tell the project story,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 055 — Integrate Week 8: Asynchronous JavaScript and foundation project

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A polished Coding Dashboard v1 that loads data asynchronously, handles failures, and documents architecture.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A polished Coding Dashboard v1 that loads data asynchronously, handles failures, and documents architecture. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A polished Coding Dashboard v1 that loads data asynchronously, handles failures, and documents architecture.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

#### Day 056 — Retrieve, review, and plan after Week 8

- **Learn:** Without notes, explain the five concepts from **Asynchronous JavaScript and foundation project**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A polished Coding Dashboard v1 that loads data asynchronously, handles failures, and documents architecture. **Evidence:** Week 8 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MDN — Dynamic scripting with JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting); [University of Helsinki — Full Stack Open Part 0: Fundamentals of Web Apps](https://fullstackopen.com/en/part0); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

## Month 3 — TypeScript, React, and MERN Entry


### Week 9 — TypeScript as executable design

**Milestone:** A typed curriculum domain model and a strict TypeScript practice package.

**Skills:** `typescript`, `type-systems`, `domain-modeling`, `validation`


#### Day 057 — Adopt strict TypeScript

- **Learn:** Learn static versus runtime types, inference, annotations, compiler configuration, `strict`, and why TypeScript erases at runtime.
- **Do:** Create a TypeScript package with strict `tsconfig.json`; type the existing XP and mission utilities.
- **Principle:** A type system constrains representable states before execution but does not validate external runtime data.
- **Retrieve:** What guarantee disappears after TypeScript is compiled to JavaScript?
- **Recovery:** Open the first resource, write three bullets explaining “Adopt strict TypeScript,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

#### Day 058 — Model contracts with types and interfaces

- **Learn:** Study object types, interfaces, optional and readonly properties, type aliases, structural typing, and composition.
- **Do:** Define `CurriculumDay`, `ResourceLink`, `ProgressStatus`, `Reflection`, and `UserSettings` contracts.
- **Principle:** Good types encode domain vocabulary and reduce ambiguous states.
- **Retrieve:** When is a union more precise than an optional property?
- **Recovery:** Open the first resource, write three bullets explaining “Model contracts with types and interfaces,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

#### Day 059 — Use unions and narrowing

- **Learn:** Learn literal unions, discriminated unions, control-flow narrowing, exhaustive `never` checks, and nullable values.
- **Do:** Model progress as a discriminated union and render every status with an exhaustive switch.
- **Principle:** A discriminated union turns implicit state combinations into explicit finite states.
- **Retrieve:** How does an exhaustive check protect future refactors?
- **Recovery:** Open the first resource, write three bullets explaining “Use unions and narrowing,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

#### Day 060 — Type functions, generics, and collections

- **Learn:** Study function signatures, callbacks, generics, constraints, utility types, and avoiding `any`.
- **Do:** Build generic `groupBy`, `indexById`, and typed selector helpers with tests.
- **Principle:** Generics express relationships between types without discarding information.
- **Retrieve:** What relationship does `identity<T>(value: T): T` preserve?
- **Recovery:** Open the first resource, write three bullets explaining “Type functions, generics, and collections,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

#### Day 061 — Validate unknown runtime input

- **Learn:** Learn `unknown` versus `any`, type guards, parsing, schema validation, and trusted internal boundaries.
- **Do:** Write a manual parser or Zod-ready adapter for curriculum JSON and reject malformed records with useful errors.
- **Principle:** Type checking and runtime validation solve different halves of boundary safety.
- **Retrieve:** Why should decoded JSON begin as `unknown`?
- **Recovery:** Open the first resource, write three bullets explaining “Validate unknown runtime input,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 062 — Integrate Week 9: TypeScript as executable design

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A typed curriculum domain model and a strict TypeScript practice package.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A typed curriculum domain model and a strict TypeScript practice package. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A typed curriculum domain model and a strict TypeScript practice package.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 063 — Retrieve, review, and plan after Week 9

- **Learn:** Without notes, explain the five concepts from **TypeScript as executable design**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A typed curriculum domain model and a strict TypeScript practice package. **Evidence:** Week 9 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

### Week 10 — React mental model and component composition

**Milestone:** A typed React shell that renders curriculum data through small, reusable components.

**Skills:** `react`, `components`, `state`, `frontend-testing`


#### Day 064 — Think in components and pure renders

- **Learn:** Learn components, JSX, props, one-way data flow, pure rendering, keys, and React's declarative model.
- **Do:** Create a Vite React TypeScript app and render a typed `MissionCard` list from static data.
- **Principle:** Declarative UI describes the desired projection of state rather than a sequence of DOM mutations.
- **Retrieve:** Why must render logic avoid side effects?
- **Recovery:** Open the first resource, write three bullets explaining “Think in components and pure renders,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1)

#### Day 065 — Manage local state

- **Learn:** Study `useState`, state snapshots, functional updates, immutability, batching, and derived values.
- **Do:** Add completion toggles and a progress summary without storing values that can be derived.
- **Principle:** Store minimal canonical state; compute the rest to prevent synchronization bugs.
- **Retrieve:** When should the functional updater form be used?
- **Recovery:** Open the first resource, write three bullets explaining “Manage local state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1)

#### Day 066 — Handle events and forms in React

- **Learn:** Learn controlled inputs, submit events, validation state, lifting state, and accessible feedback.
- **Do:** Build a typed reflection form with inline errors and a clear success state.
- **Principle:** Form state is a small state machine with invalid, valid, submitting, success, and failure transitions.
- **Retrieve:** What tradeoff distinguishes controlled and uncontrolled inputs?
- **Recovery:** Open the first resource, write three bullets explaining “Handle events and forms in React,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1)

#### Day 067 — Compose components deliberately

- **Learn:** Study children, composition over inheritance, prop drilling, local versus shared state, and reusable boundaries.
- **Do:** Extract `ProgressRing`, `ResourceCard`, `ScheduleBlock`, and `ReflectionForm` with focused props.
- **Principle:** Component boundaries should follow responsibilities and change patterns, not arbitrary file size.
- **Retrieve:** Which state belongs closest to the component that uses it?
- **Recovery:** Open the first resource, write three bullets explaining “Compose components deliberately,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1)

#### Day 068 — Test component behavior

- **Learn:** Learn user-centered assertions, accessible queries, test isolation, and avoiding implementation-detail tests.
- **Do:** Add tests for mission rendering, completion interaction, and invalid reflection submission.
- **Principle:** Tests should verify externally meaningful behavior rather than internal component structure.
- **Retrieve:** Why is querying by accessible role often stronger than a CSS class?
- **Recovery:** Open the first resource, write three bullets explaining “Test component behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 069 — Integrate Week 10: React mental model and component composition

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A typed React shell that renders curriculum data through small, reusable components.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A typed React shell that renders curriculum data through small, reusable components. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A typed React shell that renders curriculum data through small, reusable components.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5)

#### Day 070 — Retrieve, review, and plan after Week 10

- **Learn:** Without notes, explain the five concepts from **React mental model and component composition**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A typed React shell that renders curriculum data through small, reusable components. **Evidence:** Week 10 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5)

### Week 11 — React effects, routing, and server communication

**Milestone:** A multi-page frontend that fetches missions and handles loading, errors, and URL-driven state.

**Skills:** `react`, `routing`, `http`, `server-state`, `resilience`


#### Day 071 — Separate effects from rendering

- **Learn:** Learn `useEffect`, dependency arrays, synchronization with external systems, cleanup, and when an effect is unnecessary.
- **Do:** Move persistence into a focused effect and remove one effect by deriving data during render.
- **Principle:** Effects synchronize with systems outside React; they are not a general computation mechanism.
- **Retrieve:** What external system justifies this effect?
- **Recovery:** Open the first resource, write three bullets explaining “Separate effects from rendering,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1)

#### Day 072 — Model remote data states

- **Learn:** Study loading, success, empty, stale, and error states; distinguish server state from local UI state.
- **Do:** Create a typed fetch client and render explicit states for the missions endpoint.
- **Principle:** Remote data has latency, failure, and ownership semantics unlike local state.
- **Retrieve:** Why is an empty array different from data that has not loaded?
- **Recovery:** Open the first resource, write three bullets explaining “Model remote data states,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

#### Day 073 — Use URL routing as application state

- **Learn:** Learn routes, parameters, navigation, nested layouts, 404 handling, and deep-linkable state.
- **Do:** Add `/`, `/today`, `/roadmap`, `/day/:dayNumber`, and a not-found route.
- **Principle:** URLs are durable, shareable identifiers for application state.
- **Retrieve:** Which state should live in the URL rather than component memory?
- **Recovery:** Open the first resource, write three bullets explaining “Use URL routing as application state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

#### Day 074 — Centralize API boundaries

- **Learn:** Study typed fetch wrappers, DTOs, error normalization, abort signals, and environment-based base URLs.
- **Do:** Implement a client layer that returns typed results and consistent `ApiError` objects.
- **Principle:** Boundary adapters isolate transport details from domain/UI logic.
- **Retrieve:** Where should HTTP status codes be translated into domain errors?
- **Recovery:** Open the first resource, write three bullets explaining “Centralize API boundaries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2); [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

#### Day 075 — Design resilient optimistic interactions

- **Learn:** Learn pessimistic versus optimistic updates, rollback, idempotency, duplicate submission, and retry rules.
- **Do:** Add an optimistic complete action with disabled duplicate submission and rollback on failure.
- **Principle:** Optimism improves perceived latency but creates a reconciliation obligation.
- **Retrieve:** Which operation is safe to retry, and what makes it idempotent?
- **Recovery:** Open the first resource, write three bullets explaining “Design resilient optimistic interactions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 076 — Integrate Week 11: React effects, routing, and server communication

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A multi-page frontend that fetches missions and handles loading, errors, and URL-driven state.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A multi-page frontend that fetches missions and handles loading, errors, and URL-driven state. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A multi-page frontend that fetches missions and handles loading, errors, and URL-driven state.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

#### Day 077 — Retrieve, review, and plan after Week 11

- **Learn:** Without notes, explain the five concepts from **React effects, routing, and server communication**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A multi-page frontend that fetches missions and handles loading, errors, and URL-driven state. **Evidence:** Week 11 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [React — React Learn](https://react.dev/learn); [University of Helsinki — Full Stack Open Part 1: React](https://fullstackopen.com/en/part1); [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2)

### Week 12 — Node, Express, and REST fundamentals

**Milestone:** A typed Express API with health, curriculum, and progress routes plus centralized errors.

**Skills:** `node`, `express`, `rest`, `api-testing`, `security`


#### Day 078 — Understand the Node runtime

- **Learn:** Learn Node's event-driven runtime, modules, package scripts, environment variables, process lifecycle, and blocking work.
- **Do:** Create a TypeScript Express service with a start/dev script and `/health` endpoint.
- **Principle:** A server process coordinates I/O; blocking the event loop delays every request.
- **Retrieve:** What kind of work can block Node's event loop?
- **Recovery:** Open the first resource, write three bullets explaining “Understand the Node runtime,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Node.js — Node.js Learn](https://nodejs.org/en/learn); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 079 — Design HTTP resource routes

- **Learn:** Study resources, verbs, paths, status codes, headers, JSON, and REST as a design style rather than a law.
- **Do:** Specify and implement `GET /api/curriculum`, `GET /api/curriculum/:dayNumber`, and `POST /api/progress`.
- **Principle:** An API is a versioned contract between independently changing clients and servers.
- **Retrieve:** What status code fits creation of a new progress record?
- **Recovery:** Open the first resource, write three bullets explaining “Design HTTP resource routes,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

#### Day 080 — Use middleware as a pipeline

- **Learn:** Learn middleware order, request context, logging, parsers, authentication hooks, and error middleware.
- **Do:** Add request IDs, structured logging, JSON parsing, 404 handling, and centralized error responses.
- **Principle:** Cross-cutting concerns belong in composable pipeline stages.
- **Retrieve:** Why must error middleware be registered after routes?
- **Recovery:** Open the first resource, write three bullets explaining “Use middleware as a pipeline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Express — Express Getting Started](https://expressjs.com/en/starter/installing.html); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 081 — Validate and sanitize API input

- **Learn:** Study DTO schemas, allowlists, limits, unknown fields, consistent errors, and defense at the server boundary.
- **Do:** Validate progress input and return a field-level error shape consumed by the React form.
- **Principle:** Never trust the client, including a client you wrote yourself.
- **Retrieve:** What is the difference between validation and sanitization?
- **Recovery:** Open the first resource, write three bullets explaining “Validate and sanitize API input,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 082 — Test the API contract

- **Learn:** Learn unit versus integration tests, isolated test app, deterministic fixtures, Supertest-style requests, and cleanup.
- **Do:** Test health, valid progress creation, invalid input, unknown route, and error response shape.
- **Principle:** Integration tests protect the behavior visible across module boundaries.
- **Retrieve:** Which test proves middleware order is correct?
- **Recovery:** Open the first resource, write three bullets explaining “Test the API contract,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 083 — Integrate Week 12: Node, Express, and REST fundamentals

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A typed Express API with health, curriculum, and progress routes plus centralized errors.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A typed Express API with health, curriculum, and progress routes plus centralized errors. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A typed Express API with health, curriculum, and progress routes plus centralized errors.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Node.js — Node.js Learn](https://nodejs.org/en/learn); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

#### Day 084 — Retrieve, review, and plan after Week 12

- **Learn:** Without notes, explain the five concepts from **Node, Express, and REST fundamentals**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A typed Express API with health, curriculum, and progress routes plus centralized errors. **Evidence:** Week 12 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Node.js — Node.js Learn](https://nodejs.org/en/learn); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

### Week 13 — MERN vertical slice and frontend MVP

**Milestone:** A working frontend-to-Express vertical slice for viewing and completing a seeded mission.

**Skills:** `mern`, `vertical-slices`, `contracts`, `full-stack-testing`


#### Day 085 — Plan the first vertical slice

- **Learn:** Learn vertical slicing, walking skeletons, acceptance criteria, API contracts, and risk-first implementation.
- **Do:** Write a small plan for login-free `view day → mark complete → see progress` and define tests before implementation.
- **Principle:** A walking skeleton validates the architecture with the smallest end-to-end flow.
- **Retrieve:** Which uncertainty should the first slice retire?
- **Recovery:** Open the first resource, write three bullets explaining “Plan the first vertical slice,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 086 — Share contracts without coupling layers

- **Learn:** Study shared domain types, transport DTOs, schema ownership, generated versus handwritten contracts, and versioning.
- **Do:** Create a `shared` package for validated DTO schemas and import it from client and server.
- **Principle:** Shared contracts reduce drift, but shared implementation can create tight coupling.
- **Retrieve:** Which types should remain server-private?
- **Recovery:** Open the first resource, write three bullets explaining “Share contracts without coupling layers,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript); [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

#### Day 087 — Connect React to Express

- **Learn:** Learn CORS, proxy/dev configuration, environment variables, cookies versus tokens, and network debugging.
- **Do:** Load a seeded mission from Express in the Day page and inspect the complete request/response in DevTools.
- **Principle:** Distributed debugging follows the data across process and network boundaries.
- **Retrieve:** Where would a CORS failure appear, and what does it prevent?
- **Recovery:** Open the first resource, write three bullets explaining “Connect React to Express,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 088 — Implement progress mutation end to end

- **Learn:** Review idempotent completion, client mutation states, server validation, persistence abstraction, and response reconciliation.
- **Do:** Mark the mission complete through the API and update the dashboard summary from the returned canonical record.
- **Principle:** The server is authoritative for shared persistent state.
- **Retrieve:** Why should the UI use the server response rather than assume the write succeeded?
- **Recovery:** Open the first resource, write three bullets explaining “Implement progress mutation end to end,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 2: Communicating with Server](https://fullstackopen.com/en/part2); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 089 — Harden the slice with tests and error UX

- **Learn:** Learn contract tests, failure injection, retry copy, accessible alerts, and avoiding false success celebrations.
- **Do:** Add API and component tests plus a forced-error mode; show retry without losing the reflection draft.
- **Principle:** Reliability includes preserving user work when dependencies fail.
- **Retrieve:** What user state must survive a failed completion request?
- **Recovery:** Open the first resource, write three bullets explaining “Harden the slice with tests and error UX,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5)

#### Day 090 — Integrate Week 13: MERN vertical slice and frontend MVP

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A working frontend-to-Express vertical slice for viewing and completing a seeded mission.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A working frontend-to-Express vertical slice for viewing and completing a seeded mission. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A working frontend-to-Express vertical slice for viewing and completing a seeded mission.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

#### Day 091 — Retrieve, review, and plan after Week 13

- **Learn:** Without notes, explain the five concepts from **MERN vertical slice and frontend MVP**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A working frontend-to-Express vertical slice for viewing and completing a seeded mission. **Evidence:** Week 13 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [University of Helsinki — Full Stack Open Part 9: TypeScript](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-typescript)

## Month 4 — Production-Ready MERN


### Week 14 — MongoDB data modeling and persistence

**Milestone:** A Mongo-backed curriculum and progress API with indexes, migrations, and deterministic seed data.

**Skills:** `mongodb`, `mongoose`, `database-design`, `indexes`, `migrations`


#### Day 092 — Choose documents and boundaries

- **Learn:** Learn collections, documents, BSON, embedded versus referenced data, access patterns, and MongoDB's flexible schema.
- **Do:** Design Mongo collections for users, curriculum days, progress logs, and reflections; document embedding/reference decisions.
- **Principle:** Database design begins with the queries and consistency requirements the application must support.
- **Retrieve:** Which data is read together often enough to justify embedding?
- **Recovery:** Open the first resource, write three bullets explaining “Choose documents and boundaries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MongoDB University — MongoDB University Learning Paths](https://learn.mongodb.com/); [MongoDB — MongoDB Node.js Driver Quick Start](https://www.mongodb.com/docs/drivers/node/current/quick-start/)

#### Day 093 — Model schemas with Mongoose

- **Learn:** Study schema definitions, required fields, defaults, enums, timestamps, validation, and TypeScript inference.
- **Do:** Implement `CurriculumDay` and `ProgressLog` models with constraints and clear domain methods.
- **Principle:** Application schemas make implicit invariants executable even in a flexible database.
- **Retrieve:** Which invariant belongs in the database model rather than only the UI?
- **Recovery:** Open the first resource, write three bullets explaining “Model schemas with Mongoose,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Mongoose — Mongoose Guide](https://mongoosejs.com/docs/guide.html); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 094 — Query, update, and paginate safely

- **Learn:** Learn filters, projections, sorting, updates, atomic operators, cursor versus offset pagination, and avoiding unbounded reads.
- **Do:** Add paginated curriculum listing and an atomic upsert for progress completion.
- **Principle:** Efficient data access returns only needed records and fields with predictable cost.
- **Retrieve:** Why is an atomic update safer than read-modify-write for concurrent requests?
- **Recovery:** Open the first resource, write three bullets explaining “Query, update, and paginate safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MongoDB — MongoDB Node.js Driver Quick Start](https://www.mongodb.com/docs/drivers/node/current/quick-start/); [Mongoose — Mongoose Guide](https://mongoosejs.com/docs/guide.html)

#### Day 095 — Design indexes from query patterns

- **Learn:** Study single/compound/unique indexes, selectivity, query plans, write cost, and index ordering.
- **Do:** Add and explain indexes for day number, user/day uniqueness, and recent progress history.
- **Principle:** Indexes trade storage and write work for faster reads; every index must serve a known query.
- **Retrieve:** Why does field order matter in a compound index?
- **Recovery:** Open the first resource, write three bullets explaining “Design indexes from query patterns,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MongoDB University — MongoDB University Learning Paths](https://learn.mongodb.com/); [Mongoose — Mongoose Guide](https://mongoosejs.com/docs/guide.html)

#### Day 096 — Seed and migrate deterministic data

- **Learn:** Learn idempotent seeds, stable keys, schema versions, data migrations, rollback thinking, and test databases.
- **Do:** Create `seed:curriculum`, `seed:validate`, and a versioned migration scaffold that can run repeatedly without duplicates.
- **Principle:** Persistent data outlives deployments, so schema evolution must be planned explicitly.
- **Retrieve:** What makes a seed command idempotent?
- **Recovery:** Open the first resource, write three bullets explaining “Seed and migrate deterministic data,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [MongoDB — MongoDB Node.js Driver Quick Start](https://www.mongodb.com/docs/drivers/node/current/quick-start/)

#### Day 097 — Integrate Week 14: MongoDB data modeling and persistence

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A Mongo-backed curriculum and progress API with indexes, migrations, and deterministic seed data.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A Mongo-backed curriculum and progress API with indexes, migrations, and deterministic seed data. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A Mongo-backed curriculum and progress API with indexes, migrations, and deterministic seed data.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MongoDB University — MongoDB University Learning Paths](https://learn.mongodb.com/); [MongoDB — MongoDB Node.js Driver Quick Start](https://www.mongodb.com/docs/drivers/node/current/quick-start/); [Mongoose — Mongoose Guide](https://mongoosejs.com/docs/guide.html)

#### Day 098 — Retrieve, review, and plan after Week 14

- **Learn:** Without notes, explain the five concepts from **MongoDB data modeling and persistence**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A Mongo-backed curriculum and progress API with indexes, migrations, and deterministic seed data. **Evidence:** Week 14 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MongoDB University — MongoDB University Learning Paths](https://learn.mongodb.com/); [MongoDB — MongoDB Node.js Driver Quick Start](https://www.mongodb.com/docs/drivers/node/current/quick-start/); [Mongoose — Mongoose Guide](https://mongoosejs.com/docs/guide.html)

### Week 15 — Authentication, authorization, and web security

**Milestone:** Secure registration/login with HTTP-only cookies, protected routes, ownership checks, and tests.

**Skills:** `authentication`, `authorization`, `web-security`, `threat-modeling`


#### Day 099 — Separate identity, authentication, and authorization

- **Learn:** Learn user identity, credential verification, session/token, role/ownership policy, and least privilege.
- **Do:** Write an auth threat model and define protected resources before writing endpoints.
- **Principle:** Authentication answers who; authorization answers whether that identity may perform this action.
- **Retrieve:** Which checks must happen on every user-owned resource request?
- **Recovery:** Open the first resource, write three bullets explaining “Separate identity, authentication, and authorization,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 100 — Store passwords safely

- **Learn:** Study one-way password hashing, salts, work factor, credential stuffing, generic errors, and rate limiting.
- **Do:** Implement registration with bcrypt/Argon2-compatible abstraction, password policy, duplicate-email handling, and tests.
- **Principle:** Passwords are verified, never decrypted; slow salted hashes raise attack cost.
- **Retrieve:** Why should login errors not reveal whether an email exists?
- **Recovery:** Open the first resource, write three bullets explaining “Store passwords safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 101 — Manage sessions or tokens

- **Learn:** Compare server sessions and JWTs, expiration, refresh, revocation, HTTP-only/Secure/SameSite cookies, and CSRF implications.
- **Do:** Implement short-lived authenticated sessions using an HTTP-only cookie and document the chosen threat tradeoffs.
- **Principle:** Security mechanisms must be evaluated as a complete flow, not as isolated technologies.
- **Retrieve:** What attack does `HttpOnly` reduce, and what attack does it not solve?
- **Recovery:** Open the first resource, write three bullets explaining “Manage sessions or tokens,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 102 — Enforce authorization at the data boundary

- **Learn:** Learn object-level authorization, ownership filters, mass assignment, route guards, and deny-by-default policies.
- **Do:** Protect reflection/progress endpoints and query by both user ID and resource ID; add cross-user access tests.
- **Principle:** A hidden button is not authorization; enforcement must occur on the trusted server.
- **Retrieve:** What is broken object-level authorization?
- **Recovery:** Open the first resource, write three bullets explaining “Enforce authorization at the data boundary,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 103 — Harden common web boundaries

- **Learn:** Review CORS, CSRF, XSS, secure headers, input limits, rate limiting, secret management, dependency risk, and logging hygiene.
- **Do:** Add Helmet, explicit CORS, request limits, login rate limiting, sanitized logs, `.env.example`, and a security test checklist.
- **Principle:** Defense in depth assumes any single control can fail.
- **Retrieve:** Which sensitive values must never appear in logs?
- **Recovery:** Open the first resource, write three bullets explaining “Harden common web boundaries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 104 — Integrate Week 15: Authentication, authorization, and web security

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: Secure registration/login with HTTP-only cookies, protected routes, ownership checks, and tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: Secure registration/login with HTTP-only cookies, protected routes, ownership checks, and tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: Secure registration/login with HTTP-only cookies, protected routes, ownership checks, and tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 105 — Retrieve, review, and plan after Week 15

- **Learn:** Without notes, explain the five concepts from **Authentication, authorization, and web security**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: Secure registration/login with HTTP-only cookies, protected routes, ownership checks, and tests. **Evidence:** Week 15 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

### Week 16 — Progress engine, ethical reinforcement, and analytics

**Milestone:** A tested progress/XP/streak engine with recovery mechanics and non-shaming visual feedback.

**Skills:** `gamification`, `state-machines`, `analytics`, `ethical-design`


#### Day 106 — Model progress as a state machine

- **Learn:** Define allowed states and transitions for not started, opened, in progress, completed, fallback completed, and recovery.
- **Do:** Implement a pure transition function and reject impossible transitions with domain errors.
- **Principle:** Explicit state machines prevent invalid combinations and clarify retry behavior.
- **Retrieve:** Which transitions should be idempotent?
- **Recovery:** Open the first resource, write three bullets explaining “Model progress as a state machine,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 107 — Implement XP as transparent feedback

- **Learn:** Learn deterministic scoring, event ledgers versus stored totals, replayability, and avoiding reward inflation.
- **Do:** Create XP events for opening, completing, reflecting, proving, reviewing, and fallback wins; derive totals from events.
- **Principle:** Derived totals are easier to audit when the underlying events are immutable.
- **Retrieve:** Why is an XP ledger more trustworthy than incrementing a single total blindly?
- **Recovery:** Open the first resource, write three bullets explaining “Implement XP as transparent feedback,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4)

#### Day 108 — Design humane streaks and recovery

- **Learn:** Study rolling momentum, grace tokens, return wins, implementation intentions, and why destructive streaks create avoidance.
- **Do:** Implement current streak, longest streak, seven-day momentum, grace-token earning/use, and a no-shame recovery flow.
- **Principle:** Behavior-support systems should preserve autonomy and competence instead of exploiting loss aversion.
- **Retrieve:** How can the UI reward returning without pretending a missed day did not happen?
- **Recovery:** Open the first resource, write three bullets explaining “Design humane streaks and recovery,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [The Odin Project — Foundations](https://www.theodinproject.com/paths/foundations/courses/foundations)

#### Day 109 — Calculate meaningful learning analytics

- **Learn:** Learn numerator/denominator honesty, rolling windows, cohort-free personal baselines, and misleading vanity metrics.
- **Do:** Build weekly completion, active days, fallback wins, skill practice distribution, and confidence trend selectors.
- **Principle:** Metrics are compressed models of behavior; their definitions determine the story they tell.
- **Retrieve:** What denominator makes a weekly completion rate honest?
- **Recovery:** Open the first resource, write three bullets explaining “Calculate meaningful learning analytics,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 110 — Celebrate evidence, not randomness

- **Learn:** Design milestone triggers, accessible motion, reduced-motion fallbacks, positive copy, and meaningful achievement criteria.
- **Do:** Implement badge unlocks, a completion story card, and a subtle SVG particle celebration tied to actual work.
- **Principle:** Feedback is strongest when it is timely, specific, and connected to controllable behavior.
- **Retrieve:** Which accomplishment does each celebration explicitly name?
- **Recovery:** Open the first resource, write three bullets explaining “Celebrate evidence, not randomness,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility); [React — React Learn](https://react.dev/learn)

#### Day 111 — Integrate Week 16: Progress engine, ethical reinforcement, and analytics

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A tested progress/XP/streak engine with recovery mechanics and non-shaming visual feedback.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A tested progress/XP/streak engine with recovery mechanics and non-shaming visual feedback. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A tested progress/XP/streak engine with recovery mechanics and non-shaming visual feedback.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

#### Day 112 — Retrieve, review, and plan after Week 16

- **Learn:** Without notes, explain the five concepts from **Progress engine, ethical reinforcement, and analytics**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A tested progress/XP/streak engine with recovery mechanics and non-shaming visual feedback. **Evidence:** Week 16 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/); [freeCodeCamp — JavaScript Certification](https://www.freecodecamp.org/learn/javascript-v9)

### Week 17 — Testing pyramid, deployment, and MERN MVP

**Milestone:** A deployed or reproducibly runnable MERN MVP with CI, end-to-end tests, documentation, and a demo story.

**Skills:** `testing`, `ci-cd`, `deployment`, `portfolio`, `mern`


#### Day 113 — Build a risk-based test strategy

- **Learn:** Learn unit, integration, component, and end-to-end scopes; test doubles; contract risk; and the cost of brittle tests.
- **Do:** Create a test matrix prioritizing auth, completion, seed integrity, and recovery; fill the highest-risk gaps.
- **Principle:** Test depth should match failure impact and the boundary being verified.
- **Retrieve:** Which critical behavior is not protected by a lower-level test?
- **Recovery:** Open the first resource, write three bullets explaining “Build a risk-based test strategy,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 114 — Automate a real user journey

- **Learn:** Study browser E2E testing, stable selectors, test data, isolation, waiting for user-visible states, and failure artifacts.
- **Do:** Add an E2E flow: register → open Day 1 → complete → reflect → see XP and roadmap progress.
- **Principle:** End-to-end tests validate integration but should remain few, deterministic, and business-critical.
- **Retrieve:** What assertion proves the backend write, not only the frontend animation?
- **Recovery:** Open the first resource, write three bullets explaining “Automate a real user journey,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 115 — Create continuous integration

- **Learn:** Learn CI triggers, dependency caching, secret separation, parallel jobs, artifacts, and fail-fast versus complete reporting.
- **Do:** Add GitHub Actions for install, lint, typecheck, unit/integration tests, seed validation, and production build.
- **Principle:** Automation makes the definition of quality repeatable for every change.
- **Retrieve:** Which command locally reproduces every CI quality gate?
- **Recovery:** Open the first resource, write three bullets explaining “Create continuous integration,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — Understanding GitHub Actions](https://docs.github.com/en/actions/about-github-actions/understanding-github-actions); [University of Helsinki — Full Stack Open Part 11: CI/CD](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-continuous-integration)

#### Day 116 — Prepare reproducible deployment

- **Learn:** Study build artifacts, environments, configuration, health/readiness checks, migrations, backups, and rollback.
- **Do:** Add production configs, health checks, deployment notes, and a one-command local startup path.
- **Principle:** A release is an operational change with verification and recovery steps.
- **Retrieve:** How will you tell whether a release is healthy before users report a problem?
- **Recovery:** Open the first resource, write three bullets explaining “Prepare reproducible deployment,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 117 — Package the MERN MVP as portfolio evidence

- **Learn:** Learn README narrative, architecture diagrams, screenshots, demo data, limitations, security notes, and interview stories.
- **Do:** Publish the MVP documentation and a two-minute demo script; create a tagged release or documented release checkpoint.
- **Principle:** Professional engineering includes explaining tradeoffs and evidence, not just showing features.
- **Retrieve:** Which design decision can you defend with a concrete constraint?
- **Recovery:** Open the first resource, write three bullets explaining “Package the MERN MVP as portfolio evidence,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 118 — Integrate Week 17: Testing pyramid, deployment, and MERN MVP

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A deployed or reproducibly runnable MERN MVP with CI, end-to-end tests, documentation, and a demo story.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A deployed or reproducibly runnable MERN MVP with CI, end-to-end tests, documentation, and a demo story. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A deployed or reproducibly runnable MERN MVP with CI, end-to-end tests, documentation, and a demo story.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 119 — Retrieve, review, and plan after Week 17

- **Learn:** Without notes, explain the five concepts from **Testing pyramid, deployment, and MERN MVP**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A deployed or reproducibly runnable MERN MVP with CI, end-to-end tests, documentation, and a demo story. **Evidence:** Week 17 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [University of Helsinki — Full Stack Open Part 4: Testing and User Administration](https://fullstackopen.com/en/part4); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

## Month 5 — Data, Delivery, and Systems Foundations


### Week 18 — Relational modeling and SQL

**Milestone:** A PostgreSQL lab that mirrors selected product data and demonstrates normalized queries, joins, and transactions.

**Skills:** `sql`, `postgresql`, `relational-modeling`, `transactions`, `indexes`


#### Day 120 — Think relationally

- **Learn:** Learn tables, rows, columns, primary/foreign keys, entities, relationships, cardinality, and normalization.
- **Do:** Model users, curriculum days, progress, skills, and achievements in an ER diagram; compare with Mongo choices.
- **Principle:** Relational design makes relationships and constraints explicit in a shared schema.
- **Retrieve:** Which many-to-many relationship needs a junction table?
- **Recovery:** Open the first resource, write three bullets explaining “Think relationally,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [University of Helsinki — Full Stack Open Part 13: Relational Databases](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases)

#### Day 121 — Query with SELECT

- **Learn:** Study projection, filtering, ordering, expressions, aliases, NULL, and three-valued logic.
- **Do:** Create a small PostgreSQL dataset and answer five learning-progress questions with readable SQL.
- **Principle:** Declarative queries specify the result, leaving execution strategy to the database.
- **Retrieve:** Why does `column = NULL` not behave as expected?
- **Recovery:** Open the first resource, write three bullets explaining “Query with SELECT,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

#### Day 122 — Combine tables with joins

- **Learn:** Learn inner/left joins, join predicates, fan-out, duplicate rows, and aggregation after joins.
- **Do:** Query each user’s completion count and include users with zero completions.
- **Principle:** Joins reconstruct views of related facts stored separately.
- **Retrieve:** Why is a filter in `WHERE` different from one in a left-join `ON` clause?
- **Recovery:** Open the first resource, write three bullets explaining “Combine tables with joins,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [University of Helsinki — Full Stack Open Part 13: Relational Databases](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases)

#### Day 123 — Enforce integrity with constraints and transactions

- **Learn:** Study unique/check/foreign-key constraints, ACID, transaction boundaries, rollback, and isolation intuition.
- **Do:** Add constraints and implement an XP-award transaction that cannot create duplicate event credit.
- **Principle:** Databases protect invariants under concurrent failures, not only store records.
- **Retrieve:** Which invariant must remain true if the process crashes halfway through?
- **Recovery:** Open the first resource, write three bullets explaining “Enforce integrity with constraints and transactions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

#### Day 124 — Index and inspect query plans

- **Learn:** Learn B-tree intuition, indexes, selectivity, composite order, `EXPLAIN`, full scans, and write tradeoffs.
- **Do:** Measure a progress-history query before and after an appropriate index; record the plan difference.
- **Principle:** Optimization starts with observed bottlenecks and the database’s execution plan.
- **Retrieve:** Why can an index be ignored even when it exists?
- **Recovery:** Open the first resource, write three bullets explaining “Index and inspect query plans,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [University of Helsinki — Full Stack Open Part 13: Relational Databases](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases)

#### Day 125 — Integrate Week 18: Relational modeling and SQL

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A PostgreSQL lab that mirrors selected product data and demonstrates normalized queries, joins, and transactions.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A PostgreSQL lab that mirrors selected product data and demonstrates normalized queries, joins, and transactions. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A PostgreSQL lab that mirrors selected product data and demonstrates normalized queries, joins, and transactions.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [University of Helsinki — Full Stack Open Part 13: Relational Databases](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

#### Day 126 — Retrieve, review, and plan after Week 18

- **Learn:** Without notes, explain the five concepts from **Relational modeling and SQL**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A PostgreSQL lab that mirrors selected product data and demonstrates normalized queries, joins, and transactions. **Evidence:** Week 18 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [University of Helsinki — Full Stack Open Part 13: Relational Databases](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-relational-databases); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

### Week 19 — Containers and local orchestration

**Milestone:** A Docker Compose environment for web, Node API, MongoDB, PostgreSQL lab, and future Python service.

**Skills:** `docker`, `containers`, `devops`, `distributed-systems`


#### Day 127 — Understand images and containers

- **Learn:** Learn image layers, containers, registries, build context, Dockerfiles, and isolation versus virtual machines.
- **Do:** Containerize the Node API with a small, non-root, multi-stage Dockerfile.
- **Principle:** A container is a process with isolated views and packaged dependencies, not a miniature physical machine.
- **Retrieve:** What belongs in an image, and what should remain runtime configuration?
- **Recovery:** Open the first resource, write three bullets explaining “Understand images and containers,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Docker — Docker Get Started](https://docs.docker.com/get-started/); [University of Helsinki — Full Stack Open Part 12: Containers](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers)

#### Day 128 — Make builds reproducible and cacheable

- **Learn:** Study layer ordering, lockfiles, `.dockerignore`, deterministic installs, build cache, and image size.
- **Do:** Reorder the Dockerfile for dependency caching and compare image size/build behavior.
- **Principle:** Reproducibility requires pinned inputs and controlled build steps.
- **Retrieve:** Which file change should invalidate the dependency-install layer?
- **Recovery:** Open the first resource, write three bullets explaining “Make builds reproducible and cacheable,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Docker — Docker Get Started](https://docs.docker.com/get-started/); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 129 — Orchestrate services with Compose

- **Learn:** Learn service names, networks, ports, volumes, health checks, dependencies, and environment injection.
- **Do:** Create Compose services for client, API, MongoDB, PostgreSQL, and a placeholder Python AI service.
- **Principle:** Distributed applications need explicit service discovery, lifecycle, and dependency health.
- **Retrieve:** Why should services connect by service name rather than `localhost`?
- **Recovery:** Open the first resource, write three bullets explaining “Orchestrate services with Compose,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 12: Containers](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers); [Docker — Docker Get Started](https://docs.docker.com/get-started/)

#### Day 130 — Persist state and manage startup readiness

- **Learn:** Study bind mounts versus named volumes, initialization, readiness versus process start, and graceful shutdown.
- **Do:** Add named database volumes, health checks, and retrying startup rather than fixed sleep delays.
- **Principle:** A running process is not necessarily a ready dependency.
- **Retrieve:** What data disappears when a container is removed without a volume?
- **Recovery:** Open the first resource, write three bullets explaining “Persist state and manage startup readiness,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 12: Containers](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 131 — Harden the developer experience

- **Learn:** Learn Make/package scripts, logs, shell access, reset commands, seed workflows, and documenting common failures.
- **Do:** Create one-command `dev`, `test`, `seed`, `reset`, and `logs` workflows with a troubleshooting guide.
- **Principle:** Tooling is part of the product for contributors; low-friction feedback improves quality.
- **Retrieve:** Can a new contributor reproduce the environment from the README alone?
- **Recovery:** Open the first resource, write three bullets explaining “Harden the developer experience,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — 2026 Course Index](https://missing.csail.mit.edu/2026/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 132 — Integrate Week 19: Containers and local orchestration

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A Docker Compose environment for web, Node API, MongoDB, PostgreSQL lab, and future Python service.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A Docker Compose environment for web, Node API, MongoDB, PostgreSQL lab, and future Python service. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A Docker Compose environment for web, Node API, MongoDB, PostgreSQL lab, and future Python service.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Docker — Docker Get Started](https://docs.docker.com/get-started/); [University of Helsinki — Full Stack Open Part 12: Containers](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 133 — Retrieve, review, and plan after Week 19

- **Learn:** Without notes, explain the five concepts from **Containers and local orchestration**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A Docker Compose environment for web, Node API, MongoDB, PostgreSQL lab, and future Python service. **Evidence:** Week 19 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Docker — Docker Get Started](https://docs.docker.com/get-started/); [University of Helsinki — Full Stack Open Part 12: Containers](https://courses.mooc.fi/org/uh-cs/courses/full-stack-open-containers); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

### Week 20 — Architecture, reliability, and security review

**Milestone:** A documented system architecture with service boundaries, threat model, observability plan, and failure-mode tests.

**Skills:** `architecture`, `reliability`, `observability`, `security`, `system-design`


#### Day 134 — Map components and data flow

- **Learn:** Learn context/container/component diagrams, synchronous versus asynchronous calls, trust boundaries, and ownership.
- **Do:** Create Mermaid architecture and sequence diagrams for completion and AI-coach requests.
- **Principle:** Architecture is a set of boundaries and dependencies chosen to satisfy quality attributes.
- **Retrieve:** Which boundary owns validation for each incoming datum?
- **Recovery:** Open the first resource, write three bullets explaining “Map components and data flow,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 135 — Design for failure

- **Learn:** Study timeouts, retries with backoff, idempotency, circuit breaking intuition, graceful degradation, and fallback providers.
- **Do:** Add timeout and bounded retry behavior to one external dependency; test duplicate and timeout scenarios.
- **Principle:** Distributed calls can fail independently and ambiguously, so recovery must be explicit.
- **Retrieve:** When can retrying make the incident worse?
- **Recovery:** Open the first resource, write three bullets explaining “Design for failure,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 136 — Introduce observability

- **Learn:** Learn structured logs, correlation IDs, metrics, traces, service-level indicators, and avoiding sensitive telemetry.
- **Do:** Instrument request count, errors, latency, and correlation IDs; document an initial dashboard/alert plan.
- **Principle:** Observability lets internal behavior be inferred from emitted evidence.
- **Retrieve:** Which signal distinguishes a slow dependency from a slow handler?
- **Recovery:** Open the first resource, write three bullets explaining “Introduce observability,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/); [Langfuse — LLM Observability Documentation](https://langfuse.com/docs)

#### Day 137 — Threat-model the whole system

- **Learn:** Use assets, actors, entry points, trust boundaries, abuse cases, mitigations, and residual risk.
- **Do:** Create a lightweight threat model covering auth, user notes, uploads, AI prompts, external APIs, and secrets.
- **Principle:** Security engineering prioritizes realistic abuse paths rather than applying controls blindly.
- **Retrieve:** What high-value asset crosses the most trust boundaries?
- **Recovery:** Open the first resource, write three bullets explaining “Threat-model the whole system,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 138 — Run a quality and maintainability audit

- **Learn:** Review duplication, coupling, cohesion, dead code, naming, dependency health, accessibility, and test gaps.
- **Do:** Produce a scored audit, fix the three highest-value findings, and record before/after evidence.
- **Principle:** Technical debt is the future cost imposed by today’s design decisions.
- **Retrieve:** Which change reduced future change cost rather than merely formatting code?
- **Recovery:** Open the first resource, write three bullets explaining “Run a quality and maintainability audit,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/); [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/)

#### Day 139 — Integrate Week 20: Architecture, reliability, and security review

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A documented system architecture with service boundaries, threat model, observability plan, and failure-mode tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A documented system architecture with service boundaries, threat model, observability plan, and failure-mode tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A documented system architecture with service boundaries, threat model, observability plan, and failure-mode tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 140 — Retrieve, review, and plan after Week 20

- **Learn:** Without notes, explain the five concepts from **Architecture, reliability, and security review**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A documented system architecture with service boundaries, threat model, observability plan, and failure-mode tests. **Evidence:** Week 20 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

### Week 21 — Python language transfer

**Milestone:** A tested Python package that imports learning data and exposes reusable analysis functions.

**Skills:** `python`, `language-transfer`, `testing`, `data-structures`


#### Day 141 — Translate familiar concepts into Python

- **Learn:** Learn Python execution, indentation, names, primitive values, f-strings, type hints, virtual environments, and package layout.
- **Do:** Create `ai-service` with a virtual environment, `pyproject.toml`, typed hello module, and reproducible install instructions.
- **Principle:** Programming concepts transfer across languages, while runtimes and idioms differ.
- **Retrieve:** Which behaviors are checked only at runtime despite type hints?
- **Recovery:** Open the first resource, write three bullets explaining “Translate familiar concepts into Python,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/)

#### Day 142 — Use Python control flow and functions

- **Learn:** Study conditionals, loops, functions, default arguments, keyword arguments, return values, and docstrings.
- **Do:** Port XP and streak helpers to Python and compare API design with TypeScript.
- **Principle:** A language’s idioms influence readability even when the algorithm is identical.
- **Retrieve:** Why can a mutable default argument create shared state?
- **Recovery:** Open the first resource, write three bullets explaining “Use Python control flow and functions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Kaggle Learn — Python](https://www.kaggle.com/learn/python)

#### Day 143 — Work with Python collections

- **Learn:** Learn lists, tuples, dictionaries, sets, comprehensions, unpacking, and choosing structures by semantics.
- **Do:** Load curriculum records and calculate unique skills, completion counts, and duplicate day numbers.
- **Principle:** Data structures encode ordering, uniqueness, lookup cost, and mutability.
- **Retrieve:** When is a set the most accurate representation?
- **Recovery:** Open the first resource, write three bullets explaining “Work with Python collections,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Python](https://www.kaggle.com/learn/python); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/)

#### Day 144 — Handle files, JSON, and exceptions

- **Learn:** Study context managers, text encoding, paths, JSON, exception specificity, custom errors, and cleanup.
- **Do:** Build a command-line validator that reads curriculum JSON and reports actionable schema problems.
- **Principle:** Exceptions are control flow for exceptional boundaries and should preserve diagnostic context.
- **Retrieve:** Why should broad `except Exception` be rare at lower layers?
- **Recovery:** Open the first resource, write three bullets explaining “Handle files, JSON, and exceptions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/)

#### Day 145 — Test Python behavior

- **Learn:** Learn pytest discovery, fixtures, parameterization, temporary files, and arranging deterministic tests.
- **Do:** Add parameterized tests for curriculum validation and corrupted-file handling.
- **Principle:** Tests let a second implementation preserve the same domain contract.
- **Retrieve:** Which edge cases belong in a parameterized test table?
- **Recovery:** Open the first resource, write three bullets explaining “Test Python behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [pytest — pytest Get Started](https://docs.pytest.org/en/stable/getting-started.html)

#### Day 146 — Integrate Week 21: Python language transfer

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A tested Python package that imports learning data and exposes reusable analysis functions.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A tested Python package that imports learning data and exposes reusable analysis functions. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A tested Python package that imports learning data and exposes reusable analysis functions.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [Kaggle Learn — Python](https://www.kaggle.com/learn/python)

#### Day 147 — Retrieve, review, and plan after Week 21

- **Learn:** Without notes, explain the five concepts from **Python language transfer**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A tested Python package that imports learning data and exposes reusable analysis functions. **Evidence:** Week 21 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [Kaggle Learn — Python](https://www.kaggle.com/learn/python)

## Month 6 — Python, Data, APIs, and Machine Learning


### Week 22 — Python object design and engineering habits

**Milestone:** A maintainable Python domain package with dataclasses, protocols, logging, and a CLI.

**Skills:** `python`, `software-design`, `cli`, `logging`


#### Day 148 — Model domains with classes and dataclasses

- **Learn:** Learn objects, instance/class attributes, dataclasses, immutability, composition, and avoiding JavaScript-style class overuse.
- **Do:** Create dataclasses for learning events and summaries; add invariants in factory functions.
- **Principle:** Objects combine state and behavior when that boundary improves cohesion.
- **Retrieve:** When is a plain dictionary preferable to a class?
- **Recovery:** Open the first resource, write three bullets explaining “Model domains with classes and dataclasses,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/)

#### Day 149 — Define abstractions with protocols

- **Learn:** Study duck typing, abstract base classes, Protocol, dependency inversion, and injectable services.
- **Do:** Define `CoachProvider` and `ProgressRepository` protocols with mock implementations.
- **Principle:** Depend on behavior contracts rather than concrete infrastructure.
- **Retrieve:** What benefit does structural typing provide in tests?
- **Recovery:** Open the first resource, write three bullets explaining “Define abstractions with protocols,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

#### Day 150 — Use modules, packages, and imports cleanly

- **Learn:** Learn package boundaries, absolute imports, `__init__`, public APIs, circular imports, and configuration modules.
- **Do:** Refactor the Python service into domain, application, infrastructure, and API packages.
- **Principle:** Dependency direction matters more than folder labels.
- **Retrieve:** Which layer should import FastAPI?
- **Recovery:** Open the first resource, write three bullets explaining “Use modules, packages, and imports cleanly,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 151 — Add logging and configuration

- **Learn:** Study logging levels, structured fields, environment settings, secret handling, and correlation IDs.
- **Do:** Add typed settings and JSON-friendly logs without recording reflection content or keys.
- **Principle:** Diagnostics must be useful while respecting data minimization.
- **Retrieve:** Which context identifies one request across services?
- **Recovery:** Open the first resource, write three bullets explaining “Add logging and configuration,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/)

#### Day 152 — Build a useful CLI

- **Learn:** Learn command arguments, exit codes, standard output/error, help text, and script entry points.
- **Do:** Create `python -m app validate-curriculum` and `summarize-progress` commands with tests.
- **Principle:** Well-behaved tools compose through stable inputs, outputs, and exit statuses.
- **Retrieve:** Which failures should return a non-zero exit code?
- **Recovery:** Open the first resource, write three bullets explaining “Build a useful CLI,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Command-line Environment](https://missing.csail.mit.edu/2026/command-line-environment/); [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/)

#### Day 153 — Integrate Week 22: Python object design and engineering habits

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A maintainable Python domain package with dataclasses, protocols, logging, and a CLI.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A maintainable Python domain package with dataclasses, protocols, logging, and a CLI. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A maintainable Python domain package with dataclasses, protocols, logging, and a CLI.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

#### Day 154 — Retrieve, review, and plan after Week 22

- **Learn:** Without notes, explain the five concepts from **Python object design and engineering habits**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A maintainable Python domain package with dataclasses, protocols, logging, and a CLI. **Evidence:** Week 22 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Harvard CS50 — CS50P: Introduction to Programming with Python](https://cs50.harvard.edu/python/); [Python — The Python Tutorial](https://docs.python.org/3/tutorial/); [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

### Week 23 — Pandas and data-quality analysis

**Milestone:** A notebook and reusable module that profile real learning data and surface quality issues.

**Skills:** `pandas`, `data-analysis`, `data-quality`, `visualization`


#### Day 155 — Think in tables with DataFrames

- **Learn:** Learn Series/DataFrame, indexes, dtypes, vectorized operations, and why row-by-row loops are often wrong.
- **Do:** Load anonymized progress data into a DataFrame and produce a schema/profile report.
- **Principle:** Columnar operations express transformations over entire variables and enable efficient execution.
- **Retrieve:** What information does a dtype reveal about possible operations?
- **Recovery:** Open the first resource, write three bullets explaining “Think in tables with DataFrames,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas); [freeCodeCamp — Python Certification](https://www.freecodecamp.org/learn/python-v9)

#### Day 156 — Select, filter, and transform

- **Learn:** Study `loc`/`iloc`, boolean masks, assignment, `apply` tradeoffs, and method chaining.
- **Do:** Create views for fallback days, low-confidence days, and overdue reflections without mutating raw data.
- **Principle:** A transformation pipeline should preserve a clear lineage from raw to derived data.
- **Retrieve:** Why can chained assignment be dangerous?
- **Recovery:** Open the first resource, write three bullets explaining “Select, filter, and transform,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas)

#### Day 157 — Group and aggregate behavior

- **Learn:** Learn grouping, aggregation, pivots, rolling windows, and multi-index caution.
- **Do:** Calculate weekly completion, average confidence, skill practice frequency, and seven-day momentum.
- **Principle:** Aggregation changes granularity; every metric needs a declared grouping key and denominator.
- **Retrieve:** At what grain does each output row represent data?
- **Recovery:** Open the first resource, write three bullets explaining “Group and aggregate behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas)

#### Day 158 — Handle missing and messy data

- **Learn:** Study missingness, duplicates, invalid categories, outliers, parsing dates/time zones, and data contracts.
- **Do:** Write a cleaning report and explicit rules for missing mood, duplicate completions, and invalid dates.
- **Principle:** Data quality problems are domain problems, not merely null-handling problems.
- **Retrieve:** When would filling a missing value create a misleading fact?
- **Recovery:** Open the first resource, write three bullets explaining “Handle missing and messy data,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 159 — Communicate findings responsibly

- **Learn:** Learn basic plots, honest scales, annotations, uncertainty, correlation versus causation, and privacy.
- **Do:** Produce a compact progress report with two charts and three cautious findings; move reusable logic out of the notebook.
- **Principle:** Analysis should separate observation, interpretation, and decision.
- **Retrieve:** Which conclusion is unsupported by the available data?
- **Recovery:** Open the first resource, write three bullets explaining “Communicate findings responsibly,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas); [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/)

#### Day 160 — Integrate Week 23: Pandas and data-quality analysis

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A notebook and reusable module that profile real learning data and surface quality issues.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A notebook and reusable module that profile real learning data and surface quality issues. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A notebook and reusable module that profile real learning data and surface quality issues.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas); [freeCodeCamp — Python Certification](https://www.freecodecamp.org/learn/python-v9); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 161 — Retrieve, review, and plan after Week 23

- **Learn:** Without notes, explain the five concepts from **Pandas and data-quality analysis**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A notebook and reusable module that profile real learning data and surface quality issues. **Evidence:** Week 23 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Kaggle Learn — Pandas](https://www.kaggle.com/learn/pandas); [freeCodeCamp — Python Certification](https://www.freecodecamp.org/learn/python-v9); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

### Week 24 — FastAPI and service boundaries

**Milestone:** A containerized FastAPI AI/data service with typed endpoints, tests, and Node-to-Python communication.

**Skills:** `fastapi`, `python-api`, `microservices`, `pydantic`, `docker`


#### Day 162 — Create typed API endpoints with FastAPI

- **Learn:** Learn path operations, request/response models, automatic documentation, dependency injection, and sync versus async handlers.
- **Do:** Implement `/health`, `/analyze/progress`, and generated OpenAPI docs using Pydantic models.
- **Principle:** A schema-first boundary makes contracts inspectable by both humans and tools.
- **Retrieve:** When does an `async` endpoint actually improve concurrency?
- **Recovery:** Open the first resource, write three bullets explaining “Create typed API endpoints with FastAPI,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/)

#### Day 163 — Validate and serialize with Pydantic

- **Learn:** Study field constraints, validators, nested models, aliases, strictness, and stable error responses.
- **Do:** Model progress analysis input/output and test malformed, extra, and boundary values.
- **Principle:** Validation converts untrusted wire data into trusted domain values.
- **Retrieve:** What should remain a domain invariant after parsing?
- **Recovery:** Open the first resource, write three bullets explaining “Validate and serialize with Pydantic,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/); [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

#### Day 164 — Organize routers, dependencies, and errors

- **Learn:** Learn routers, dependency injection, exception handlers, application factories, and separating HTTP from business logic.
- **Do:** Refactor into router/service/domain layers and add one injected mock repository.
- **Principle:** Framework code should adapt requests to use cases, not contain core business rules.
- **Retrieve:** Can the analysis service run without an HTTP request?
- **Recovery:** Open the first resource, write three bullets explaining “Organize routers, dependencies, and errors,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 165 — Connect Node to Python reliably

- **Learn:** Study service-to-service HTTP, timeouts, correlation IDs, internal authentication options, and graceful fallback.
- **Do:** Create a Node client for the Python analysis service with timeout, typed response validation, and fallback summary.
- **Principle:** Every network boundary requires independent validation and failure handling.
- **Retrieve:** Which service owns the public API contract?
- **Recovery:** Open the first resource, write three bullets explaining “Connect Node to Python reliably,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 166 — Test and containerize the Python service

- **Learn:** Learn FastAPI test client, pytest fixtures, dependency overrides, health checks, and Docker runtime.
- **Do:** Add API tests, containerize the service, and include it in Compose with readiness checks.
- **Principle:** Deployable services need identical contracts across local, test, and production environments.
- **Retrieve:** Which test proves the Node client handles Python downtime?
- **Recovery:** Open the first resource, write three bullets explaining “Test and containerize the Python service,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [Docker — Docker Get Started](https://docs.docker.com/get-started/)

#### Day 167 — Integrate Week 24: FastAPI and service boundaries

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A containerized FastAPI AI/data service with typed endpoints, tests, and Node-to-Python communication.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A containerized FastAPI AI/data service with typed endpoints, tests, and Node-to-Python communication. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A containerized FastAPI AI/data service with typed endpoints, tests, and Node-to-Python communication.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 168 — Retrieve, review, and plan after Week 24

- **Learn:** Without notes, explain the five concepts from **FastAPI and service boundaries**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A containerized FastAPI AI/data service with typed endpoints, tests, and Node-to-Python communication. **Evidence:** Week 24 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

### Week 25 — Machine-learning workflow and regression

**Milestone:** A reproducible baseline model predicting a continuous learning outcome with honest evaluation.

**Skills:** `machine-learning`, `regression`, `evaluation`, `reproducibility`


#### Day 169 — Frame an ML problem before choosing a model

- **Learn:** Learn examples/features/labels, supervised learning, leakage, baseline, train/validation/test, and whether ML is warranted.
- **Do:** Write a problem card for predicting next-week completed minutes, including user benefit, risks, and a non-ML baseline.
- **Principle:** A model optimizes a measurable proxy, not the full human goal.
- **Retrieve:** Which feature would leak information from the future?
- **Recovery:** Open the first resource, write three bullets explaining “Frame an ML problem before choosing a model,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 170 — Prepare features and split data

- **Learn:** Study numeric/categorical features, scaling intuition, missing values, chronological versus random splits, and preprocessing fit.
- **Do:** Build a leakage-safe training table and chronological split from synthetic/anonymized progress data.
- **Principle:** Evaluation must simulate how the model will encounter future data.
- **Retrieve:** Why might random splitting overstate performance for time-ordered behavior?
- **Recovery:** Open the first resource, write three bullets explaining “Prepare features and split data,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 171 — Train a regression baseline

- **Learn:** Learn linear regression intuition, loss, gradients conceptually, coefficients, and comparison to a mean baseline.
- **Do:** Train a simple regressor and record MAE against the baseline.
- **Principle:** A complex model is useful only if it beats a simple, relevant benchmark.
- **Retrieve:** What does MAE mean in the original units?
- **Recovery:** Open the first resource, write three bullets explaining “Train a regression baseline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 172 — Diagnose underfitting and overfitting

- **Learn:** Study training versus validation error, capacity, regularization, learning curves, and feature quality.
- **Do:** Compare a shallow tree and a more complex model; explain the generalization gap.
- **Principle:** Generalization—not memorizing training examples—is the objective.
- **Retrieve:** What pattern suggests overfitting?
- **Recovery:** Open the first resource, write three bullets explaining “Diagnose underfitting and overfitting,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 173 — Package a reproducible experiment

- **Learn:** Learn seeds, versioned data, saved metrics, model cards, limitations, and separation of notebook exploration from code.
- **Do:** Create a reproducible training script, metrics JSON, model card, and tests for feature construction.
- **Principle:** An experiment is credible only when inputs, code, and measurements are traceable.
- **Retrieve:** Which artifacts are required to reproduce this result?
- **Recovery:** Open the first resource, write three bullets explaining “Package a reproducible experiment,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 174 — Integrate Week 25: Machine-learning workflow and regression

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A reproducible baseline model predicting a continuous learning outcome with honest evaluation.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A reproducible baseline model predicting a continuous learning outcome with honest evaluation. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A reproducible baseline model predicting a continuous learning outcome with honest evaluation.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 175 — Retrieve, review, and plan after Week 25

- **Learn:** Without notes, explain the five concepts from **Machine-learning workflow and regression**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A reproducible baseline model predicting a continuous learning outcome with honest evaluation. **Evidence:** Week 25 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

### Week 26 — Classification, responsible ML, and app integration

**Milestone:** A calibrated risk-assist model exposed through FastAPI with safeguards and a clearly non-deterministic UX.

**Skills:** `classification`, `responsible-ai`, `ml-serving`, `metrics`


#### Day 176 — Frame classification and choose metrics

- **Learn:** Learn classes, imbalance, confusion matrix, precision, recall, F1, thresholds, and cost-sensitive decisions.
- **Do:** Define a low-engagement support signal and choose metrics based on false-positive/false-negative consequences.
- **Principle:** A metric encodes which errors matter; accuracy can hide harmful failure modes.
- **Retrieve:** Which error is more costly in this supportive app, and why?
- **Recovery:** Open the first resource, write three bullets explaining “Frame classification and choose metrics,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 177 — Train and inspect a classifier

- **Learn:** Study logistic regression or tree classifiers, probabilities, decision thresholds, and feature importance caveats.
- **Do:** Train a baseline classifier on synthetic data and inspect confusion matrix at two thresholds.
- **Principle:** Predicted probability and final action are separate design decisions.
- **Retrieve:** What changes when the threshold moves while model scores stay fixed?
- **Recovery:** Open the first resource, write three bullets explaining “Train and inspect a classifier,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning)

#### Day 178 — Check calibration and subgroup behavior

- **Learn:** Learn calibration intuition, slices, small-sample uncertainty, proxy variables, and fairness limitations.
- **Do:** Plot reliability bins and compare performance across non-sensitive synthetic slices; document uncertainty.
- **Principle:** Aggregate performance can conceal systematic subgroup failures.
- **Retrieve:** Why is a small subgroup metric unstable?
- **Recovery:** Open the first resource, write three bullets explaining “Check calibration and subgroup behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 179 — Design human-centered safeguards

- **Learn:** Study assistive versus punitive use, consent, explanation, data minimization, opt-out, and avoiding mental-health inference.
- **Do:** Write model-use policy: no automatic penalties, no diagnosis, explain uncertainty, user controls data and recommendations.
- **Principle:** Responsible ML includes deciding what not to automate.
- **Retrieve:** What action remains under the user’s control?
- **Recovery:** Open the first resource, write three bullets explaining “Design human-centered safeguards,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 180 — Integrate inference as optional guidance

- **Learn:** Learn model loading, version metadata, latency, fallback, feature validation, and monitoring prediction distributions.
- **Do:** Expose a versioned FastAPI endpoint and show a gentle optional suggestion, never a definitive label; add contract tests.
- **Principle:** A model is one fallible component inside a larger socio-technical system.
- **Retrieve:** How does the UI communicate that the output is uncertain?
- **Recovery:** Open the first resource, write three bullets explaining “Integrate inference as optional guidance,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 181 — Integrate Week 26: Classification, responsible ML, and app integration

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A calibrated risk-assist model exposed through FastAPI with safeguards and a clearly non-deterministic UX.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A calibrated risk-assist model exposed through FastAPI with safeguards and a clearly non-deterministic UX. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A calibrated risk-assist model exposed through FastAPI with safeguards and a clearly non-deterministic UX.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 182 — Retrieve, review, and plan after Week 26

- **Learn:** Without notes, explain the five concepts from **Classification, responsible ML, and app integration**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A calibrated risk-assist model exposed through FastAPI with safeguards and a clearly non-deterministic UX. **Evidence:** Week 26 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Kaggle Learn — Intro to Machine Learning](https://www.kaggle.com/learn/intro-to-machine-learning); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

## Month 7 — Deep Learning and LLM Foundations


### Week 27 — Neural-network intuition and tensors

**Milestone:** A small PyTorch notebook that trains, evaluates, and explains a neural network without hiding the data flow.

**Skills:** `deep-learning`, `pytorch`, `tensors`, `optimization`


#### Day 183 — Represent computation with tensors

- **Learn:** Learn scalars, vectors, matrices, tensors, shapes, dtypes, broadcasting, and CPU/GPU as execution devices.
- **Do:** Create tensor examples for a batch of learning records and annotate every shape transformation.
- **Principle:** Shape is part of the contract: many ML bugs are invalid assumptions about dimensions.
- **Retrieve:** What does the first dimension usually represent in a training batch?
- **Recovery:** Open the first resource, write three bullets explaining “Represent computation with tensors,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 184 — Understand a neuron and forward pass

- **Learn:** Study weighted sums, bias, activation functions, layers, parameters, and a forward computation.
- **Do:** Implement a tiny neuron in NumPy/Python, then reproduce it with PyTorch.
- **Principle:** A neural network is a parameterized composition of differentiable transformations.
- **Retrieve:** What role does a nonlinear activation play?
- **Recovery:** Open the first resource, write three bullets explaining “Understand a neuron and forward pass,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html)

#### Day 185 — Learn loss and gradient descent

- **Learn:** Build intuition for objective functions, derivatives, gradients, learning rate, batches, and optimization steps.
- **Do:** Manually calculate one simple loss update, then inspect gradients with autograd.
- **Principle:** Training searches parameter space using feedback from an objective.
- **Retrieve:** What can happen when the learning rate is too large?
- **Recovery:** Open the first resource, write three bullets explaining “Learn loss and gradient descent,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html)

#### Day 186 — Build a training loop

- **Learn:** Study train/eval modes, forward, loss, backward, optimizer step, zeroing gradients, and epoch metrics.
- **Do:** Train a small network on a toy classification dataset with deterministic seeds.
- **Principle:** A training loop is a repeated state-update system whose measurements must remain separate from training.
- **Retrieve:** Why must gradients be cleared between optimizer steps?
- **Recovery:** Open the first resource, write three bullets explaining “Build a training loop,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

#### Day 187 — Evaluate and document the model

- **Learn:** Review validation, overfitting, confusion matrix, reproducibility, and model limitations.
- **Do:** Plot train/validation loss, test the model, and write an explanation understandable to a web developer.
- **Principle:** Model performance is an empirical claim that requires held-out evidence.
- **Retrieve:** Which curve pattern suggests memorization rather than generalization?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate and document the model,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

#### Day 188 — Integrate Week 27: Neural-network intuition and tensors

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A small PyTorch notebook that trains, evaluates, and explains a neural network without hiding the data flow.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A small PyTorch notebook that trains, evaluates, and explains a neural network without hiding the data flow. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A small PyTorch notebook that trains, evaluates, and explains a neural network without hiding the data flow.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

#### Day 189 — Retrieve, review, and plan after Week 27

- **Learn:** Without notes, explain the five concepts from **Neural-network intuition and tensors**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A small PyTorch notebook that trains, evaluates, and explains a neural network without hiding the data flow. **Evidence:** Week 27 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

### Week 28 — Embeddings, similarity, and semantic representations

**Milestone:** A local semantic-search prototype over learning notes with measured retrieval examples.

**Skills:** `embeddings`, `vector-search`, `information-retrieval`, `evaluation`


#### Day 190 — Understand representation learning

- **Learn:** Learn one-hot versus dense vectors, latent features, embedding spaces, and why distance can encode semantic relatedness.
- **Do:** Create a conceptual diagram comparing keyword matching with vector similarity.
- **Principle:** Representations determine which relationships become easy for an algorithm to detect.
- **Retrieve:** What information is lost in a bag-of-words representation?
- **Recovery:** Open the first resource, write three bullets explaining “Understand representation learning,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings)

#### Day 191 — Calculate similarity

- **Learn:** Study dot product, cosine similarity, normalization, nearest neighbors, and distance-metric assumptions.
- **Do:** Implement cosine similarity and test it on hand-created vectors before using an embedding model.
- **Principle:** Similarity is a mathematical policy; the chosen metric affects retrieved neighbors.
- **Retrieve:** Why does normalization matter for cosine similarity?
- **Recovery:** Open the first resource, write three bullets explaining “Calculate similarity,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 192 — Generate embeddings through an adapter

- **Learn:** Learn batch requests, dimensions, deterministic test doubles, provider abstraction, rate limits, and privacy.
- **Do:** Implement `EmbeddingProvider` with mock and optional external provider; embed sanitized sample notes server-side.
- **Principle:** Provider adapters keep application contracts stable while infrastructure changes.
- **Retrieve:** Which user content should not leave the local environment by default?
- **Recovery:** Open the first resource, write three bullets explaining “Generate embeddings through an adapter,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 193 — Index and retrieve nearest notes

- **Learn:** Study brute-force search, vector indexes conceptually, metadata filters, top-k, and query/document mismatch.
- **Do:** Create an in-memory vector index and retrieve notes for three questions with source IDs.
- **Principle:** Retrieval is a ranking problem, not a guarantee of truth.
- **Retrieve:** How can metadata filtering improve both relevance and privacy?
- **Recovery:** Open the first resource, write three bullets explaining “Index and retrieve nearest notes,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [pgvector — pgvector Documentation](https://github.com/pgvector/pgvector)

#### Day 194 — Evaluate semantic retrieval

- **Learn:** Learn relevance judgments, hit rate/recall@k, hard negatives, query sets, and qualitative error analysis.
- **Do:** Create ten query-to-relevant-note judgments, compute recall@k, and classify retrieval failures.
- **Principle:** You cannot improve retrieval reliably without a fixed test set.
- **Retrieve:** Which failure came from the embedding representation versus the query?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate semantic retrieval,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 195 — Integrate Week 28: Embeddings, similarity, and semantic representations

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A local semantic-search prototype over learning notes with measured retrieval examples.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A local semantic-search prototype over learning notes with measured retrieval examples. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A local semantic-search prototype over learning notes with measured retrieval examples.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 196 — Retrieve, review, and plan after Week 28

- **Learn:** Without notes, explain the five concepts from **Embeddings, similarity, and semantic representations**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A local semantic-search prototype over learning notes with measured retrieval examples. **Evidence:** Week 28 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

### Week 29 — Transformers, tokenization, and context

**Milestone:** An illustrated notebook explaining tokenization, attention, context windows, and autoregressive generation.

**Skills:** `transformers`, `tokenization`, `attention`, `llm-fundamentals`


#### Day 197 — Tokenize text

- **Learn:** Learn tokens, subwords, vocabulary, unknown/rare words, special tokens, and token-count effects on cost/context.
- **Do:** Tokenize the same learning note with examples and compare words, characters, and tokens.
- **Principle:** Models process discrete token IDs, not words or meanings directly.
- **Retrieve:** Why can two similarly long sentences have different token counts?
- **Recovery:** Open the first resource, write three bullets explaining “Tokenize text,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 198 — Build attention intuition

- **Learn:** Study queries, keys, values, attention scores, weighted combinations, positional information, and multi-head purpose.
- **Do:** Create a small annotated attention diagram and compute a toy weighted combination.
- **Principle:** Attention dynamically routes information based on relationships within the current sequence.
- **Retrieve:** What determines which earlier tokens influence the current representation?
- **Recovery:** Open the first resource, write three bullets explaining “Build attention intuition,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

#### Day 199 — Understand transformer blocks

- **Learn:** Learn embeddings, self-attention, feed-forward layers, residual connections, normalization, and stacked depth.
- **Do:** Trace tensor shape through a simplified transformer block in a notebook.
- **Principle:** Deep models compose repeated blocks while residual paths help information and gradients flow.
- **Retrieve:** Why are residual connections useful?
- **Recovery:** Open the first resource, write three bullets explaining “Understand transformer blocks,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [PyTorch — Learn the Basics](https://pytorch.org/tutorials/beginner/basics/intro.html)

#### Day 200 — Understand next-token generation

- **Learn:** Study logits, probabilities, softmax, temperature, top-p, deterministic versus sampled output, and stop conditions.
- **Do:** Simulate sampling from a tiny probability distribution at multiple temperatures.
- **Principle:** LLM text generation repeatedly samples or selects the next token conditioned on context.
- **Retrieve:** How does temperature change the distribution without adding knowledge?
- **Recovery:** Open the first resource, write three bullets explaining “Understand next-token generation,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text)

#### Day 201 — Reason about context limits and failure modes

- **Learn:** Learn finite context, recency/position effects, hallucination, prompt injection distinction, and external knowledge via retrieval/tools.
- **Do:** Write a limitations note and design an experiment showing how missing context changes an answer.
- **Principle:** Fluent generation is not the same as grounded knowledge or verified reasoning.
- **Retrieve:** Which failure should be solved by retrieval rather than a longer instruction?
- **Recovery:** Open the first resource, write three bullets explaining “Reason about context limits and failure modes,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 202 — Integrate Week 29: Transformers, tokenization, and context

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: An illustrated notebook explaining tokenization, attention, context windows, and autoregressive generation.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: An illustrated notebook explaining tokenization, attention, context windows, and autoregressive generation. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: An illustrated notebook explaining tokenization, attention, context windows, and autoregressive generation.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

#### Day 203 — Retrieve, review, and plan after Week 29

- **Learn:** Without notes, explain the five concepts from **Transformers, tokenization, and context**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: An illustrated notebook explaining tokenization, attention, context windows, and autoregressive generation. **Evidence:** Week 29 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [fast.ai — Practical Deep Learning for Coders](https://course.fast.ai/)

### Week 30 — First production-shaped LLM feature

**Milestone:** An optional provider-backed AI coach vertical slice with a deterministic mock, privacy controls, and a baseline eval set.

**Skills:** `llm-api`, `prompting`, `ai-product-design`, `evals`


#### Day 204 — Design the AI coach as a bounded use case

- **Learn:** Define user job, inputs, outputs, prohibited behavior, success criteria, fallback, and data-retention choice before calling a model.
- **Do:** Write the AI Coach contract and ten representative examples, including ambiguity and sensitive-content boundaries.
- **Principle:** AI product design begins with an observable task and failure policy, not a generic chat box.
- **Retrieve:** What user decision must the coach never make autonomously?
- **Recovery:** Open the first resource, write three bullets explaining “Design the AI coach as a bounded use case,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 205 — Call a model through a server-side adapter

- **Learn:** Learn Responses-style request/response flow, secrets, model configuration, timeouts, metadata, and mock providers.
- **Do:** Implement `CoachProvider` in Node or Python with deterministic mock default and optional backend-only OpenAI provider.
- **Principle:** External AI is an unreliable dependency behind an application-owned interface.
- **Retrieve:** Which configuration belongs in environment variables rather than client code?
- **Recovery:** Open the first resource, write three bullets explaining “Call a model through a server-side adapter,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 206 — Write clear prompts and version them

- **Learn:** Study instruction hierarchy, context delimiters, examples, output requirements, prompt versions, and minimizing unnecessary context.
- **Do:** Create prompt v1 for daily encouragement and store version, latency, token estimate, and result metadata.
- **Principle:** Prompts are production artifacts that require version control and regression tests.
- **Retrieve:** What change would require rerunning the eval set?
- **Recovery:** Open the first resource, write three bullets explaining “Write clear prompts and version them,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 207 — Handle failures and preserve trust

- **Learn:** Learn refusal, malformed response, timeout, provider error, rate limit, empty output, and safe fallback copy.
- **Do:** Implement bounded timeout, one safe retry where appropriate, mock fallback, and UI that labels generated guidance.
- **Principle:** Graceful degradation is part of correctness when probabilistic services fail.
- **Retrieve:** Which failures should not be retried automatically?
- **Recovery:** Open the first resource, write three bullets explaining “Handle failures and preserve trust,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 208 — Measure a baseline before polishing

- **Learn:** Learn golden cases, rubric scoring, deterministic assertions, human review, and recording model/config versions.
- **Do:** Run the ten-case coach set, score usefulness/safety/format, and save the baseline report.
- **Principle:** Without a baseline, prompt iteration becomes subjective and regressions remain invisible.
- **Retrieve:** What evidence would justify changing the prompt?
- **Recovery:** Open the first resource, write three bullets explaining “Measure a baseline before polishing,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 209 — Integrate Week 30: First production-shaped LLM feature

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: An optional provider-backed AI coach vertical slice with a deterministic mock, privacy controls, and a baseline eval set.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: An optional provider-backed AI coach vertical slice with a deterministic mock, privacy controls, and a baseline eval set. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: An optional provider-backed AI coach vertical slice with a deterministic mock, privacy controls, and a baseline eval set.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 210 — Retrieve, review, and plan after Week 30

- **Learn:** Without notes, explain the five concepts from **First production-shaped LLM feature**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: An optional provider-backed AI coach vertical slice with a deterministic mock, privacy controls, and a baseline eval set. **Evidence:** Week 30 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

## Month 8 — Reliable LLM Application Engineering


### Week 31 — Structured outputs and schema-safe AI

**Milestone:** A schema-validated coach response pipeline with repair/fallback behavior and contract tests.

**Skills:** `structured-outputs`, `schema-validation`, `ai-reliability`, `security`


#### Day 211 — Choose structured output contracts

- **Learn:** Learn when to use free text versus JSON schema, required fields, enums, nullable values, versioning, and UI-driven output design.
- **Do:** Define a compact `CoachResponseV1` schema with encouragement, explanation, next step, evidence request, and risk flag.
- **Principle:** Structured output narrows the model’s degrees of freedom at a machine boundary.
- **Retrieve:** Which field should be an enum rather than arbitrary text?
- **Recovery:** Open the first resource, write three bullets explaining “Choose structured output contracts,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/)

#### Day 212 — Generate and validate structured responses

- **Learn:** Study schema-constrained generation, server-side parsing, refusal handling, and distinguishing transport/model/schema errors.
- **Do:** Request structured output, validate it, and map every failure type to a typed application error.
- **Principle:** Never pass probabilistic output directly into trusted application state.
- **Retrieve:** What happens when the model refuses instead of returning the schema?
- **Recovery:** Open the first resource, write three bullets explaining “Generate and validate structured responses,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text)

#### Day 213 — Design repair and fallback policies

- **Learn:** Learn bounded repair attempts, deterministic fallback, preserving original evidence, and avoiding infinite self-correction loops.
- **Do:** Implement one schema-repair attempt followed by the mock provider; log outcome without sensitive content.
- **Principle:** Recovery loops require explicit budgets and terminal conditions.
- **Retrieve:** What is the maximum number of repair attempts, and why?
- **Recovery:** Open the first resource, write three bullets explaining “Design repair and fallback policies,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 214 — Render AI data safely

- **Learn:** Study escaping, Markdown risk, links, generated code, untrusted model output, and accessible explanation labels.
- **Do:** Render only allowlisted fields as plain text; add “generated guidance” disclosure and copy feedback controls.
- **Principle:** Model output is untrusted input even when it came from your own prompt.
- **Retrieve:** Which output could become an XSS vector if rendered unsafely?
- **Recovery:** Open the first resource, write three bullets explaining “Render AI data safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 215 — Contract-test the AI boundary

- **Learn:** Learn fixtures for valid/refusal/malformed/timeout responses, provider mocks, schema compatibility, and snapshot restraint.
- **Do:** Add tests for each output state and prove the UI never celebrates a failed or unvalidated result.
- **Principle:** Boundary tests verify both happy-path structure and controlled failure semantics.
- **Retrieve:** Which test guards against false success feedback?
- **Recovery:** Open the first resource, write three bullets explaining “Contract-test the AI boundary,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [University of Helsinki — Full Stack Open Part 5: Testing React Apps](https://fullstackopen.com/en/part5)

#### Day 216 — Integrate Week 31: Structured outputs and schema-safe AI

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A schema-validated coach response pipeline with repair/fallback behavior and contract tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A schema-validated coach response pipeline with repair/fallback behavior and contract tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A schema-validated coach response pipeline with repair/fallback behavior and contract tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/); [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text)

#### Day 217 — Retrieve, review, and plan after Week 31

- **Learn:** Without notes, explain the five concepts from **Structured outputs and schema-safe AI**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A schema-validated coach response pipeline with repair/fallback behavior and contract tests. **Evidence:** Week 31 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Pydantic — Pydantic Documentation](https://docs.pydantic.dev/latest/); [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text)

### Week 32 — Tool and function calling

**Milestone:** A tool-calling study assistant that can read app-owned progress data through allowlisted, auditable functions.

**Skills:** `tool-calling`, `authorization`, `agent-loops`, `evals`


#### Day 218 — Understand the tool-calling protocol

- **Learn:** Learn tool definitions, JSON arguments, call IDs, tool outputs, the model/tool loop, and why the application executes tools.
- **Do:** Diagram request → tool proposal → validation → execution → tool output → final response.
- **Principle:** The model proposes actions; trusted application code authorizes and performs them.
- **Retrieve:** Who decides whether a proposed tool call is allowed to run?
- **Recovery:** Open the first resource, write three bullets explaining “Understand the tool-calling protocol,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools)

#### Day 219 — Design narrow tools

- **Learn:** Study least privilege, single-purpose functions, clear descriptions, small schemas, deterministic returns, and no hidden side effects.
- **Do:** Define read-only tools for `get_current_day`, `get_recent_progress`, and `search_notes` with strict schemas.
- **Principle:** Tool capability is an authority boundary; narrower tools reduce blast radius.
- **Retrieve:** What sensitive data is unnecessary for this tool’s purpose?
- **Recovery:** Open the first resource, write three bullets explaining “Design narrow tools,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 220 — Validate and authorize tool calls

- **Learn:** Learn argument validation, user ownership, server-side identity, injection-resistant tool results, and error normalization.
- **Do:** Implement a tool dispatcher that validates args and scopes every query to the authenticated user.
- **Principle:** Model-generated arguments never bypass normal authorization.
- **Retrieve:** Why is a valid schema not sufficient authorization?
- **Recovery:** Open the first resource, write three bullets explaining “Validate and authorize tool calls,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling); [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)

#### Day 221 — Run a bounded tool loop

- **Learn:** Study maximum turns, duplicate calls, parallel versus serial tools, timeouts, failure messages, and deterministic test traces.
- **Do:** Implement a maximum-three-call loop with duplicate detection and explicit terminal reasons.
- **Principle:** Agentic loops need resource budgets and progress checks to terminate safely.
- **Retrieve:** What condition stops a loop that keeps requesting the same tool?
- **Recovery:** Open the first resource, write three bullets explaining “Run a bounded tool loop,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 222 — Evaluate tool selection and grounding

- **Learn:** Learn tool-choice accuracy, argument correctness, answer grounding, unavailable-data behavior, and trace-based review.
- **Do:** Create fifteen cases and score whether the correct tool ran, arguments were valid, and claims came from tool results.
- **Principle:** Tool use quality is measurable at intermediate steps, not only final prose.
- **Retrieve:** Which metric isolates tool-selection failures?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate tool selection and grounding,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling)

#### Day 223 — Integrate Week 32: Tool and function calling

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A tool-calling study assistant that can read app-owned progress data through allowlisted, auditable functions.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A tool-calling study assistant that can read app-owned progress data through allowlisted, auditable functions. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A tool-calling study assistant that can read app-owned progress data through allowlisted, auditable functions.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 224 — Retrieve, review, and plan after Week 32

- **Learn:** Without notes, explain the five concepts from **Tool and function calling**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A tool-calling study assistant that can read app-owned progress data through allowlisted, auditable functions. **Evidence:** Week 32 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Function Calling](https://developers.openai.com/api/docs/guides/function-calling); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

### Week 33 — Eval-first AI Coach

**Milestone:** A versioned local evaluation harness in CI with fixed datasets, rubrics, and regression thresholds.

**Skills:** `llm-evaluation`, `quality-gates`, `datasets`, `ci-cd`


#### Day 225 — Define an evaluation taxonomy

- **Learn:** Learn functional correctness, format, groundedness, relevance, tone, safety, latency, and cost as distinct dimensions.
- **Do:** Create an eval plan mapping each AI Coach requirement to one deterministic or rubric-based test.
- **Principle:** A single aggregate score can conceal critical failure categories.
- **Retrieve:** Which dimension is a release blocker even if average usefulness is high?
- **Recovery:** Open the first resource, write three bullets explaining “Define an evaluation taxonomy,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 226 — Build a representative golden dataset

- **Learn:** Study normal cases, edge cases, adversarial cases, distribution coverage, expected properties, and dataset versioning.
- **Do:** Expand to at least thirty anonymized inputs with tags and expected constraints rather than one ideal answer.
- **Principle:** Evaluation data is a product specification expressed as examples.
- **Retrieve:** Which important user situation is absent from the dataset?
- **Recovery:** Open the first resource, write three bullets explaining “Build a representative golden dataset,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 227 — Add deterministic assertions

- **Learn:** Learn schema, regex, contains/not-contains, JSONPath, latency budgets, mock assertions, and tool-trace checks.
- **Do:** Implement fast local checks that run without a paid model and fail on unsafe phrases or invalid structure.
- **Principle:** Use deterministic tests wherever the requirement can be specified exactly.
- **Retrieve:** Which requirement can be checked without another model?
- **Recovery:** Open the first resource, write three bullets explaining “Add deterministic assertions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

#### Day 228 — Use rubric or judge scoring cautiously

- **Learn:** Study rubrics, calibration, pairwise comparison, judge bias, reproducibility, human spot checks, and disagreement handling.
- **Do:** Create a specific rubric for actionable explanation, calibrate it on ten manually scored examples, and record disagreement.
- **Principle:** An LLM judge is another measurement instrument, not ground truth.
- **Retrieve:** How will you know whether the judge agrees with your rubric?
- **Recovery:** Open the first resource, write three bullets explaining “Use rubric or judge scoring cautiously,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 229 — Gate changes in CI

- **Learn:** Learn baseline comparison, allowed variance, critical-case floors, flaky model outputs, caching, and release reports.
- **Do:** Add local eval scripts and CI gates for mock/deterministic tests; make paid-provider evals an explicit opt-in command.
- **Principle:** A quality gate must be reproducible, affordable, and resistant to random noise.
- **Retrieve:** Which evals run on every commit versus manually before release?
- **Recovery:** Open the first resource, write three bullets explaining “Gate changes in CI,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — Understanding GitHub Actions](https://docs.github.com/en/actions/about-github-actions/understanding-github-actions); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 230 — Integrate Week 33: Eval-first AI Coach

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A versioned local evaluation harness in CI with fixed datasets, rubrics, and regression thresholds.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A versioned local evaluation harness in CI with fixed datasets, rubrics, and regression thresholds. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A versioned local evaluation harness in CI with fixed datasets, rubrics, and regression thresholds.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 231 — Retrieve, review, and plan after Week 33

- **Learn:** Without notes, explain the five concepts from **Eval-first AI Coach**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A versioned local evaluation harness in CI with fixed datasets, rubrics, and regression thresholds. **Evidence:** Week 33 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

### Week 34 — Production embedding and indexing pipeline

**Milestone:** A privacy-aware, incremental note-indexing service with source metadata, deletion, and retrieval tests.

**Skills:** `embedding-pipelines`, `vector-databases`, `privacy`, `data-engineering`


#### Day 232 — Design the ingestion contract

- **Learn:** Learn source IDs, content hashes, chunk boundaries, metadata, ownership, versioning, and consent.
- **Do:** Define an index record for reflection notes with user ID, source ID, date, skill tags, content hash, and embedding version.
- **Principle:** Retrieval correctness begins with traceable, well-governed source data.
- **Retrieve:** Which metadata is required to delete one user’s vectors completely?
- **Recovery:** Open the first resource, write three bullets explaining “Design the ingestion contract,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 233 — Chunk content by meaning and use

- **Learn:** Study fixed/token/semantic chunking, overlap, title context, atomic facts, and chunk-size tradeoffs.
- **Do:** Implement two chunking strategies and compare retrieval on long weekly reflections.
- **Principle:** Chunking controls the unit the retriever can rank and the generator can cite.
- **Retrieve:** What information is broken when this chunk boundary is chosen?
- **Recovery:** Open the first resource, write three bullets explaining “Chunk content by meaning and use,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1)

#### Day 234 — Index incrementally and idempotently

- **Learn:** Learn hashing, upsert, embedding versions, batching, retry, rate limits, and avoiding duplicate vectors.
- **Do:** Create a job that embeds only changed chunks and records failures for safe rerun.
- **Principle:** Data pipelines need checkpoints and stable identities to recover without duplication.
- **Retrieve:** How does the job know a chunk is unchanged?
- **Recovery:** Open the first resource, write three bullets explaining “Index incrementally and idempotently,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 235 — Abstract vector storage

- **Learn:** Compare in-memory, Mongo vector search, pgvector, and external stores; learn filtering, tenancy, and portability.
- **Do:** Define a `VectorStore` interface with an in-memory implementation and optional pgvector/provider adapter.
- **Principle:** Application semantics should not be locked to one vendor’s storage API.
- **Retrieve:** Which operations form the minimum useful vector-store contract?
- **Recovery:** Open the first resource, write three bullets explaining “Abstract vector storage,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [pgvector — pgvector Documentation](https://github.com/pgvector/pgvector); [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval)

#### Day 236 — Implement deletion and privacy tests

- **Learn:** Study right-to-delete flows, orphaned vectors, backup implications, audit logs, and data minimization.
- **Do:** Add delete-by-user/source plus tests that no search result survives account/note deletion.
- **Principle:** Derived data must follow the lifecycle and access policy of its source.
- **Retrieve:** What derived artifacts remain after the source note is deleted?
- **Recovery:** Open the first resource, write three bullets explaining “Implement deletion and privacy tests,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 237 — Integrate Week 34: Production embedding and indexing pipeline

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A privacy-aware, incremental note-indexing service with source metadata, deletion, and retrieval tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A privacy-aware, incremental note-indexing service with source metadata, deletion, and retrieval tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A privacy-aware, incremental note-indexing service with source metadata, deletion, and retrieval tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag)

#### Day 238 — Retrieve, review, and plan after Week 34

- **Learn:** Without notes, explain the five concepts from **Production embedding and indexing pipeline**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A privacy-aware, incremental note-indexing service with source metadata, deletion, and retrieval tests. **Evidence:** Week 34 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag)

## Month 9 — RAG, Evaluation, and AI Operations


### Week 35 — Baseline RAG with citations

**Milestone:** A complete question-answering flow over personal learning notes with source citations and explicit uncertainty.

**Skills:** `rag`, `citations`, `grounded-generation`, `evaluation`


#### Day 239 — Map the RAG pipeline

- **Learn:** Learn ingestion, chunking, embedding, indexing, query transformation, retrieval, context assembly, generation, and citation.
- **Do:** Create a sequence diagram and define observable inputs/outputs for every RAG stage.
- **Principle:** RAG is a pipeline of independently testable information-retrieval and generation components.
- **Retrieve:** At which stage can an irrelevant source first enter the answer path?
- **Recovery:** Open the first resource, write three bullets explaining “Map the RAG pipeline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag)

#### Day 240 — Retrieve and assemble context

- **Learn:** Study top-k, score thresholds, metadata filters, diversity, ordering, token budgets, and source labels.
- **Do:** Build a retriever that returns bounded, user-scoped chunks with stable citation IDs.
- **Principle:** Context selection is resource allocation under relevance and token constraints.
- **Retrieve:** Why can simply increasing top-k reduce answer quality?
- **Recovery:** Open the first resource, write three bullets explaining “Retrieve and assemble context,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings)

#### Day 241 — Generate grounded answers

- **Learn:** Learn answer-from-context instructions, abstention, citation formatting, quote limits, and distinguishing source facts from inference.
- **Do:** Implement note Q&A that cites chunk IDs and says when the notes do not support an answer.
- **Principle:** A grounded answer must make its evidence trail inspectable.
- **Retrieve:** What wording makes unsupported inference visible to the user?
- **Recovery:** Open the first resource, write three bullets explaining “Generate grounded answers,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag)

#### Day 242 — Verify citations programmatically

- **Learn:** Study citation completeness, claim-source alignment, missing IDs, inaccessible sources, and post-generation validation.
- **Do:** Reject unknown citation IDs and add a citation panel that opens the exact source note.
- **Principle:** References are useful only when they resolve to the evidence actually supplied.
- **Retrieve:** Which test catches a fabricated source ID?
- **Recovery:** Open the first resource, write three bullets explaining “Verify citations programmatically,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 243 — Evaluate end-to-end RAG

- **Learn:** Learn answer relevance, context relevance, faithfulness, completeness, abstention accuracy, and latency.
- **Do:** Create twenty Q&A cases with source judgments and run a baseline report.
- **Principle:** RAG quality is multi-dimensional; generation can fail even when retrieval succeeds and vice versa.
- **Retrieve:** Which metric separates retrieval failure from hallucination?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate end-to-end RAG,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag)

#### Day 244 — Integrate Week 35: Baseline RAG with citations

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A complete question-answering flow over personal learning notes with source citations and explicit uncertainty.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A complete question-answering flow over personal learning notes with source citations and explicit uncertainty. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A complete question-answering flow over personal learning notes with source citations and explicit uncertainty.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings)

#### Day 245 — Retrieve, review, and plan after Week 35

- **Learn:** Without notes, explain the five concepts from **Baseline RAG with citations**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A complete question-answering flow over personal learning notes with source citations and explicit uncertainty. **Evidence:** Week 35 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings)

### Week 36 — Retrieval tuning and hybrid search

**Milestone:** A tuned retrieval stack using keyword plus vector signals, filters, and reranking experiments.

**Skills:** `hybrid-search`, `reranking`, `retrieval-tuning`, `experimentation`


#### Day 246 — Build a keyword baseline

- **Learn:** Learn inverted-index intuition, term frequency, exact identifiers, stop words, and cases semantic search misses.
- **Do:** Implement simple keyword/BM25-like retrieval or a database text-search baseline over notes.
- **Principle:** A strong simple baseline reveals whether embeddings add value.
- **Retrieve:** Which query depends on an exact token rather than semantic similarity?
- **Recovery:** Open the first resource, write three bullets explaining “Build a keyword baseline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)

#### Day 247 — Combine lexical and semantic results

- **Learn:** Study hybrid retrieval, score normalization, reciprocal-rank fusion, duplicate handling, and candidate pools.
- **Do:** Merge keyword and vector rankings and compare recall@k against each individual retriever.
- **Principle:** Independent signals can improve robustness when combined with a principled ranking rule.
- **Retrieve:** Why cannot raw lexical and vector scores always be added directly?
- **Recovery:** Open the first resource, write three bullets explaining “Combine lexical and semantic results,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [pgvector — pgvector Documentation](https://github.com/pgvector/pgvector)

#### Day 248 — Transform and expand queries

- **Learn:** Learn spelling normalization, acronym expansion, decomposition, hypothetical documents, and the risk of query drift.
- **Do:** Add a bounded query-rewrite step and preserve the original query for audit and fallback.
- **Principle:** Query transformation can improve recall but may alter user intent.
- **Retrieve:** How will you detect that a rewrite changed the question’s meaning?
- **Recovery:** Open the first resource, write three bullets explaining “Transform and expand queries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 249 — Rerank candidates

- **Learn:** Study bi-encoder versus cross-encoder intuition, reranking cost, candidate count, and score thresholds.
- **Do:** Add a deterministic/mock reranker interface and optional model implementation; measure quality and latency.
- **Principle:** Use expensive reasoning only after a cheaper stage narrows the search space.
- **Retrieve:** Where should reranking occur in the pipeline?
- **Recovery:** Open the first resource, write three bullets explaining “Rerank candidates,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 250 — Tune with an error ledger

- **Learn:** Learn failure categories, controlled experiments, one-variable changes, confidence intervals intuition, and regression suites.
- **Do:** Classify every failed query, change one retrieval parameter, rerun, and record whether each category improved.
- **Principle:** Optimization is an evidence loop, not a pile of simultaneous changes.
- **Retrieve:** Which change caused a regression, and what evidence isolates it?
- **Recovery:** Open the first resource, write three bullets explaining “Tune with an error ledger,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 251 — Integrate Week 36: Retrieval tuning and hybrid search

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A tuned retrieval stack using keyword plus vector signals, filters, and reranking experiments.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A tuned retrieval stack using keyword plus vector signals, filters, and reranking experiments. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A tuned retrieval stack using keyword plus vector signals, filters, and reranking experiments.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html); [pgvector — pgvector Documentation](https://github.com/pgvector/pgvector)

#### Day 252 — Retrieve, review, and plan after Week 36

- **Learn:** Without notes, explain the five concepts from **Retrieval tuning and hybrid search**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A tuned retrieval stack using keyword plus vector signals, filters, and reranking experiments. **Evidence:** Week 36 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [PostgreSQL — PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html); [pgvector — pgvector Documentation](https://github.com/pgvector/pgvector)

### Week 37 — Advanced RAG and knowledge quality

**Milestone:** A RAG system with hierarchical context, freshness controls, conflict handling, and clear answer provenance.

**Skills:** `advanced-rag`, `knowledge-management`, `provenance`, `freshness`


#### Day 253 — Add document and chunk hierarchy

- **Learn:** Learn parent-child retrieval, summaries versus source chunks, section metadata, and preserving local/global context.
- **Do:** Index weekly-summary parents and daily-note children; retrieve a broad parent then focused children.
- **Principle:** Hierarchical retrieval balances overview with evidence granularity.
- **Retrieve:** Which information belongs in a parent summary but not every child?
- **Recovery:** Open the first resource, write three bullets explaining “Add document and chunk hierarchy,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval)

#### Day 254 — Control freshness and versions

- **Learn:** Study timestamps, superseded content, re-indexing, source-of-truth precedence, and time-aware filters.
- **Do:** Mark revised notes and ensure current answers prefer active versions while exposing historical context when requested.
- **Principle:** Knowledge systems need explicit temporal semantics, not merely similarity.
- **Retrieve:** How does the system distinguish outdated from contradictory information?
- **Recovery:** Open the first resource, write three bullets explaining “Control freshness and versions,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 255 — Handle conflicting sources

- **Learn:** Learn conflict detection, source ranking, uncertainty, presenting multiple claims, and asking for clarification.
- **Do:** Create conflicting-note test cases and require the answer to cite both rather than silently choose.
- **Principle:** Synthesis must preserve disagreement when evidence does not justify resolution.
- **Retrieve:** What evidence would permit one source to outrank another?
- **Recovery:** Open the first resource, write three bullets explaining “Handle conflicting sources,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 256 — Use context compression carefully

- **Learn:** Study extractive selection, summarization, lost qualifiers, compression evaluation, and source traceability.
- **Do:** Implement a mock/extractive compressor and compare token reduction with faithfulness on ten cases.
- **Principle:** Compression trades context budget for information-loss risk.
- **Retrieve:** Which qualifier disappeared during compression?
- **Recovery:** Open the first resource, write three bullets explaining “Use context compression carefully,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 257 — Create a knowledge-quality dashboard

- **Learn:** Learn corpus coverage, stale sources, orphan chunks, retrieval frequency, unanswered questions, and feedback loops.
- **Do:** Add admin metrics for indexing health and an error-review queue linked to source records.
- **Principle:** Operational quality includes the health of the knowledge base, not only model output.
- **Retrieve:** Which metric reveals missing knowledge rather than poor generation?
- **Recovery:** Open the first resource, write three bullets explaining “Create a knowledge-quality dashboard,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 258 — Integrate Week 37: Advanced RAG and knowledge quality

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A RAG system with hierarchical context, freshness controls, conflict handling, and clear answer provenance.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A RAG system with hierarchical context, freshness controls, conflict handling, and clear answer provenance. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A RAG system with hierarchical context, freshness controls, conflict handling, and clear answer provenance.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 259 — Retrieve, review, and plan after Week 37

- **Learn:** Without notes, explain the five concepts from **Advanced RAG and knowledge quality**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A RAG system with hierarchical context, freshness controls, conflict handling, and clear answer provenance. **Evidence:** Week 37 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — Advanced RAG Cookbook](https://huggingface.co/learn/cookbook/advanced_rag); [OpenAI Developers — Retrieval and Vector Stores](https://developers.openai.com/api/docs/guides/retrieval); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

### Week 38 — LLM observability, cost, and latency

**Milestone:** An AI operations dashboard that traces requests, retrieval, tool calls, quality feedback, cost estimates, and latency budgets.

**Skills:** `llm-observability`, `latency`, `cost-optimization`, `operations`


#### Day 260 — Define AI traces and events

- **Learn:** Learn request/response metadata, spans, prompt versions, retrieval events, tool calls, model config, and privacy-safe payload handling.
- **Do:** Create an application-owned trace schema and instrument one coach and one RAG request end to end.
- **Principle:** A trace reconstructs causal work across components without requiring raw sensitive content.
- **Retrieve:** Which identifiers connect retrieval, generation, and user feedback?
- **Recovery:** Open the first resource, write three bullets explaining “Define AI traces and events,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 261 — Measure latency by stage

- **Learn:** Study p50/p95, cold starts, network/model/retrieval time, streaming, time-to-first-token, and user-perceived latency.
- **Do:** Record stage timings and add a waterfall view with a stated response-time budget.
- **Principle:** Percentiles reveal tail behavior hidden by averages.
- **Retrieve:** Which stage dominates p95 rather than only the median?
- **Recovery:** Open the first resource, write three bullets explaining “Measure latency by stage,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 262 — Estimate and control cost

- **Learn:** Learn tokens, input/output asymmetry, embeddings, retries, caching, model routing, quotas, and per-feature budgets.
- **Do:** Add per-request estimated cost, weekly budget, warning thresholds, and a mock/free mode that remains fully usable.
- **Principle:** Cost is a system metric shaped by architecture and product behavior.
- **Retrieve:** Which repeated context can be removed or cached?
- **Recovery:** Open the first resource, write three bullets explaining “Estimate and control cost,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings)

#### Day 263 — Collect useful feedback

- **Learn:** Study thumbs/contextual feedback, reason codes, implicit signals, sampling bias, and linking feedback to traces/eval cases.
- **Do:** Add specific feedback choices such as inaccurate, ungrounded, unclear, or not actionable.
- **Principle:** Feedback is most useful when it identifies a failure class and preserves the producing configuration.
- **Retrieve:** What decision can this feedback data support?
- **Recovery:** Open the first resource, write three bullets explaining “Collect useful feedback,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 264 — Build operational alerts and review

- **Learn:** Learn error-rate/latency/cost/quality thresholds, burn-rate intuition, alert fatigue, dashboards, and weekly review.
- **Do:** Create an AI health page and a runbook for provider outage, quality regression, and cost spike.
- **Principle:** Monitoring becomes actionable only when a signal maps to an owner and response.
- **Retrieve:** What exact action follows each alert?
- **Recovery:** Open the first resource, write three bullets explaining “Build operational alerts and review,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 265 — Integrate Week 38: LLM observability, cost, and latency

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: An AI operations dashboard that traces requests, retrieval, tool calls, quality feedback, cost estimates, and latency budgets.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: An AI operations dashboard that traces requests, retrieval, tool calls, quality feedback, cost estimates, and latency budgets. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: An AI operations dashboard that traces requests, retrieval, tool calls, quality feedback, cost estimates, and latency budgets.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 266 — Retrieve, review, and plan after Week 38

- **Learn:** Without notes, explain the five concepts from **LLM observability, cost, and latency**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: An AI operations dashboard that traces requests, retrieval, tool calls, quality feedback, cost estimates, and latency budgets. **Evidence:** Week 38 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

### Week 39 — LLM security and red teaming

**Milestone:** A threat-modeled, red-teamed RAG/coach system with tested mitigations for high-risk failure modes.

**Skills:** `ai-security`, `red-teaming`, `prompt-injection`, `privacy`


#### Day 267 — Threat-model LLM-specific boundaries

- **Learn:** Learn prompt injection, sensitive disclosure, improper output handling, excessive agency, vector weaknesses, and supply-chain risk.
- **Do:** Update the threat model with assets, attackers, entry points, and prioritized LLM abuse cases.
- **Principle:** LLM security extends normal application security; it does not replace it.
- **Retrieve:** Which threat is caused by granting the model too much authority?
- **Recovery:** Open the first resource, write three bullets explaining “Threat-model LLM-specific boundaries,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/); [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/)

#### Day 268 — Test direct and indirect prompt injection

- **Learn:** Study malicious user instructions, poisoned retrieved text, instruction/data separation, canaries, and realistic limits of prompt defenses.
- **Do:** Add adversarial notes and tests proving retrieved instructions cannot invoke tools or expose hidden configuration.
- **Principle:** Content retrieved as data must not silently become trusted control instructions.
- **Retrieve:** Where is the trust boundary between system instructions and retrieved content enforced?
- **Recovery:** Open the first resource, write three bullets explaining “Test direct and indirect prompt injection,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 269 — Prevent sensitive-data leakage

- **Learn:** Learn data minimization, tenant isolation, metadata filters, logs/traces, secrets, PII handling, and deletion propagation.
- **Do:** Create cross-user retrieval tests, redact logs, and verify all vector queries enforce user scope.
- **Principle:** Authorization must follow data through every derived representation.
- **Retrieve:** Which derived store could leak data even when Mongo authorization is correct?
- **Recovery:** Open the first resource, write three bullets explaining “Prevent sensitive-data leakage,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 270 — Constrain tool authority and output

- **Learn:** Study allowlists, read-only defaults, confirmation for side effects, sandboxing, output encoding, and SSRF/file risks.
- **Do:** Add permission metadata to tools and require explicit user confirmation for any future write action.
- **Principle:** Capability security limits what a compromised model can do.
- **Retrieve:** What is the maximum damage one tool call can cause?
- **Recovery:** Open the first resource, write three bullets explaining “Constrain tool authority and output,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/)

#### Day 271 — Run and triage a red-team suite

- **Learn:** Learn attack categories, expected defenses, severity, false positives, remediation evidence, and regression gating.
- **Do:** Run local Promptfoo-style red tests, fix critical findings, and save a security report with accepted residual risks.
- **Principle:** Security tests become durable when every fixed vulnerability remains a regression case.
- **Retrieve:** Which unresolved risk is accepted, by whom, and with what mitigation?
- **Recovery:** Open the first resource, write three bullets explaining “Run and triage a red-team suite,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 272 — Integrate Week 39: LLM security and red teaming

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A threat-modeled, red-teamed RAG/coach system with tested mitigations for high-risk failure modes.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A threat-modeled, red-teamed RAG/coach system with tested mitigations for high-risk failure modes. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A threat-modeled, red-teamed RAG/coach system with tested mitigations for high-risk failure modes.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/); [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 273 — Retrieve, review, and plan after Week 39

- **Learn:** Without notes, explain the five concepts from **LLM security and red teaming**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A threat-modeled, red-teamed RAG/coach system with tested mitigations for high-risk failure modes. **Evidence:** Week 39 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/); [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

## Month 10 — Model Optimization and Open Models


### Week 40 — Systematic AI optimization

**Milestone:** A measured optimization report improving quality, latency, and cost without weakening safety or grounding.

**Skills:** `optimization`, `experimentation`, `model-routing`, `caching`


#### Day 274 — Establish a multi-objective baseline

- **Learn:** Learn quality/cost/latency tradeoffs, Pareto fronts, critical-case floors, and holding the dataset constant.
- **Do:** Record current coach and RAG quality, p50/p95 latency, token use, estimated cost, and safety failures.
- **Principle:** Optimization requires explicit objectives and constraints; no single metric defines “better.”
- **Retrieve:** Which metric is a hard constraint rather than an optimization target?
- **Recovery:** Open the first resource, write three bullets explaining “Establish a multi-objective baseline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 275 — Improve prompts with controlled experiments

- **Learn:** Study instruction clarity, examples, context ordering, output brevity, prompt bloat, and versioned A/B comparisons.
- **Do:** Test two focused prompt changes independently and keep only changes that pass the full regression set.
- **Principle:** Change one variable at a time so evidence can be attributed.
- **Retrieve:** What alternative explanation could account for the observed improvement?
- **Recovery:** Open the first resource, write three bullets explaining “Improve prompts with controlled experiments,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering); [OpenAI Developers — Prompt Engineering: Tests and Evaluation Suites](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 276 — Route tasks to appropriate models/providers

- **Learn:** Learn capability tiers, deterministic tasks, reasoning versus fast models, fallback chains, provider abstraction, and routing policy.
- **Do:** Implement configurable routing for simple encouragement, structured extraction, and complex review using mock profiles by default.
- **Principle:** Use the least expensive capability that reliably meets the task’s quality floor.
- **Retrieve:** Which task does not require a high-capability generative model?
- **Recovery:** Open the first resource, write three bullets explaining “Route tasks to appropriate models/providers,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 277 — Cache and batch safely

- **Learn:** Study exact/semantic caching, cache keys, invalidation, privacy, embedding batches, duplicate work, and stale outputs.
- **Do:** Add content-hash embedding cache and safe response caching only for non-personal deterministic cases.
- **Principle:** Caching trades freshness and storage for lower latency and cost.
- **Retrieve:** Which user-specific response must never be shared through a global cache?
- **Recovery:** Open the first resource, write three bullets explaining “Cache and batch safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Vector Embeddings](https://developers.openai.com/api/docs/guides/embeddings); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 278 — Review the whole pipeline

- **Learn:** Learn bottleneck shifting, regression analysis, rollback, feature flags, and reporting confidence honestly.
- **Do:** Produce before/after results and ship the winning configuration behind a feature flag with rollback instructions.
- **Principle:** Local improvements can harm the end-to-end system; optimize the user-visible pipeline.
- **Retrieve:** What got worse after the optimization, even if the headline metric improved?
- **Recovery:** Open the first resource, write three bullets explaining “Review the whole pipeline,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [Langfuse — LLM Observability Documentation](https://langfuse.com/docs)

#### Day 279 — Integrate Week 40: Systematic AI optimization

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A measured optimization report improving quality, latency, and cost without weakening safety or grounding.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A measured optimization report improving quality, latency, and cost without weakening safety or grounding. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A measured optimization report improving quality, latency, and cost without weakening safety or grounding.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 280 — Retrieve, review, and plan after Week 40

- **Learn:** Without notes, explain the five concepts from **Systematic AI optimization**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A measured optimization report improving quality, latency, and cost without weakening safety or grounding. **Evidence:** Week 40 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

### Week 41 — Hugging Face model and tokenizer workflows

**Milestone:** A local notebook that loads an open model, inspects tokenization/generation, and documents licensing and hardware limits.

**Skills:** `hugging-face`, `open-models`, `local-inference`, `benchmarking`


#### Day 281 — Navigate model artifacts and model cards

- **Learn:** Learn architecture, weights, configuration, tokenizer files, model cards, licenses, intended use, and revision pinning.
- **Do:** Select a small learning model and create a decision record covering license, size, task, and resource needs.
- **Principle:** Model weights are supply-chain artifacts with provenance, compatibility, and licensing constraints.
- **Retrieve:** Which license condition affects how the portfolio app may distribute the model?
- **Recovery:** Open the first resource, write three bullets explaining “Navigate model artifacts and model cards,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

#### Day 282 — Load models and tokenizers reproducibly

- **Learn:** Study pipelines versus explicit model/tokenizer loading, cache, revisions, device selection, and offline behavior.
- **Do:** Load a small model at a pinned revision and record environment, memory, and startup time.
- **Principle:** Reproducible inference requires pinned model code, weights, tokenizer, and library versions.
- **Retrieve:** Which unpinned artifact could silently change output?
- **Recovery:** Open the first resource, write three bullets explaining “Load models and tokenizers reproducibly,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1)

#### Day 283 — Inspect tokenization and generation controls

- **Learn:** Review chat templates, attention masks, padding, truncation, max new tokens, sampling, and seeds.
- **Do:** Run a matrix of generation settings and explain output differences without declaring one universally best.
- **Principle:** Generation configuration is part of the model behavior contract.
- **Retrieve:** What is the difference between input truncation and output token limits?
- **Recovery:** Open the first resource, write three bullets explaining “Inspect tokenization and generation controls,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 284 — Benchmark local inference

- **Learn:** Learn warmup, throughput, latency, memory, batch size, context length, and apples-to-apples comparisons.
- **Do:** Benchmark a fixed prompt set and save machine specs plus p50/p95 results.
- **Principle:** Benchmarks are meaningful only when workload and environment are controlled.
- **Retrieve:** Which measurement is distorted by cold-start model loading?
- **Recovery:** Open the first resource, write three bullets explaining “Benchmark local inference,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 285 — Wrap the model behind the provider interface

- **Learn:** Study provider normalization, capability metadata, unsupported features, streaming, and deterministic mocks.
- **Do:** Add an optional local provider adapter while keeping the app operational when no model is installed.
- **Principle:** The product owns a stable contract; providers expose varying capabilities behind adapters.
- **Retrieve:** How does the app communicate that a provider lacks structured-output support?
- **Recovery:** Open the first resource, write three bullets explaining “Wrap the model behind the provider interface,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Ollama — Ollama Documentation](https://docs.ollama.com/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

#### Day 286 — Integrate Week 41: Hugging Face model and tokenizer workflows

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A local notebook that loads an open model, inspects tokenization/generation, and documents licensing and hardware limits.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A local notebook that loads an open model, inspects tokenization/generation, and documents licensing and hardware limits. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A local notebook that loads an open model, inspects tokenization/generation, and documents licensing and hardware limits.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1)

#### Day 287 — Retrieve, review, and plan after Week 41

- **Learn:** Without notes, explain the five concepts from **Hugging Face model and tokenizer workflows**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A local notebook that loads an open model, inspects tokenization/generation, and documents licensing and hardware limits. **Evidence:** Week 41 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Hugging Face — Tokenizers](https://huggingface.co/learn/llm-course/chapter6/1)

### Week 42 — Quantization and efficient inference

**Milestone:** A measured local-inference experiment comparing precision/quantization choices and their quality-resource tradeoffs.

**Skills:** `quantization`, `inference-optimization`, `benchmarking`, `model-selection`


#### Day 288 — Understand numerical precision

- **Learn:** Learn FP32/FP16/BF16/INT8/INT4 intuition, dynamic range, memory calculation, and hardware support.
- **Do:** Estimate parameter-memory requirements at several precisions and verify one model’s observed footprint.
- **Principle:** Numeric representation trades precision and range for storage and compute efficiency.
- **Retrieve:** How much raw weight memory does one billion parameters require at 16 bits?
- **Recovery:** Open the first resource, write three bullets explaining “Understand numerical precision,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

#### Day 289 — Understand quantization

- **Learn:** Study post-training quantization, weight-only versus activation quantization, calibration intuition, and quality risk.
- **Do:** Run or document a feasible small quantized model comparison using available hardware.
- **Principle:** Compression changes numerical behavior and must be evaluated on the target task.
- **Retrieve:** Which eval cases are most likely to expose quantization quality loss?
- **Recovery:** Open the first resource, write three bullets explaining “Understand quantization,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Ollama — Ollama Documentation](https://docs.ollama.com/)

#### Day 290 — Measure memory, latency, and throughput

- **Learn:** Learn resident memory, tokens/sec, first-token latency, concurrency, batch tradeoffs, and context impact.
- **Do:** Benchmark full and quantized variants on the same machine and dataset.
- **Principle:** Resource efficiency is multi-dimensional; a faster throughput setting can worsen interactive latency.
- **Retrieve:** Which metric matters most for a single-user interactive coach?
- **Recovery:** Open the first resource, write three bullets explaining “Measure memory, latency, and throughput,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 291 — Test output quality after optimization

- **Learn:** Study task-specific regression, deterministic versus stochastic comparison, judge limitations, and safety floors.
- **Do:** Run the same structured, RAG, and safety cases across variants and record failures.
- **Principle:** An efficiency gain is invalid if it violates a critical quality constraint.
- **Retrieve:** Which critical case fails only on the compressed model?
- **Recovery:** Open the first resource, write three bullets explaining “Test output quality after optimization,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 292 — Write a deployment recommendation

- **Learn:** Combine hardware, quality, latency, license, operational complexity, and fallback into a reasoned decision.
- **Do:** Publish a concise model-selection ADR with evidence and a no-local-model fallback.
- **Principle:** Engineering recommendations expose constraints and rejected alternatives.
- **Retrieve:** Under what changed constraint would the rejected option become preferable?
- **Recovery:** Open the first resource, write three bullets explaining “Write a deployment recommendation,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 293 — Integrate Week 42: Quantization and efficient inference

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A measured local-inference experiment comparing precision/quantization choices and their quality-resource tradeoffs.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A measured local-inference experiment comparing precision/quantization choices and their quality-resource tradeoffs. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A measured local-inference experiment comparing precision/quantization choices and their quality-resource tradeoffs.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

#### Day 294 — Retrieve, review, and plan after Week 42

- **Learn:** Without notes, explain the five concepts from **Quantization and efficient inference**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A measured local-inference experiment comparing precision/quantization choices and their quality-resource tradeoffs. **Evidence:** Week 42 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

### Week 43 — Fine-tuning concepts with PEFT and LoRA

**Milestone:** A small optional PEFT/LoRA lab plus a decision framework showing when prompting, RAG, or tuning is appropriate.

**Skills:** `fine-tuning`, `peft`, `lora`, `data-quality`, `model-evaluation`


#### Day 295 — Decide whether tuning is the right lever

- **Learn:** Compare prompting, examples, RAG, tools, workflow code, supervised tuning, and preference optimization by failure type.
- **Do:** Classify ten AI-coach failures and choose the lowest-cost intervention for each.
- **Principle:** Model customization should target a stable behavior gap that data examples can teach.
- **Retrieve:** Which failure is caused by missing current knowledge rather than model behavior?
- **Recovery:** Open the first resource, write three bullets explaining “Decide whether tuning is the right lever,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

#### Day 296 — Prepare training data responsibly

- **Learn:** Learn instruction/input/output records, train/validation splits, leakage, deduplication, consent, sensitive data, and quality review.
- **Do:** Create a tiny synthetic instruction dataset and a data card; do not use private family or production notes.
- **Principle:** Training data becomes model behavior and must have provenance and permission.
- **Retrieve:** What duplicated pattern could make validation misleading?
- **Recovery:** Open the first resource, write three bullets explaining “Prepare training data responsibly,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Fine-tuning a Pretrained Model](https://huggingface.co/learn/llm-course/chapter3/1); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

#### Day 297 — Understand LoRA and PEFT

- **Learn:** Study frozen base weights, low-rank adapters, target modules, rank, trainable parameter count, and adapter portability.
- **Do:** Calculate trainable-parameter reduction conceptually and configure a tiny LoRA experiment.
- **Principle:** Parameter-efficient tuning adapts a small subspace instead of updating the full model.
- **Retrieve:** What remains unchanged during LoRA training?
- **Recovery:** Open the first resource, write three bullets explaining “Understand LoRA and PEFT,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — LoRA and PEFT](https://huggingface.co/learn/llm-course/chapter11/4); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1)

#### Day 298 — Run or simulate a bounded tuning experiment

- **Learn:** Learn training configuration, checkpoints, validation loss, overfitting, compute limits, and reproducible logs.
- **Do:** Run a small feasible lab or create an executable dry-run config with a documented hardware fallback.
- **Principle:** Resource constraints are legitimate design inputs; an experiment can be scoped without pretending it ran.
- **Retrieve:** Which evidence distinguishes a completed run from a planned one?
- **Recovery:** Open the first resource, write three bullets explaining “Run or simulate a bounded tuning experiment,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Hugging Face — Fine-tuning a Pretrained Model](https://huggingface.co/learn/llm-course/chapter3/1)

#### Day 299 — Evaluate and compare the adapter

- **Learn:** Study held-out behavior tests, base-versus-adapter comparison, catastrophic regressions, deployment, and adapter versioning.
- **Do:** Run the task eval set where possible and write a go/no-go decision; keep tuning optional in the product.
- **Principle:** A trained artifact earns deployment only through comparative evaluation.
- **Retrieve:** Did the adapter outperform a prompt/RAG change enough to justify its complexity?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate and compare the adapter,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [Hugging Face — LoRA and PEFT](https://huggingface.co/learn/llm-course/chapter11/4)

#### Day 300 — Integrate Week 43: Fine-tuning concepts with PEFT and LoRA

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A small optional PEFT/LoRA lab plus a decision framework showing when prompting, RAG, or tuning is appropriate.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A small optional PEFT/LoRA lab plus a decision framework showing when prompting, RAG, or tuning is appropriate. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A small optional PEFT/LoRA lab plus a decision framework showing when prompting, RAG, or tuning is appropriate.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Hugging Face — Fine-tuning a Pretrained Model](https://huggingface.co/learn/llm-course/chapter3/1)

#### Day 301 — Retrieve, review, and plan after Week 43

- **Learn:** Without notes, explain the five concepts from **Fine-tuning concepts with PEFT and LoRA**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A small optional PEFT/LoRA lab plus a decision framework showing when prompting, RAG, or tuning is appropriate. **Evidence:** Week 43 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Model Optimization](https://developers.openai.com/api/docs/guides/model-optimization); [Hugging Face — Smol Course: Fine-tuning Language Models](https://huggingface.co/learn/smol-course/unit0/1); [Hugging Face — Fine-tuning a Pretrained Model](https://huggingface.co/learn/llm-course/chapter3/1)

## Month 11 — Agents, Workflows, and Interoperability


### Week 44 — Model serving and resilient provider architecture

**Milestone:** A provider-neutral AI gateway supporting mock, remote, and optional local inference with health, routing, and load tests.

**Skills:** `model-serving`, `provider-abstraction`, `resilience`, `performance`


#### Day 302 — Define a provider capability matrix

- **Learn:** Learn text, JSON schema, tools, embeddings, streaming, context limits, privacy mode, and failure semantics across providers.
- **Do:** Create machine-readable provider capabilities and reject unsupported feature combinations before requests are sent.
- **Principle:** Capability negotiation prevents accidental reliance on features a provider cannot guarantee.
- **Retrieve:** Which capability must be known before selecting a provider for this request?
- **Recovery:** Open the first resource, write three bullets explaining “Define a provider capability matrix,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [Ollama — Ollama Documentation](https://docs.ollama.com/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

#### Day 303 — Serve local models safely

- **Learn:** Study model-server process boundaries, ports, authentication, concurrency, queueing, timeouts, and resource exhaustion.
- **Do:** Connect an optional Ollama/vLLM-compatible endpoint through the AI gateway with strict timeouts and disabled-by-default exposure.
- **Principle:** A model server is privileged infrastructure and should not be directly exposed to untrusted clients.
- **Retrieve:** What prevents an internet user from invoking the local model server directly?
- **Recovery:** Open the first resource, write three bullets explaining “Serve local models safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Ollama — Ollama Documentation](https://docs.ollama.com/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 304 — Add routing, fallback, and circuit state

- **Learn:** Learn health probes, circuit breaker states, provider priority, deterministic fallback, retry budgets, and avoiding retry storms.
- **Do:** Implement health-aware routing from optional provider to mock fallback and test open/half-open/closed behavior.
- **Principle:** A circuit breaker protects a failing dependency and the caller from repeated expensive failure.
- **Retrieve:** What successful event moves a half-open circuit back to closed?
- **Recovery:** Open the first resource, write three bullets explaining “Add routing, fallback, and circuit state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 305 — Support streaming without corrupting state

- **Learn:** Study server-sent events or streams, partial output, cancellation, disconnects, tool-call boundaries, and final validation.
- **Do:** Stream plain-text explanations only; keep structured actions buffered until fully validated.
- **Principle:** Partial data improves responsiveness but cannot be treated as a committed valid record.
- **Retrieve:** Which output must wait for complete schema validation before persistence?
- **Recovery:** Open the first resource, write three bullets explaining “Support streaming without corrupting state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Text Generation with the Responses API](https://developers.openai.com/api/docs/guides/text); [MDN — HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

#### Day 306 — Load-test the gateway

- **Learn:** Learn concurrent users, throughput, saturation, queue time, rate limits, backpressure, and graceful overload.
- **Do:** Run a small local load test, identify the first bottleneck, set concurrency limits, and document capacity assumptions.
- **Principle:** Systems fail differently near saturation; bounded concurrency preserves predictable degradation.
- **Retrieve:** Which metric indicates queueing rather than model execution became the bottleneck?
- **Recovery:** Open the first resource, write three bullets explaining “Load-test the gateway,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

#### Day 307 — Integrate Week 44: Model serving and resilient provider architecture

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A provider-neutral AI gateway supporting mock, remote, and optional local inference with health, routing, and load tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A provider-neutral AI gateway supporting mock, remote, and optional local inference with health, routing, and load tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A provider-neutral AI gateway supporting mock, remote, and optional local inference with health, routing, and load tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [Ollama — Ollama Documentation](https://docs.ollama.com/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

#### Day 308 — Retrieve, review, and plan after Week 44

- **Learn:** Without notes, explain the five concepts from **Model serving and resilient provider architecture**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A provider-neutral AI gateway supporting mock, remote, and optional local inference with health, routing, and load tests. **Evidence:** Week 44 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [Ollama — Ollama Documentation](https://docs.ollama.com/); [vLLM — vLLM Documentation](https://docs.vllm.ai/en/latest/)

### Week 45 — Agent fundamentals and bounded planning

**Milestone:** A read-only study-planning agent with explicit state, narrow tools, budgets, traces, and a deterministic fallback workflow.

**Skills:** `agents`, `planning`, `tool-use`, `state-machines`, `evals`


#### Day 309 — Distinguish workflows from agents

- **Learn:** Learn deterministic orchestration, model-selected actions, autonomy spectrum, suitable use cases, and why a workflow is often enough.
- **Do:** Classify product tasks as direct call, fixed workflow, or agent; justify each classification.
- **Principle:** Use the least autonomous architecture that satisfies the uncertainty of the task.
- **Retrieve:** Which task has a known sequence and therefore does not need an agent?
- **Recovery:** Open the first resource, write three bullets explaining “Distinguish workflows from agents,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools)

#### Day 310 — Model the agent loop explicitly

- **Learn:** Study goal, state, observation, plan/action, tool result, stopping condition, budgets, and final answer.
- **Do:** Implement a typed state reducer for `plan → act → observe → decide → finish/fail` with a maximum step count.
- **Principle:** Agent behavior is a state machine around probabilistic decisions.
- **Retrieve:** Which state transition guarantees termination?
- **Recovery:** Open the first resource, write three bullets explaining “Model the agent loop explicitly,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 311 — Give the agent safe tools

- **Learn:** Review tool schemas, read-only defaults, authorization, deterministic outputs, error handling, and untrusted tool content.
- **Do:** Expose progress, calendar-free roadmap, note search, and time-budget tools; no email/calendar writes or shell access.
- **Principle:** Agency risk grows with the authority and irreversibility of tools.
- **Retrieve:** What is the highest-impact action the current tool set permits?
- **Recovery:** Open the first resource, write three bullets explaining “Give the agent safe tools,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 312 — Create a planning rubric

- **Learn:** Learn goal decomposition, prerequisite ordering, 30-minute capacity, uncertainty, recovery, and human approval.
- **Do:** Have the agent propose a seven-day plan constrained to existing curriculum and require user confirmation before saving.
- **Principle:** A useful plan respects resource constraints and preserves user autonomy.
- **Retrieve:** Which proposed task exceeds the user’s daily time budget?
- **Recovery:** Open the first resource, write three bullets explaining “Create a planning rubric,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 313 — Evaluate traces, not just final plans

- **Learn:** Study loop success, tool correctness, unnecessary steps, recovery, termination, latency, and human usefulness.
- **Do:** Create twenty planning cases and score state transitions, tool calls, budget adherence, and final plan quality.
- **Principle:** Agent evaluation must inspect intermediate actions where failures and costs originate.
- **Retrieve:** Which case produced a good final answer through an unsafe or wasteful trace?
- **Recovery:** Open the first resource, write three bullets explaining “Evaluate traces, not just final plans,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 314 — Integrate Week 45: Agent fundamentals and bounded planning

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A read-only study-planning agent with explicit state, narrow tools, budgets, traces, and a deterministic fallback workflow.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A read-only study-planning agent with explicit state, narrow tools, budgets, traces, and a deterministic fallback workflow. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A read-only study-planning agent with explicit state, narrow tools, budgets, traces, and a deterministic fallback workflow.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 315 — Retrieve, review, and plan after Week 45

- **Learn:** Without notes, explain the five concepts from **Agent fundamentals and bounded planning**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A read-only study-planning agent with explicit state, narrow tools, budgets, traces, and a deterministic fallback workflow. **Evidence:** Week 45 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

### Week 46 — LangGraph-style durable workflows

**Milestone:** A resumable weekly-planning graph with typed state, checkpoints, human review, retries, and visual trace inspection.

**Skills:** `langgraph`, `durable-workflows`, `human-in-the-loop`, `resilience`


#### Day 316 — Represent workflows as graphs

- **Learn:** Learn nodes, edges, conditional routing, shared state, entry/terminal nodes, and cycles with explicit guards.
- **Do:** Draw and implement a graph for gather progress → draft plan → validate → human review → save/revise.
- **Principle:** Graphs make possible transitions and loops explicit and inspectable.
- **Retrieve:** Which edge forms a loop, and what condition limits it?
- **Recovery:** Open the first resource, write three bullets explaining “Represent workflows as graphs,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction)

#### Day 317 — Design typed graph state

- **Learn:** Study immutable updates, append versus replace reducers, error state, provenance, and keeping raw model output separate.
- **Do:** Define graph state containing goal, evidence, draft, validation results, feedback, attempt count, and terminal reason.
- **Principle:** State design determines what can be resumed, audited, and tested.
- **Retrieve:** Which value must be preserved to explain why the plan changed?
- **Recovery:** Open the first resource, write three bullets explaining “Design typed graph state,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

#### Day 318 — Add checkpoints and resumability

- **Learn:** Learn durable execution, checkpoint IDs, idempotent nodes, replay, duplicate side effects, and recovery after process failure.
- **Do:** Persist graph checkpoints and test resuming after interruption before and after human review.
- **Principle:** Resumable workflows require repeat-safe work and explicit side-effect boundaries.
- **Retrieve:** Which node would duplicate work if replayed?
- **Recovery:** Open the first resource, write three bullets explaining “Add checkpoints and resumability,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 319 — Insert human-in-the-loop control

- **Learn:** Study interrupt points, approvals, edits, rejection, timeouts, and displaying evidence with the proposed action.
- **Do:** Pause before saving a new weekly plan; let the user approve, edit, or request a revision.
- **Principle:** Human review is meaningful only when the reviewer has context and real authority to change the outcome.
- **Retrieve:** What evidence is shown so the user can make an informed approval?
- **Recovery:** Open the first resource, write three bullets explaining “Insert human-in-the-loop control,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 320 — Test graph paths and recovery

- **Learn:** Learn path coverage, deterministic node mocks, retryable versus terminal errors, loop limits, and trace snapshots.
- **Do:** Test success, insufficient data, provider timeout, rejected plan, revision, and max-attempt terminal paths.
- **Principle:** Workflow tests should cover transitions and invariants rather than exact generated wording.
- **Retrieve:** Which graph path was previously untested?
- **Recovery:** Open the first resource, write three bullets explaining “Test graph paths and recovery,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 321 — Integrate Week 46: LangGraph-style durable workflows

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A resumable weekly-planning graph with typed state, checkpoints, human review, retries, and visual trace inspection.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A resumable weekly-planning graph with typed state, checkpoints, human review, retries, and visual trace inspection. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A resumable weekly-planning graph with typed state, checkpoints, human review, retries, and visual trace inspection.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

#### Day 322 — Retrieve, review, and plan after Week 46

- **Learn:** Without notes, explain the five concepts from **LangGraph-style durable workflows**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A resumable weekly-planning graph with typed state, checkpoints, human review, retries, and visual trace inspection. **Evidence:** Week 46 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [TypeScript — The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### Week 47 — Model Context Protocol and context engineering

**Milestone:** A minimal read-only MCP integration with explicit trust, provenance, permissions, and interoperability tests.

**Skills:** `mcp`, `context-engineering`, `interoperability`, `supply-chain-security`


#### Day 323 — Understand MCP architecture

- **Learn:** Learn host, client, server, transports, tools, resources, prompts, capability negotiation, and trust boundaries.
- **Do:** Create an architecture diagram showing how CodeLift could expose read-only curriculum resources through MCP.
- **Principle:** A protocol standardizes communication but does not make a remote capability trustworthy.
- **Retrieve:** Which component decides whether to trust and invoke an MCP server?
- **Recovery:** Open the first resource, write three bullets explaining “Understand MCP architecture,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools)

#### Day 324 — Build a minimal read-only MCP server

- **Learn:** Study server initialization, resource listing/reading, tool schemas, errors, and local transport.
- **Do:** Expose `curriculum://day/{n}` resources and a `search_curriculum` read-only tool backed by sanitized seed data.
- **Principle:** Protocol handlers are adapters around domain services and must preserve validation.
- **Retrieve:** Which domain logic should not be duplicated inside the protocol handler?
- **Recovery:** Open the first resource, write three bullets explaining “Build a minimal read-only MCP server,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 325 — Connect an MCP client safely

- **Learn:** Learn discovery, allowlists, user consent, timeouts, schemas, remote-server data policies, and result labeling.
- **Do:** Connect locally, display server identity/capabilities, and require allowlisting before any invocation.
- **Principle:** Dynamic capability discovery increases flexibility and supply-chain attack surface.
- **Retrieve:** What user data could leave the app when a remote server is called?
- **Recovery:** Open the first resource, write three bullets explaining “Connect an MCP client safely,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 326 — Engineer context deliberately

- **Learn:** Study selecting instructions, conversation state, retrieved evidence, tool results, summaries, token budgets, and provenance.
- **Do:** Implement a context builder with prioritized sections, token estimates, source labels, and omission logs.
- **Principle:** Context engineering is choosing the minimum trustworthy information needed for the current decision.
- **Retrieve:** Which context item can be omitted without reducing task quality?
- **Recovery:** Open the first resource, write three bullets explaining “Engineer context deliberately,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [OpenAI Developers — Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

#### Day 327 — Test interoperability and adversarial behavior

- **Learn:** Learn malformed capabilities, unknown schemas, prompt injection in resources, server downtime, and permission revocation.
- **Do:** Add tests for an honest server, malicious resource content, changed schema, timeout, and removed allowlist permission.
- **Principle:** Interoperability requires defensive behavior against both accidental incompatibility and hostile peers.
- **Retrieve:** Which validation still runs after content arrives from an allowlisted server?
- **Recovery:** Open the first resource, write three bullets explaining “Test interoperability and adversarial behavior,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/)

#### Day 328 — Integrate Week 47: Model Context Protocol and context engineering

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A minimal read-only MCP integration with explicit trust, provenance, permissions, and interoperability tests.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A minimal read-only MCP integration with explicit trust, provenance, permissions, and interoperability tests. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A minimal read-only MCP integration with explicit trust, provenance, permissions, and interoperability tests.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 329 — Retrieve, review, and plan after Week 47

- **Learn:** Without notes, explain the five concepts from **Model Context Protocol and context engineering**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A minimal read-only MCP integration with explicit trust, provenance, permissions, and interoperability tests. **Evidence:** Week 47 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — MCP Course](https://huggingface.co/learn/mcp-course/unit0/introduction); [OpenAI Developers — Using Tools](https://developers.openai.com/api/docs/guides/tools); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

## Month 12 — Capstone, Career Evidence, and Launch


### Week 48 — Agent evaluation, safety, and operations

**Milestone:** A production-readiness report for the planner agent with trace evals, red-team tests, budgets, and runbooks.

**Skills:** `agent-evaluation`, `ai-safety`, `operations`, `release-engineering`


#### Day 330 — Define agent success and failure

- **Learn:** Learn task success, plan validity, tool correctness, step efficiency, recovery, human override, safety, and cost.
- **Do:** Create an agent scorecard with hard gates and weighted dimensions tied to product requirements.
- **Principle:** Autonomous behavior needs stronger evaluation because errors can compound across steps.
- **Retrieve:** Which failure blocks release regardless of average score?
- **Recovery:** Open the first resource, write three bullets explaining “Define agent success and failure,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/)

#### Day 331 — Build trace-level evaluators

- **Learn:** Study state invariants, forbidden tools, duplicate actions, budget adherence, evidence use, and terminal reasons.
- **Do:** Implement deterministic evaluators over stored traces and add representative fixtures.
- **Principle:** Intermediate-state assertions catch unsafe paths that final-output scoring misses.
- **Retrieve:** Which invariant must hold at every step?
- **Recovery:** Open the first resource, write three bullets explaining “Build trace-level evaluators,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph)

#### Day 332 — Red-team excessive agency

- **Learn:** Learn goal hijacking, tool abuse, persistence, memory poisoning, prompt leakage, denial of wallet, and unsafe delegation.
- **Do:** Run adversarial planning cases and verify read-only permissions, step caps, token budgets, and human approval.
- **Principle:** Assume model instructions can be manipulated; enforce safety in code and capability boundaries.
- **Retrieve:** Which control remains effective even when the model follows malicious instructions?
- **Recovery:** Open the first resource, write three bullets explaining “Red-team excessive agency,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)

#### Day 333 — Add operational controls

- **Learn:** Study kill switches, feature flags, rate limits, audit trails, replay, user-visible history, and incident response.
- **Do:** Implement an agent-disable flag, per-user budgets, trace viewer, and runbook for runaway cost or unsafe plans.
- **Principle:** Operators need the power to stop, inspect, and recover automated systems.
- **Retrieve:** How quickly can the agent be disabled without redeploying?
- **Recovery:** Open the first resource, write three bullets explaining “Add operational controls,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Langfuse — LLM Observability Documentation](https://langfuse.com/docs); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 334 — Make a release decision

- **Learn:** Combine eval results, red-team findings, unresolved risks, user testing, rollback, and staged rollout.
- **Do:** Write a go/no-go memo and ship only if all hard gates pass; otherwise leave a transparent demo-only mode.
- **Principle:** Professional judgment includes refusing production release when evidence is insufficient.
- **Retrieve:** Which uncertainty remains too large for production use?
- **Recovery:** Open the first resource, write three bullets explaining “Make a release decision,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 335 — Integrate Week 48: Agent evaluation, safety, and operations

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A production-readiness report for the planner agent with trace evals, red-team tests, budgets, and runbooks.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A production-readiness report for the planner agent with trace evals, red-team tests, budgets, and runbooks. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A production-readiness report for the planner agent with trace evals, red-team tests, budgets, and runbooks.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph)

#### Day 336 — Retrieve, review, and plan after Week 48

- **Learn:** Without notes, explain the five concepts from **Agent evaluation, safety, and operations**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A production-readiness report for the planner agent with trace evals, red-team tests, budgets, and runbooks. **Evidence:** Week 48 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [Hugging Face — AI Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction); [Promptfoo — LLM Evaluation Quick Start](https://www.promptfoo.dev/docs/intro/); [LangChain Academy — Introduction to LangGraph](https://academy.langchain.com/courses/intro-to-langgraph)

### Week 49 — System design for the complete platform

**Milestone:** A defensible system-design packet covering requirements, APIs, data, scaling, reliability, security, and tradeoffs.

**Skills:** `system-design`, `scalability`, `reliability`, `technical-communication`


#### Day 337 — Clarify requirements and capacity

- **Learn:** Learn functional/nonfunctional requirements, users, traffic, data volume, latency, availability, consistency, privacy, and cost assumptions.
- **Do:** Write a one-page requirements and back-of-the-envelope capacity estimate for CodeLift AI.
- **Principle:** Architecture decisions are only meaningful relative to explicit constraints.
- **Retrieve:** Which assumption would most change the architecture if wrong?
- **Recovery:** Open the first resource, write three bullets explaining “Clarify requirements and capacity,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/)

#### Day 338 — Design APIs and data ownership

- **Learn:** Review public/internal endpoints, idempotency, versioning, Mongo/Postgres/vector ownership, retention, and deletion.
- **Do:** Produce an API/data map and identify every source of truth and derived store.
- **Principle:** Each datum needs one authoritative owner and a lifecycle.
- **Retrieve:** Which stored value can be recomputed instead of duplicated?
- **Recovery:** Open the first resource, write three bullets explaining “Design APIs and data ownership,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3); [Harvard CS50 — CS50 SQL: Introduction to Databases with SQL](https://cs50.harvard.edu/sql/); [OpenAI Developers — Data Controls](https://developers.openai.com/api/docs/guides/your-data)

#### Day 339 — Design for scale and resilience

- **Learn:** Study stateless services, caching, queues, background jobs, backpressure, replication, partitioning, and graceful degradation.
- **Do:** Create a scaled architecture and failure table for provider, database, vector store, and worker outages.
- **Principle:** Scaling and reliability choices should follow observed or credible load, not fashion.
- **Retrieve:** Which dependency failure still permits the core daily mission flow?
- **Recovery:** Open the first resource, write three bullets explaining “Design for scale and resilience,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [Docker — Docker Get Started](https://docs.docker.com/get-started/)

#### Day 340 — Design security and observability

- **Learn:** Review identity, authorization, secrets, encryption, audit, LLM boundaries, logs/metrics/traces, and alert ownership.
- **Do:** Create a trust-boundary diagram plus top risks, controls, and signals.
- **Principle:** A secure system is continuously verifiable, not merely configured once.
- **Retrieve:** Which attack would current telemetry fail to reveal?
- **Recovery:** Open the first resource, write three bullets explaining “Design security and observability,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OWASP — OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/); [OWASP GenAI Security Project — OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/); [Langfuse — LLM Observability Documentation](https://langfuse.com/docs)

#### Day 341 — Practice the interview explanation

- **Learn:** Learn structured communication: problem, constraints, design, bottleneck, tradeoff, failure, measurement, next step.
- **Do:** Record or write a 10-minute system-design walkthrough and answer five anticipated challenges.
- **Principle:** Clear engineering communication makes reasoning inspectable and collaborative.
- **Retrieve:** Can each design choice be traced to a stated requirement?
- **Recovery:** Open the first resource, write three bullets explaining “Practice the interview explanation,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 342 — Integrate Week 49: System design for the complete platform

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A defensible system-design packet covering requirements, APIs, data, scaling, reliability, security, and tradeoffs.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A defensible system-design packet covering requirements, APIs, data, scaling, reliability, security, and tradeoffs. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A defensible system-design packet covering requirements, APIs, data, scaling, reliability, security, and tradeoffs.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

#### Day 343 — Retrieve, review, and plan after Week 49

- **Learn:** Without notes, explain the five concepts from **System design for the complete platform**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A defensible system-design packet covering requirements, APIs, data, scaling, reliability, security, and tradeoffs. **Evidence:** Week 49 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [MIT Missing Semester — Packaging and Shipping Code](https://missing.csail.mit.edu/2026/shipping-code/); [University of Helsinki — Full Stack Open Part 3: Node.js and Express](https://fullstackopen.com/en/part3)

### Week 50 — Capstone integration and user experience

**Milestone:** A coherent CodeLift AI capstone where daily learning, MERN, Python, RAG, evals, and agents support one focused user journey.

**Skills:** `capstone`, `product-design`, `accessibility`, `quality-assurance`


#### Day 344 — Cut scope to the strongest story

- **Learn:** Learn capstone thesis, primary persona, critical journey, must/should/could, feature flags, and deleting distracting features.
- **Do:** Define the final demo path and archive or hide features that do not support it.
- **Principle:** Scope control converts a collection of experiments into a coherent product.
- **Retrieve:** Which feature is impressive but weakens the main story?
- **Recovery:** Open the first resource, write three bullets explaining “Cut scope to the strongest story,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

#### Day 345 — Integrate the golden path

- **Learn:** Review onboarding → today mission → learning → proof → reflection → coach → roadmap → weekly plan.
- **Do:** Make the golden path work from a clean database with deterministic seed and mock AI.
- **Principle:** A portfolio product must be demonstrable without fragile external dependencies.
- **Retrieve:** Can the complete demo run with no paid API key?
- **Recovery:** Open the first resource, write three bullets explaining “Integrate the golden path,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [University of Helsinki — Full Stack Open](https://fullstackopen.com/en/); [FastAPI — FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

#### Day 346 — Polish visual feedback and accessibility

- **Learn:** Study hierarchy, motion purpose, reduced motion, keyboard flow, focus, contrast, responsive layouts, and perceived performance.
- **Do:** Complete the Cosmic Sunrise graphics, transitions, skeletons, empty states, and accessibility audit.
- **Principle:** Delight supports comprehension and motivation only when it preserves usability and control.
- **Retrieve:** Which animation communicates state rather than merely decorating it?
- **Recovery:** Open the first resource, write three bullets explaining “Polish visual feedback and accessibility,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility); [freeCodeCamp — Responsive Web Design Certification](https://www.freecodecamp.org/learn/responsive-web-design-v9)

#### Day 347 — Harden data and AI edge cases

- **Learn:** Review empty/new user, missed week, duplicate click, offline/provider outage, deleted note, bad seed, injection, and partial service failure.
- **Do:** Run a scripted edge-case matrix and fix every critical failure or document a safe limitation.
- **Principle:** The quality of a product is often revealed outside the happy path.
- **Retrieve:** Which failure could cause data loss or a false claim of completion?
- **Recovery:** Open the first resource, write three bullets explaining “Harden data and AI edge cases,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Promptfoo — LLM Red Teaming](https://www.promptfoo.dev/docs/red-team/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 348 — Run final release gates

- **Learn:** Execute lint, typecheck, all tests, build, seed validation, link checks, accessibility smoke, local evals, and security scans.
- **Do:** Produce a machine-readable quality report and repair until score is at least 95/100 with no critical failures.
- **Principle:** Completion is an evidence state, not a feeling.
- **Retrieve:** Which gate still lacks reproducible evidence?
- **Recovery:** Open the first resource, write three bullets explaining “Run final release gates,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [GitHub — Understanding GitHub Actions](https://docs.github.com/en/actions/about-github-actions/understanding-github-actions)

#### Day 349 — Integrate Week 50: Capstone integration and user experience

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A coherent CodeLift AI capstone where daily learning, MERN, Python, RAG, evals, and agents support one focused user journey.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A coherent CodeLift AI capstone where daily learning, MERN, Python, RAG, evals, and agents support one focused user journey. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A coherent CodeLift AI capstone where daily learning, MERN, Python, RAG, evals, and agents support one focused user journey.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [University of Helsinki — Full Stack Open](https://fullstackopen.com/en/)

#### Day 350 — Retrieve, review, and plan after Week 50

- **Learn:** Without notes, explain the five concepts from **Capstone integration and user experience**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A coherent CodeLift AI capstone where daily learning, MERN, Python, RAG, evals, and agents support one focused user journey. **Evidence:** Week 50 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [University of Helsinki — Full Stack Open](https://fullstackopen.com/en/)

### Week 51 — Portfolio storytelling and interview readiness

**Milestone:** A portfolio package with polished repositories, demo media, architecture evidence, and practiced technical stories.

**Skills:** `portfolio`, `resume`, `interview-prep`, `communication`


#### Day 351 — Write a high-signal README

- **Learn:** Learn problem framing, outcomes, screenshots, quick start, architecture, tests/evals, security, tradeoffs, limitations, and roadmap.
- **Do:** Rewrite the capstone README for a hiring manager who has five minutes.
- **Principle:** Documentation is an interface to the project’s value and reasoning.
- **Retrieve:** What proof supports each major capability claim?
- **Recovery:** Open the first resource, write three bullets explaining “Write a high-signal README,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 352 — Create demo assets

- **Learn:** Study demo scripts, seeded data, visual pacing, captions, privacy, failure backup, and concise explanations.
- **Do:** Record or script a 2–4 minute walkthrough and capture clean screenshots/GIFs without personal data.
- **Principle:** A controlled demo reduces cognitive load and makes technical value visible.
- **Retrieve:** Which three moments best prove full-stack AI engineering?
- **Recovery:** Open the first resource, write three bullets explaining “Create demo assets,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 353 — Write resume bullets with evidence

- **Learn:** Learn action + system + method + measured result, honest scale, keywords, and avoiding inflated AI claims.
- **Do:** Create three capstone bullets and three supporting-project bullets with defensible metrics.
- **Principle:** Credible impact statements separate what was built, how it worked, and what was measured.
- **Retrieve:** Can every number and technical claim be defended in an interview?
- **Recovery:** Open the first resource, write three bullets explaining “Write resume bullets with evidence,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 354 — Prepare technical stories

- **Learn:** Use situation, constraint, action, tradeoff, result, learning for debugging, security, RAG quality, and scope decisions.
- **Do:** Write six concise stories and practice follow-up questions on the hardest tradeoff.
- **Principle:** Interview stories reveal decision quality better than a list of technologies.
- **Retrieve:** What evidence changed your original approach?
- **Recovery:** Open the first resource, write three bullets explaining “Prepare technical stories,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MIT Missing Semester — Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/)

#### Day 355 — Create an interview question bank

- **Learn:** Review JavaScript/TypeScript, React, Node, databases, Python, ML metrics, LLMs, RAG, evals, agents, and system design.
- **Do:** Create 60 tagged questions, answer 15 aloud, and schedule spaced reviews for weak areas.
- **Principle:** Retrieval practice exposes knowledge that recognition-based review hides.
- **Retrieve:** Which answer can you recognize but not produce from memory?
- **Recovery:** Open the first resource, write three bullets explaining “Create an interview question bank,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [Harvard CS50 — CS50x: Introduction to Computer Science](https://cs50.harvard.edu/x/); [University of Helsinki — Full Stack Open](https://fullstackopen.com/en/); [Google for Developers — Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course); [Hugging Face — LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)

#### Day 356 — Integrate Week 51: Portfolio storytelling and interview readiness

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A portfolio package with polished repositories, demo media, architecture evidence, and practiced technical stories.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A portfolio package with polished repositories, demo media, architecture evidence, and practiced technical stories. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A portfolio package with polished repositories, demo media, architecture evidence, and practiced technical stories.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

#### Day 357 — Retrieve, review, and plan after Week 51

- **Learn:** Without notes, explain the five concepts from **Portfolio storytelling and interview readiness**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A portfolio package with polished repositories, demo media, architecture evidence, and practiced technical stories. **Evidence:** Week 51 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/); [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility)

### Week 52 — Targeted job search and professional launch

**Milestone:** A focused application system targeting bridge roles with tailored evidence, networking, interview practice, and iteration.

**Skills:** `job-search`, `networking`, `career-strategy`, `analytics`


#### Day 358 — Define the target-role portfolio

- **Learn:** Compare AI Application Engineer, Full-Stack AI Engineer, Applied AI Engineer, and AI Solutions Engineer responsibilities.
- **Do:** Create a role scorecard and choose two primary titles plus one adjacent fallback based on demonstrated strengths.
- **Principle:** A focused search makes skill gaps and portfolio evidence actionable.
- **Retrieve:** Which target role values your full-stack/business translation advantage most?
- **Recovery:** Open the first resource, write three bullets explaining “Define the target-role portfolio,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer)

#### Day 359 — Build an evidence-to-requirement matrix

- **Learn:** Learn extracting requirements, must-have versus preference, transferable evidence, gaps, and avoiding keyword-only matching.
- **Do:** Map ten representative requirements to code, demo, test, design document, or a planned learning gap.
- **Principle:** Applications are stronger when every claim points to inspectable evidence.
- **Retrieve:** Which common requirement currently has no credible artifact?
- **Recovery:** Open the first resource, write three bullets explaining “Build an evidence-to-requirement matrix,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 360 — Tailor applications efficiently

- **Learn:** Study resume variants, concise cover notes, project ordering, application tracking, quality over volume, and honest AI use.
- **Do:** Create a reusable tailoring checklist and complete two high-quality mock or real applications.
- **Principle:** Optimization applies to the job funnel: measure responses and improve one stage at a time.
- **Retrieve:** What changed because of the specific role rather than generic wording?
- **Recovery:** Open the first resource, write three bullets explaining “Tailor applications efficiently,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MIT Missing Semester — Code Quality](https://missing.csail.mit.edu/2026/code-quality/)

#### Day 361 — Network through useful technical context

- **Learn:** Learn informational outreach, alumni/community participation, project feedback requests, follow-up, and reciprocity.
- **Do:** Draft three short outreach messages and share one project insight or ask one specific feedback question.
- **Principle:** Professional relationships grow through relevance, respect, and repeated contribution—not transactional asks.
- **Retrieve:** What value or clear context does the recipient receive?
- **Recovery:** Open the first resource, write three bullets explaining “Network through useful technical context,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MIT Missing Semester — Agentic Coding](https://missing.csail.mit.edu/2026/agentic-coding/)

#### Day 362 — Run a weekly career improvement loop

- **Learn:** Study funnel metrics, rejection learning without overfitting, interview retrospectives, skill-gap selection, and sustainable cadence.
- **Do:** Create a weekly dashboard for applications, replies, screens, interviews, feedback, and next experiment.
- **Principle:** Career progress is a feedback system; control inputs you can improve without treating outcomes as identity.
- **Retrieve:** Which next experiment targets the largest current bottleneck?
- **Recovery:** Open the first resource, write three bullets explaining “Run a weekly career improvement loop,” then make one tiny edit, example, or test toward today’s build task.
- **Links:** [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex); [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/)

#### Day 363 — Integrate Week 52: Targeted job search and professional launch

- **Learn:** Connect this week’s concepts into one coherent vertical slice. Re-read the acceptance evidence for: A focused application system targeting bridge roles with tailored evidence, networking, interview practice, and iteration.
- **Do:** Finish the smallest end-to-end version of the weekly milestone: A focused application system targeting bridge roles with tailored evidence, networking, interview practice, and iteration. Run the most relevant test or manual verification and remove one piece of avoidable duplication. **Evidence:** Weekly milestone evidence: A focused application system targeting bridge roles with tailored evidence, networking, interview practice, and iteration.
- **Principle:** Integration exposes assumptions hidden by isolated exercises; shipping requires verification and communication.
- **Retrieve:** Which interface or assumption failed only when the pieces were connected?
- **Recovery:** Run the current project, capture one failing or working path, and write the next smallest integration step as a GitHub issue or README note.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

#### Day 364 — Retrieve, review, and plan after Week 52

- **Learn:** Without notes, explain the five concepts from **Targeted job search and professional launch**. Then compare with the resources, correct misconceptions, and schedule reviews for the weakest ideas at +3, +7, +14, and +30 days.
- **Do:** Update the weekly reflection, skill evidence, and README. Repair one confusing item or incomplete test connected to: A focused application system targeting bridge roles with tailored evidence, networking, interview practice, and iteration. **Evidence:** Week 52 reflection, one corrected misconception, and next-week implementation intention.
- **Principle:** Spaced retrieval and error correction strengthen durable, transferable knowledge more than passive rereading.
- **Retrieve:** Which idea could you recognize but could not explain or rebuild from memory?
- **Recovery:** Answer one knowledge check from memory, correct it with the resource, and record a five-minute recovery win.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [GitHub — System Design Primer](https://github.com/donnemartin/system-design-primer); [Mermaid — Mermaid Diagram Syntax](https://mermaid.js.org/intro/)

## Final Day 365 — Evidence, release, and continuation


#### Day 365 — Release CodeLift AI, audit mastery, and write the next 90-day plan

- **Learn:** Review the year through artifacts rather than completion counts: commits, tests, demos, explanations, eval reports, security decisions, and interview stories. Identify what is introduced, practiced, demonstrated, and still fragile.
- **Do:** Create the final tagged release and release notes; attach the capstone demo, quality report, system design, and resume evidence. From a blank file, rebuild one tiny typed or retrieval function without AI help, record gaps, then choose a focused 90-day specialization and job-search cadence. **Evidence:** Public release, mastery audit, independent mini-build note, and 90-day continuation plan.
- **Principle:** Mastery is demonstrated transfer. A roadmap is a hypothesis that must be updated when evidence, constraints, and goals change.
- **Retrieve:** Which skill can you now transfer independently, and which one still depends on recognition or AI-generated scaffolding?
- **Recovery:** Write the release checklist, identify one strongest artifact and one weakest skill, and schedule the first 30-minute session of the next plan.
- **Links:** [MIT Missing Semester — Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/); [MIT Missing Semester — Agentic Coding](https://missing.csail.mit.edu/2026/agentic-coding/); [OpenAI Developers — Build Iterative Repair Loops with Codex](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)


# 13. Seed and Content Generation Rules

The blueprint is canonical seed input, not display-ready prose by itself.

For each day, generate concise original teaching content with:

- `learningObjective` beginning with an observable verb;
- `whyItMattersForAIEngineering`;
- one `mentalModel` grounded in the actual concept;
- one `commonMistake`;
- three knowledge checks:
  1. recall,
  2. apply/change an example,
  3. explain why or compare a tradeoff;
- a teach-back prompt;
- prerequisite day numbers;
- a five-minute Recovery estimate;
- an optional Stretch estimate no greater than ten minutes;
- the exact resource URLs from the blueprint;
- a tiny artifact definition and acceptable evidence types;
- retrieval-review prompts.

Do not generate filler such as “learn more about X.” The mission must tell the learner what to inspect, type, test, compare, and save.

Course/content rules:

- Never scrape, mirror, or copy course text.
- Link to the free resource and summarize in original words.
- Use `target="_blank"` with `rel="noopener noreferrer"`.
- Include a short topic hint so the learner knows what section to find.
- Track link status, but a transient link-check failure must not delete a resource.
- Prefer official documentation and the listed free curricula.
- When a resource reorganizes, update the catalog while preserving the day’s learning objective.
- Clearly label optional API usage that may incur provider cost.
- The default mock/local route must let the learner complete every day for free.

# 14. Seed Validation

Create `curriculum:validate` and tests that fail when:

- the total is not exactly 365;
- day numbers are missing, repeated, or out of order;
- Days 1–364 do not form exactly 52 groups of seven;
- a month/phase/week mapping is invalid;
- a Core schedule does not total exactly 30;
- a Recovery task is missing or estimated above five minutes;
- a required field is blank or generic;
- a day has no HTTPS resource;
- a resource ID is unknown;
- a skill tag is missing;
- knowledge checks do not cover recall/application/explanation;
- a prerequisite references the future or an unknown day;
- a duplicate curriculum seed would be created by rerunning the seed;
- Day 365 is not the final release/mastery/continuation day.

Create `curriculum:links` with bounded concurrency, timeout, retry, and a report. Do not fail the entire local app solely because a third-party course site temporarily blocks automated HEAD requests; fall back to a GET or mark `unknown` with evidence. Do fail for malformed URLs and unknown resource IDs.

# 15. Visual, Accessibility, and Content QA

Create a route or Storybook-like internal gallery that renders all important visual states:

- new user;
- active day;
- Core complete;
- Recovery complete;
- missed return;
- grace token;
- milestone;
- empty data;
- loading;
- API error;
- AI timeout/refusal/schema error;
- RAG no-evidence;
- agent awaiting approval;
- reduced motion;
- mobile narrow width;
- dark theme.

Run automated accessibility checks where practical and manually verify:

- keyboard-only onboarding and mission completion;
- focus after validation errors and modal close;
- contrast;
- headings/landmarks;
- no color-only meaning;
- zoom/reflow;
- reduced motion;
- chart alternatives;
- clear generated-content labels.

Take local screenshots of major pages when the environment supports it. Repair clipping, overlap, unreadable charts, and broken responsive states before declaring UI complete.

# 16. Required Tests

At minimum, implement:

## Domain/unit

- day/date mapping;
- progress state transitions;
- XP event idempotency;
- streak, rolling momentum, and grace token rules;
- review scheduling;
- catch-up planning;
- skill introduced/practiced/demonstrated transitions;
- curriculum validators;
- retrieval scoring helpers;
- tool-loop terminal conditions;
- agent budget enforcement.

## Node integration

- auth registration/login/logout;
- HTTP-only session behavior and CSRF approach;
- cross-user authorization denial;
- curriculum retrieval;
- Core and Recovery completion;
- reflection draft preservation;
- idempotent progress update;
- deletion cascade to indexed sources;
- Python-service timeout/fallback;
- AI provider error normalization.

## Python

- curriculum/data validators;
- progress analysis;
- feature construction;
- model endpoint schema;
- provider protocols/mocks;
- embedding and reranking mock behavior;
- FastAPI health and failure responses.

## Frontend/component

- Today card states;
- accessible mode selection;
- timer pause/resume;
- resource link rendering;
- knowledge-check hint/explanation;
- saved reflection draft;
- false-success prevention on API failure;
- reduced-motion celebration;
- RAG citation panel;
- agent approval/revision.

## E2E

1. register → onboard → Day 1 → Core complete → evidence → reflection → XP;
2. miss a calendar day → continue next curriculum day without auto-skip;
3. use Recovery → distinct Recovery state and humane feedback;
4. provider unavailable → mock/fallback path;
5. ask a note question → grounded answer with resolvable citations;
6. cross-user notes never appear;
7. weekly agent plan → approval required before save;
8. account delete → user product data and derived index records are removed.

## AI evals/security

- schema/refusal/malformed/timeout cases;
- prompt/version regression;
- RAG relevance, faithfulness, abstention, citation validity;
- tool choice, argument validation, authorization, duplicate call, max steps;
- direct/indirect prompt injection;
- sensitive data and cross-tenant leakage;
- excessive agency;
- denial-of-wallet budgets;
- unsafe rendered output.

# 17. Documentation Codex Must Create

## `AGENTS.md`

Include durable repository rules:

- inspect `PLANS.md` first;
- preserve MERN core and Python service boundary;
- use strict TypeScript and Python typing;
- validate every external boundary;
- no secrets/client keys;
- mock/free mode must remain working;
- no hosted deprecated eval/fine-tune dependency;
- run focused tests, then broader gates;
- curriculum invariants are non-negotiable;
- AI output is untrusted;
- authorization occurs at execution/data boundaries;
- accessible/reduced-motion UI;
- no shame or manipulative reinforcement;
- update ADRs for material architecture decisions;
- never claim success without command evidence.

## `README.md`

Include:

- product problem and target learner;
- screenshots;
- architecture diagram;
- quick start;
- no-paid-key demo path;
- environment variables;
- seed and validation;
- tests/evals/security commands;
- AI provider choices;
- privacy and data flow;
- curriculum design;
- tradeoffs and limitations;
- deployment;
- portfolio/interview talking points.

## Other docs

Create:

- architecture context/container/component diagrams;
- at least five ADRs: monorepo, MERN+Python boundary, auth, vector store abstraction, agent architecture;
- threat model;
- eval strategy;
- observability/cost runbook;
- curriculum maintenance guide;
- demo script;
- release checklist;
- resume bullet draft;
- system-design walkthrough;
- known limitations.

# 18. Implementation Order

Build in working slices:

1. repository, contracts, CI skeleton, and mock data;
2. auth/onboarding;
3. validated 365-day curriculum seed and resource catalog;
4. Today mission, task state, timer, evidence, reflection;
5. roadmap, review queue, humane progress/graphics;
6. portfolio and Error Museum;
7. Python service and analytics/ML lab endpoints;
8. mock-first AI Coach, structured output, local evals;
9. embeddings/index/RAG/citations/deletion;
10. observability, cost, AI security, red-team tests;
11. optional local model and PEFT learning labs;
12. bounded planner workflow, LangGraph-style state, MCP demo;
13. final visual/accessibility/performance polish;
14. documentation and quality report.

Do not postpone security, tests, validation, or accessibility to the final slice. Add the relevant controls with each feature.

# 19. Definition of Done

CodeLift AI is complete only when:

- a fresh clone can start in documented steps;
- mock/free mode works end to end without a paid key or local model;
- all 365 days seed exactly and validate;
- every day displays specific learning, action, principle, retrieval, Recovery, artifact, and working resource links;
- date mapping and missed-day behavior are correct;
- Today, Roadmap, Reviews, Skills, Portfolio, Error Museum, AI Coach, Search/RAG, Planner, Evals, and Settings are usable;
- the MERN application is integrated with the Python service but degrades safely without it;
- auth and cross-user isolation tests pass;
- core graphics are responsive, accessible, and reduced-motion safe;
- RAG answers resolve citations and abstain without evidence;
- agent actions are bounded, traced, authorized, and approval-gated;
- deterministic/local evals and security tests pass;
- lint, typecheck, tests, builds, seeds, validators, and quality report pass;
- milestone score is at least 95/100 with no critical failure;
- README, security, architecture, runbooks, curriculum guide, portfolio material, and limitations are present;
- no core TODO, placeholder route, fabricated metric, or false-success UI remains.

# 20. Final Response Required From Codex

At the end, report:

1. what was built;
2. repository architecture;
3. exact commands run and pass/fail results;
4. curriculum count and validation evidence;
5. major visual components;
6. tests/evals/security coverage;
7. mock/free path;
8. optional provider setup;
9. known limitations or blockers with evidence;
10. how to start the app;
11. the next three highest-value improvements.

Do not say “complete” when a required command was not run or failed.

## MASTER PROMPT END
