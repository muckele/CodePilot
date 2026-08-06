# Milestone 2 — Secure Account, Onboarding, and Completed Today Mission

## Outcome

Milestone 2 proves one complete private-account journey:

```text
register
→ receive a secure Mongo-backed session
→ complete onboarding
→ open protected /app/today
→ start Core or Recovery
→ save bounded evidence and the three-prompt reflection
→ complete the chosen path
→ sign out
→ sign back in and recover the persisted state
→ delete the account and all user-owned M2 data
```

The existing `/curriculum/:dayNumber` M1 preview remains public, read-only, and unchanged in meaning. The authenticated Today aggregate uses `GET /api/v1/me/today`; do not repurpose the public `GET /api/v1/curriculum/today` preview route.

M2 remains mock/free and makes no AI-provider, Python-service, telemetry, or third-party content request.

## User value

- create a private CodeLift workspace without a paid key;
- choose a realistic start plan and privacy/display preferences;
- receive the next incomplete curriculum day without calendar auto-skip;
- complete either the 30-minute Core path or a distinct Recovery win;
- attach concrete evidence and reflect on learning rather than checking an empty box;
- return after logout and find saved work intact;
- permanently delete the account and all M2 user-owned data.

## Browser routes

Use explicit React Router routes, links, and navigation while keeping session
bootstrap in a persistent protected-route layout.

| Route                    | Access                               | Behavior                                                                         |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------- |
| `/`                      | session-resolved                     | Replace with `/login`, `/app/onboarding`, or `/app/today` after `GET /api/v1/me` |
| `/register`              | signed-out                           | Create an account                                                                |
| `/login`                 | signed-out                           | Enter an existing account                                                        |
| `/app/onboarding`        | authenticated, onboarding incomplete | Complete the required profile                                                    |
| `/app/today`             | authenticated, onboarding complete   | User-scoped Today mission, evidence, reflection, and completion                  |
| `/app/account`           | authenticated                        | Account summary, preferences, sign out, deletion entry                           |
| `/app/account/delete`    | authenticated                        | Deliberate permanent deletion confirmation                                       |
| `/curriculum/:dayNumber` | public                               | Preserve the M1 read-only curriculum preview                                     |

Route rules:

- [ ] Protected content does not render until session bootstrap succeeds.
- [ ] Signed-out access to an `/app/*` route resolves to `/login` with an allowlisted local `returnTo`.
- [ ] An authenticated user with incomplete onboarding resolves to `/app/onboarding`.
- [ ] An authenticated, onboarded user visiting `/login` or `/register` resolves to `/app/today`.
- [ ] Only exact entries enumerated in `ALLOWED_RETURN_PATHS` are valid `returnTo` values; external, protocol-relative, query-bearing, fragment-bearing, and double-encoded candidates fall back safely.
- [ ] Public M1 preview routes never expose account, progress, reflection, evidence, session, or CSRF data.
- [ ] Direct loads and browser back/forward use the same React Router route table without restarting session bootstrap on each internal transition.

## Screen and copy requirements

### Registration

- Eyebrow: **Your private workshop**
- Heading: **Create a place to return to.**
- Supporting copy: **Thirty focused minutes. Honest evidence. No leaderboard.**
- Fields:
  - `email`: **Email address**, `type="email"`, `autocomplete="email"`;
  - `password`: **Password**, `autocomplete="new-password"`;
  - `passwordConfirmation`: **Confirm password**, `autocomplete="new-password"`.
- Primary action: **Create account**
- Existing-user link: **Already have an account? Sign in**
- Generic create failure:

  > We couldn’t create that account. Check the fields, or sign in if you may already have one.

`passwordConfirmation` is a browser validation field and is never sent to or stored by the API.

### Login

- Eyebrow: **Welcome back**
- Heading: **Continue from the next useful step.**
- Supporting copy: **No perfect streak required. Your curriculum waits for you.**
- Fields:
  - `email`: **Email address**, `autocomplete="email"`;
  - `password`: **Password**, `autocomplete="current-password"`.
- Primary action: **Sign in**
- New-user link: **Create an account**
- Generic credential failure:

  > We couldn’t sign you in with those details.

Do not add a nonfunctional password-reset link.

### Onboarding

- Eyebrow: **Set up your workshop**
- Heading: **Build a plan that can survive real life.**
- Intro:

  > You can change these choices later. Missing a calendar day never skips a curriculum day.

- Primary action: **Save and open Today**

Required fields:

| Field                     | Contract                                                     |
| ------------------------- | ------------------------------------------------------------ |
| `displayName`             | required trimmed string, 1–60 characters                     |
| `timezone`                | required supported IANA timezone                             |
| `startDate`               | required ISO local date; past, present, or future is allowed |
| `commitmentMinutes`       | literal `30`                                                 |
| `preferredCodingTime`     | required local `HH:mm` time                                  |
| `routineCue`              | required trimmed string, 1–120 characters                    |
| `codingPlace`             | required trimmed string, 1–120 characters                    |
| `implementationIntention` | required editable string, 1–300 characters                   |
| `whyItMatters`            | required trimmed string, 1–500 characters                    |
| `githubUsername`          | optional GitHub-style username, maximum 39 characters        |
| `targetRoles`             | one or more allowlisted target-role values                   |
| `aiPrivacyMode`           | `local_only` or `ask_before_external`                        |
| `themePreference`         | `system`, `light`, or `dark`                                 |
| `motionPreference`        | `system`, `reduced`, or `gentle`                             |

Target-role options:

- Full-Stack AI Application Engineer
- Applied AI Engineer
- AI Solutions Engineer

Privacy choices:

- **Keep my notes inside CodeLift** — recommended;
- **Ask me before any future external AI use**.

Privacy clarification:

> M2 sends nothing to an AI provider. This preference is not blanket consent.

Compose the initial implementation intention as:

> Today at [time], after [routine], I will code at [place] for 30 minutes.

The sentence remains editable. Once manually edited, later field changes must not silently overwrite it.

### Protected Today

- Greeting: **Welcome back, [displayName].**
- Identity line: **You’re building toward [primary target role].**
- Heading: **Today’s mission**
- Supporting copy: **Your next incomplete curriculum day is ready.**
- Calendar-gap copy:

  > This mission is still here. The curriculum moves when you do.

Display factual, user-scoped data only:

- implementation intention;
- curriculum day, week, month, phase, week focus, and mode label;
- calculated 30-minute Core schedule;
- learning seed, build task, Core principle, retrieval question, and tiny artifact;
- prerequisite days and skill tags;
- CourseTrail resources with safe new-tab behavior;
- current progress status and last saved time;
- current evidence and three reflection drafts.

Mode controls:

- native radio: **Core mission · 30 minutes**;
- native radio: **Recovery win · up to 5 minutes**;
- collapsed disclosure: **Optional Stretch · add after Core**.

Stretch is not a completion mode and never substitutes for Core or Recovery.

Primary actions:

| State                       | Action                           |
| --------------------------- | -------------------------------- |
| Core not started            | **Start 30-minute Core mission** |
| Recovery not started        | **Start Recovery win**           |
| Core in progress            | **Resume Core mission**          |
| Recovery in progress        | **Resume Recovery win**          |
| unsaved evidence/reflection | **Save mission evidence**        |
| Core ready to complete      | **Complete Core mission**        |
| Recovery ready to complete  | **Record Recovery win**          |

Factual completion copy:

- Core: **Core mission recorded with evidence.**
- Recovery:

  > Recovery win recorded separately. A five-minute return still protects your next step.

Do not award or display XP, mastery, streak repair, a badge, or a celebration in M2.

### Evidence and reflection

M2 accepts bounded text/URL evidence; binary upload processing is deferred.

Evidence fields:

| Field            | Contract                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `kind`           | `commit_url`, `test_name`, `screenshot_url`, `demo_url`, `text_explanation`, or `local_artifact_path` |
| `label`          | required trimmed string, 1–120 characters                                                             |
| `value`          | required trimmed string, 1–2,000 characters; HTTPS required for URL kinds                             |
| `idempotencyKey` | required stable client-generated identifier                                                           |

The three reflection prompts are:

1. **What confused me?**
2. **What changed in my mental model?**
3. **What will I retrieve later?**

Each reflection value is a bounded trimmed string of at most 1,000 characters. Drafts may be incomplete; completion requires a nonblank answer to all three prompts. One concise sentence is sufficient for a Recovery win.

Completion rules:

- [ ] Core completion requires an in-progress Core state, at least one accepted evidence record, and all three reflection answers.
- [ ] Recovery completion requires an in-progress Recovery state, explicit Recovery evidence, and all three reflection answers.
- [ ] The API—not the browser—enforces these prerequisites.
- [ ] Core and Recovery completion are mutually exclusive terminal states for a user/day record.
- [ ] A repeated idempotent request cannot duplicate evidence or completion events.
- [ ] The browser shows completion only after the server returns the persisted terminal state.
- [ ] Partial saves remain resumable and are never described as completion.

### Account and deletion

`/app/account` shows the authenticated email, display name, saved privacy/theme/motion preferences, **Sign out**, and a visually separated **Delete account** link.

`/app/account/delete`:

- Heading: **Delete your CodeLift account?**
- Warning:

  > This permanently removes product data owned by this account. This cannot be undone.

- Require current password and exact confirmation text `DELETE`.
- Destructive action: **Permanently delete my account**
- Safe action: **Keep my account**

Deletion success revokes all sessions, removes all user-owned M2 data, clears the cookie, and resolves to a neutral signed-out confirmation. A failed or partial deletion must never display success.

## API acceptance

All browser requests use `credentials: "include"`, `cache: "no-store"`, shared runtime schemas, and consistent RFC 9457-style problems.

| Method and route                             | M2 purpose                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/v1/auth/csrf`                      | Issue a session-bound, no-store CSRF token for protected forms                                 |
| `POST /api/v1/auth/register`                 | Validate credentials, hash password, create user/session, rotate identifiers                   |
| `POST /api/v1/auth/login`                    | Validate credentials generically, rotate session                                               |
| `POST /api/v1/auth/logout`                   | Revoke current session and clear cookie                                                        |
| `GET /api/v1/me`                             | Session bootstrap and onboarding state                                                         |
| `PUT /api/v1/me/onboarding`                  | Save validated onboarding atomically                                                           |
| `GET /api/v1/me/today`                       | Return the authenticated user’s selected day plus scoped progress/evidence/reflection snapshot |
| `PUT /api/v1/progress/:dayNumber/status`     | Start Core/Recovery or request terminal completion                                             |
| `PUT /api/v1/progress/:dayNumber/reflection` | Idempotently save the three bounded reflection drafts                                          |
| `POST /api/v1/progress/:dayNumber/evidence`  | Idempotently append bounded evidence                                                           |
| `DELETE /api/v1/me`                          | Verify password/confirmation, revoke sessions, delete user-owned data                          |

`GET /api/v1/me/today` response requirements:

- [ ] derived from the authenticated user ID at the server boundary;
- [ ] contains no password hash, session token, CSRF secret, or unrelated user data;
- [ ] returns the next incomplete curriculum day, never a client-calculated day;
- [ ] includes the existing `(userId, dayNumber)` progress record or a truthful not-started state;
- [ ] includes only that user’s bounded evidence and reflection;
- [ ] identifies selection as `next_incomplete`;
- [ ] preserves the same incomplete day across missed calendar days;
- [ ] returns a future-start state without creating progress when `startDate` is in the future;
- [ ] does not change the public semantics of `/api/v1/curriculum/today`.

Problem states must distinguish at least:

- `validation-failed` — field errors;
- `invalid-credentials` — generic login/register credential result;
- `authentication-required`;
- `session-expired`;
- `csrf-invalid`;
- `forbidden`;
- `progress-conflict`;
- `completion-evidence-required`;
- `completion-reflection-required`;
- `account-deletion-failed`;
- `service-unavailable`.

## Data and persistence acceptance

MongoDB/Mongoose is the product store for M2. Authentication and authorization integration tests must exercise an isolated real Mongo-compatible database, not repository mocks.

Required M2 records:

- `User`
  - normalized unique email;
  - password hash only;
  - onboarding profile/preferences;
  - timestamps and schema version;
- `Session`
  - opaque random identifier stored as a one-way hash;
  - `userId`, issued/last-seen/expiry timestamps;
  - CSRF binding/version;
  - TTL index;
- `ProgressLog`
  - `userId`, `dayNumber`, status, selected mode, timestamps;
  - bounded embedded evidence or user-scoped evidence references;
  - stable idempotency keys;
- `Reflection`
  - `userId`, `dayNumber`, the three bounded prompts, draft/completion timestamps.

Data invariants:

- [ ] unique normalized email;
- [ ] unique `(userId, dayNumber)` progress record;
- [ ] unique `(userId, dayNumber)` reflection record;
- [ ] all user-owned reads and mutations include authenticated `userId` in the database predicate;
- [ ] password hashes and opaque session hashes are never returned;
- [ ] status transitions allow only `not_started → in_progress → core_completed | recovery_completed`;
- [ ] Core and Recovery remain distinguishable in storage and responses;
- [ ] evidence idempotency keys are unique within the owning user/day;
- [ ] terminal completion is idempotent;
- [ ] a calendar date never increments `dayNumber` by itself;
- [ ] deletion removes User, Session, ProgressLog, Reflection, and all M2 user-owned evidence while retaining global curriculum records;
- [ ] deletion is tested for both success and injected partial-failure handling;
- [ ] rerunning startup/index creation does not duplicate records.

The Mongo test/runtime strategy, version, cleanup behavior, and any replica-set requirement must be documented before product code is declared complete.

## Security and privacy acceptance

- [ ] Passwords use Argon2id or an appropriately configured bcrypt fallback; plaintext passwords never enter logs or storage.
- [ ] Login and registration responses resist account enumeration.
- [ ] Session IDs contain at least 128 bits of cryptographic entropy.
- [ ] Sessions rotate on registration/login and are revoked on logout, password verification failure thresholds, deletion, and expiry.
- [ ] The session cookie is `HttpOnly`, `SameSite=Lax` or stricter, `Path=/`, and `Secure` outside local HTTP development.
- [ ] No auth/session/CSRF credential is stored in localStorage or exposed in browser-readable application state.
- [ ] Every state-changing route validates a session-bound CSRF token from `X-CSRF-Token`.
- [ ] A CSRF failure never automatically replays registration, login, deletion, evidence creation, or completion.
- [ ] Explicit CORS allows only the configured web origin with credentials.
- [ ] Auth, CSRF, evidence, reflection, and deletion inputs have strict runtime schemas and body limits.
- [ ] Authentication and mutation routes have bounded rate limits.
- [ ] Error responses expose neither password validity, stack traces, Mongo details, hashes, nor local paths.
- [ ] Logs use request/session-safe correlation IDs and exclude credentials, CSRF tokens, reflection content, evidence content, and cookie values.
- [ ] Cross-user read, write, completion, and deletion attempts are denied at the data boundary.
- [ ] Account deletion requires a fresh password check, exact `DELETE`, CSRF, and authenticated ownership.
- [ ] No M2 learner content is sent to an AI provider, analytics service, remote font, or telemetry service.
- [ ] Public M1 preview remains usable without accepting a cookie or creating an account.

## Readiness and failure UX

`GET /health` remains process-only. `GET /ready` returns success only when the validated curriculum, Mongo connection, required indexes, and session store are ready.

Required UI states:

- [ ] **Checking your private workspace…** while session bootstrap is unresolved; protected content is absent.
- [ ] **Preparing a protected form…** while CSRF setup is unresolved; mutation controls are disabled.
- [ ] Field validation presents a focused summary linked to each invalid control.
- [ ] Login failures retain only the email, clear the password, and use generic copy.
- [ ] Onboarding save failures preserve the form in component memory and never mark onboarding complete.
- [ ] CSRF expiry says:

  > Your security check expired. Your entries are still here. Refresh protection, then submit again.

- [ ] Session expiry removes protected data from the DOM, focuses the session-ended heading, and says:

  > Your session ended to protect your account. Your progress was not changed.

- [ ] Today-load failure shows no stale mission and offers **Try again**.
- [ ] Evidence/reflection save failure preserves unsaved browser values and reports that nothing new was recorded.
- [ ] Completion failure leaves the prior persisted status visible and never celebrates.
- [ ] Logout failure does not claim that the server session ended.
- [ ] Deletion failure leaves the account/session intact and never shows deletion success.
- [ ] Request IDs appear in support details when safely supplied by the API.

## Accessibility, responsive, and visual acceptance

Retain the current Cosmic Sunrise Workshop tokens, original CSS sunrise/mountain/orbit shapes, system fonts, calm motion, warm technical surfaces, and distinct Core/Recovery styling.

- [ ] One `h1` per page with semantic `header`, `nav`, `main`, and `footer`.
- [ ] Global skip-link copy is appropriate to every screen, such as **Skip to main content**.
- [ ] Native `form`, `label`, `fieldset`, `legend`, input, radio, checkbox, button, link, and `details/summary` controls are used.
- [ ] Auth fields use correct autocomplete tokens.
- [ ] Every field has an accessible name and linked help/error text.
- [ ] New error summaries receive focus; modal focus traps are avoided by using a dedicated deletion route.
- [ ] Loading uses `role="status"`; concise newly introduced errors use `role="alert"` without duplicative announcements.
- [ ] Header navigation marks the current page with `aria-current="page"`.
- [ ] Core, Recovery, Stretch, progress, and errors are understandable without color.
- [ ] Keyboard focus remains clearly visible in light, dark, and forced-color modes.
- [ ] Controls are at least 44×44 CSS pixels where practical.
- [ ] At 320 CSS pixels, screens are single-column, primary actions remain reachable, and horizontal overflow is zero.
- [ ] At 200% zoom, form labels, errors, evidence, and completion controls reflow without overlap.
- [ ] Stored theme/motion preferences apply after session bootstrap; system preference is the initial fallback.
- [ ] `reduced` motion disables all nonessential animation; no content or status depends on motion.
- [ ] Resource links retain meaningful names, HTTPS URLs, `target="_blank"`, and `rel="noopener noreferrer"`.
- [ ] No random reward, shame copy, red failure spectacle, false urgency, or unverified praise is introduced.

## Focused test gates

### Contract and domain

- [ ] Auth, session, CSRF, onboarding, Today aggregate, progress transition, evidence, reflection, and problem schemas have positive and negative tests.
- [ ] Progress transition tests cover both Core and Recovery terminal paths and reject cross-mode/terminal rewrites.
- [ ] Day selection tests prove next-incomplete behavior, future starts, calendar gaps, and no auto-skip.
- [ ] Evidence/reflection bounds and idempotency are tested.
- [ ] Completion rejects missing evidence or any missing reflection prompt.

### Node/Mongo integration

- [ ] Register sets a secure session and stores only a password hash.
- [ ] Duplicate registration and invalid login use enumeration-resistant responses.
- [ ] Login rotates the session; logout revokes it.
- [ ] Expired/revoked sessions cannot read `/api/v1/me/today`.
- [ ] Every mutation rejects missing, malformed, and mismatched CSRF tokens.
- [ ] Onboarding persists and remains user-scoped.
- [ ] `/api/v1/me/today` returns the correct user/day/progress aggregate.
- [ ] User A cannot read or mutate User B’s progress, reflection, evidence, or account.
- [ ] Evidence and terminal completion remain idempotent under replay/concurrency.
- [ ] Logout/login restores the same in-progress or completed data.
- [ ] Delete removes all M2 user-owned records, revokes all sessions, and preserves global curriculum.
- [ ] Injected database/session-store outages fail readiness and do not produce partial success.

### Frontend/component

- [ ] React Router route/session guards cover signed-out, onboarding-incomplete, and onboarded states.
- [ ] Public M1 preview still renders without session bootstrap.
- [ ] Registration and login forms serialize only intended fields and send credentials/CSRF correctly.
- [ ] CSRF refresh preserves entries but never auto-replays a non-idempotent action.
- [ ] Onboarding validates every required field and preserves a manually edited implementation intention.
- [ ] Today renders the server-selected next incomplete day rather than calculating one in the browser.
- [ ] Core and Recovery send distinct start/completion payloads; Stretch sends no completion status.
- [ ] Evidence and all three reflection prompts save, reload, and remain bounded.
- [ ] A failed save/completion produces no false-success state.
- [ ] A `401` removes private DOM content and focuses the session-expiry state.
- [ ] Logout and deletion failure/success states remain truthful.
- [ ] Keyboard, focus, error linkage, safe resources, theme, reduced motion, and narrow layout receive automated and manual evidence.

### End-to-end account journeys

1. [ ] Register → onboard → `/app/today` → start Core → save evidence/reflection → logout → login → restore → complete Core.
2. [ ] Register separate user → onboard → start Recovery → save explicit evidence/reflection → complete Recovery with a distinct terminal state.
3. [ ] Miss calendar days → return to the same next incomplete curriculum day.
4. [ ] Attempt cross-user progress/evidence URL access → receive denial and no data.
5. [ ] Expire session during Today → private state disappears → sign in again → resume persisted work.
6. [ ] Delete account → all M2 user data and sessions disappear → login fails → public preview still works.

### Required commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm curriculum:validate
pnpm security:check
pnpm security:audit
pnpm performance:check
pnpm quality:report
```

No command may be represented by a success-only placeholder. Mongo-backed integration evidence and fresh source-bound browser evidence are required before scoring M2.

## Scorecard

| Area                                                 |  Points | Required M2 evidence                                                                         |
| ---------------------------------------------------- | ------: | -------------------------------------------------------------------------------------------- |
| User-visible acceptance criteria                     |      20 | Complete register/onboard/Today/complete/resume/delete journey; both Core and Recovery       |
| Type safety and runtime validation                   |      10 | Strict shared schemas at every browser/API/Mongo boundary                                    |
| Unit/integration/E2E evidence                        |      15 | Domain, real-Mongo auth/isolation, component, and complete account journeys                  |
| Curriculum and seed integrity                        |      15 | Next-incomplete mapping, unchanged 365-day source, no auto-skip, public preview preserved    |
| Accessibility and responsive visual QA               |      10 | Forms, focus/errors, keyboard, 320px, zoom, dark, reduced/forced color                       |
| Security and privacy                                 |      10 | Password/session/CSRF controls, authorization, rate limits, deletion, log minimization       |
| AI evals/grounding/failure handling where applicable |      10 | No AI surface or data egress; deterministic free mode and truthful `not_applicable` AI gates |
| Documentation and maintainability                    |       5 | Plans, ADRs, auth threat model, Mongo/session/deletion runbooks, limitations                 |
| Performance, cost, and operational evidence          |       5 | Bounded payloads, indexes, readiness/outage behavior, bundle budget, zero provider cost      |
| **Total**                                            | **100** | **At least 95 with zero critical failures**                                                  |

Scoring rules:

- [ ] Every awarded point cites a command, test, report, or manual observation.
- [ ] Missing evidence earns zero points.
- [ ] All relevant quality commands pass independently of the numeric score.
- [ ] The milestone passes only at **95/100 or higher** with **zero critical failures**.
- [ ] After twelve focused attempts on one blocker, record exact evidence in `BLOCKERS.md`, choose a safe fallback, and continue only unblocked work.

## Critical failures

Any of the following fails M2 regardless of score:

- build or required quality-gate failure;
- authentication bypass, session fixation, ineffective logout, or session reuse after deletion;
- missing/ineffective CSRF protection on a state-changing route;
- password, cookie, session ID/hash, or CSRF-token exposure;
- cross-user read, mutation, completion, or deletion;
- unscoped user-owned Mongo query;
- public M1 preview regression or new account requirement for public curriculum;
- client-calculated/auto-skipped curriculum day;
- Core and Recovery stored or displayed as the same terminal state;
- completion without required evidence and all three reflection answers;
- duplicate evidence/completion caused by replay;
- fabricated save, completion, logout, or deletion success;
- lost persisted progress after successful save/logout/login;
- partial account deletion presented as success;
- inaccessible registration, onboarding, Today completion, session-expiry, or deletion flow;
- private learner content sent to an external provider, telemetry system, log, or browser storage;
- unhandled Mongo/session-store outage serving stale or falsely successful protected state.

## Explicitly deferred

- password-reset email delivery, email verification, OAuth, passkeys, and multi-device session management;
- binary screenshot/file uploads and remote URL capture;
- working FocusOrb timer, pause/resume, and actual-time analytics;
- intentionally skipped/rescheduled states, catch-up planning, backlog, seven-day preview, search, filters, and user-created subtasks;
- review queue, spaced-review generation, closed-note knowledge checks, misconceptions, and Error Museum;
- XP, achievements, grace tokens, streaks, MomentumOrbit, JourneyMap, SkillConstellation, CodeGarden, MilestonePeak, and celebration animation;
- portfolio records and career evidence beyond the bounded daily evidence saved in M2;
- live resource-link status and final display-ready curriculum enrichment;
- Python/FastAPI, PostgreSQL, analytics/ML endpoints, Docker Compose for the full platform;
- AI Coach, provider calls, AI evals, embeddings, RAG, citations, agents, workflows, and MCP;
- production deployment and administrator/content tooling.

Deferred capabilities must not appear as enabled controls, fabricated metrics, empty dashboards, or success-only placeholders.
