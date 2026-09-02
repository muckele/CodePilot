# M16 Full MVP Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate, repair, productize, and conditionally deploy the existing
CodeLift AI M16 candidate to the strongest truthful Full MVP release state
without expanding the frozen feature set.

**Architecture:** Preserve the existing browser-to-Node public boundary,
MongoDB product authority, optional safely degrading Python service, and
mock-first AI path. Treat the current uncommitted M16 work as an unverified
candidate; verify each behavioral boundary, repair only reproduced defects,
then bind the complete release suite and any deployment to the exact clean
commit.

**Tech Stack:** Node.js 24.14.0, pnpm 11.9.0, strict TypeScript, React/Vite,
Express, MongoDB replica set, Python 3.12/FastAPI, Vitest, Playwright with
Chromium and WebKit, axe, Docker Compose, uv, Ruff, mypy, pytest, Trivy, and
GitHub Actions.

**Spec:**
`docs/superpowers/specs/2026-09-01-m16-full-mvp-launch-readiness-design.md`

## Global Constraints

- CodeLift AI is the product name; CodePilot is the repository/project name.
- The MVP feature set is frozen. Implement only demonstrated P0/P1 launch
  defects, security/reliability issues, release-gate failures, and necessary
  release-truth documentation corrections.
- Preserve the browser -> Node -> Mongo authority boundary. Python remains
  internal, optional, and safely degrading. PostgreSQL is not a production
  dependency.
- Preserve
  `codelift_ai_codex_master_prompt_v2_2026.md` at SHA-256
  `05c4541cc358579f0ec56a8ef2d8881e7c1cb49aeacfa5ccb33eda9a2ccaa1c6`.
- Preserve
  `codelift_ai_curriculum_seed_v2_2026.json` at SHA-256
  `af4183cc6d139c34e7ebe63949055fa6fe2e89a25c54c707a4c67a219ed9eb99`.
- Preserve the original candidate recovery snapshot at
  `/private/tmp/codelift-m16-start.hk9ITF` and verify its `SHA256SUMS` before
  any recovery use.
- Do not weaken Node, pnpm, Python, browser, Docker, security, or production
  requirements because of local shell or sandbox limitations.
- Do not deploy a dirty or intermediate working tree. Production may receive
  only an exact clean commit whose required source/release gates passed.
- Do not create or purchase billable infrastructure, a domain, or a managed
  database without explicit authorization.
- Do not create an MVP tag or claim `FULL_MVP_PASS` without verified hosted
  HTTPS, persistence, backup/restore, and live-product evidence.
- Keep secrets, tokens, cookies, invitation/reset URLs, private learning text,
  and database credentials out of commands, logs, screenshots, patches,
  reports, and documentation.
- Use isolated synthetic users and delete them after each live or production
  journey.
- For every observed failure, use systematic root-cause debugging and
  test-driven repair: reproduce, classify, add/identify the failing regression,
  make the smallest correction, run the focused test, then run the affected
  suite.

## File and evidence map

- Production configuration and topology:
  `.env.example`, `apps/api/src/config.ts`,
  `apps/api/src/test/config.test.ts`, `apps/api/Dockerfile`,
  `apps/web/Dockerfile`, `apps/web/nginx.conf`, `services/ai/Dockerfile`,
  `infra/compose.yaml`, `infra/compose.production.yaml`, `.github/workflows/ci.yml`.
- Access and lifecycle:
  `packages/contracts/src/account.ts`, `apps/api/src/persistence/models.ts`,
  `apps/api/src/account/access-operator.ts`,
  `apps/api/src/account/operator-cli.ts`, `apps/api/src/account/service.ts`,
  `apps/api/src/account/router.ts`, `apps/web/src/features/account/AccountExperience.tsx`,
  `apps/web/src/features/account/api/accountApi.ts`,
  `apps/web/src/features/policy/PolicyPages.tsx`.
- Observability and pilot measurement:
  `apps/api/src/http/problem.ts`,
  `apps/api/src/middleware/request-context.ts`, `apps/api/src/metrics/cli.ts`,
  `apps/api/src/metrics/pilot-metrics.ts`,
  `docs/runbooks/observability.md`, `docs/mvp-pilot.md`.
- Browser and UX evidence:
  `apps/web/src/app/App.tsx`, `apps/web/src/components/AppShell.tsx`,
  `apps/web/src/styles/global.css`, `apps/web/vite.config.ts`,
  `apps/web/src/test/account-flow.test.tsx`, `e2e/codelift-journeys.spec.ts`,
  `e2e/support/database.ts`, `e2e/support/journey.ts`,
  `playwright.config.ts`, `docs/quality/release-manual.json`,
  `docs/quality/screenshots/`.
- Release tooling and supply chain:
  `package.json`, `pnpm-lock.yaml`, `services/ai/pyproject.toml`,
  `services/ai/uv.lock`, `services/ai/.uv-version`,
  `infra/scripts/mvp-source-check.mjs`,
  `infra/scripts/mvp-live-check.mjs`, `infra/scripts/python-audit.mjs`,
  `infra/scripts/image-audit.mjs`, `infra/scripts/security-check.mjs`,
  `infra/scripts/check-bundle.mjs`,
  `infra/scripts/check-fresh-clone.mjs`,
  `infra/scripts/quality-report.mjs`.
- Release truth:
  `PLANS.md`, `README.md`, `docs/deployment.md`,
  `docs/known-limitations.md`, `docs/release-checklist.md`,
  `docs/milestones/16-private-pilot-launch-readiness.md`,
  `docs/deployment-decision.md`, `docs/release-governance.md`,
  `docs/adr/0008-private-pilot-runtime-boundary.md`, affected runbooks, and
  portfolio/demo documentation.

---

### Task 1: Verify the recovery snapshot and establish the pinned toolchain

**Files:**

- Preserve: `/private/tmp/codelift-m16-start.hk9ITF/*`
- Inspect: `.nvmrc`, `.node-version`, `package.json`, `services/ai/.uv-version`,
  `services/ai/pyproject.toml`, `services/ai/uv.lock`
- Modify only if demonstrated: `.gitignore`

**Interfaces:**

- Consumes: the approved design and starting-state snapshot.
- Produces: a shell command prefix that resolves exactly Node 24.14.0 and pnpm
  11.9.0, plus a Python 3.12 locked environment, without changing repository
  version requirements.

- [ ] **Step 1: Re-verify snapshot integrity and starting metadata**

  Run:

  ```bash
  shasum -a 256 -c /private/tmp/codelift-m16-start.hk9ITF/SHA256SUMS
  sed -n '1,120p' /private/tmp/codelift-m16-start.hk9ITF/git-status.txt
  sed -n '1,120p' /private/tmp/codelift-m16-start.hk9ITF/tracked-diff-stat.txt
  ```

  Expected: every digest reports `OK`; the recorded base is
  `424de51004e08e7e6b115b72e61519c35388f040`.

- [ ] **Step 2: Install the repository-pinned Node runtime outside the repository**

  On this Darwin arm64 host, download the official Node 24.14.0 archive and
  official checksum to `/private/tmp`, verify the archive against
  `SHASUMS256.txt`, and extract it under a task-specific directory. Network and
  external-cache access use the approved escalation mechanism.

  Expected executable:

  ```text
  /private/tmp/codelift-node-v24.14.0/node-v24.14.0-darwin-arm64/bin/node
  ```

- [ ] **Step 3: Activate pnpm 11.9.0 through isolated Corepack state**

  Run with a task-specific `COREPACK_HOME` under `/private/tmp`, then verify:

  ```bash
  node --version
  pnpm --version
  python3.12 --version
  ```

  Expected: `v24.14.0`, `11.9.0`, and Python `3.12.x`.

- [ ] **Step 4: Synchronize locked dependencies without rewriting locks**

  Run:

  ```bash
  pnpm install --frozen-lockfile
  services/ai/.venv/bin/uv sync --project services/ai --locked --extra dev
  pnpm python:lock-check
  ```

  Expected: frozen JavaScript install and locked Python synchronization pass;
  neither lockfile changes.

- [ ] **Step 5: Correct generated-cache hygiene if still reproduced**

  The starting status shows a root `.mypy_cache/` path. Confirm the pinned
  scripts use task-specific temporary caches. If the root cache remains a
  non-ignored generated artifact, add exactly this ignore rule to `.gitignore`:

  ```gitignore
  .mypy_cache/
  ```

  Re-run `git status --short` and confirm no generated cache is proposed for
  release.

### Task 2: Complete read-only deployment and remote discovery

**Files:**

- Inspect: `.git/config`, `docs/deployment-decision.md`,
  `docs/release-governance.md`, `infra/compose.production.yaml`
- Modify: none during discovery

**Interfaces:**

- Consumes: authenticated CLI state and non-secret repository metadata.
- Produces: a factual deployment-availability record; it grants no authority to
  provision, deploy, or spend.

- [ ] **Step 1: Confirm live repository state without mutation**

  Run `git remote -v`, `git branch -avv`, `gh auth status`, and inspect the
  public GitHub repository and Actions status.

  Expected: remote default remains `codex/initial-build`; the current release
  branch is local until pushed; invalid GitHub CLI authentication is recorded
  without printing tokens.

- [ ] **Step 2: Inspect existing Fly authentication and applications read-only**

  Run only identity/list/status commands. Do not create an app, allocate an IP,
  set a secret, deploy, or alter billing.

  Expected: either an existing explicitly CodeLift-authorized target is found,
  or deployment is recorded as unavailable pending operator action.

- [ ] **Step 3: Evaluate required production inputs**

  Compare discovered metadata with the required host/region, exact HTTPS
  origin, managed Mongo replica set, backup RPO/RTO, restore target, secret
  injection, private routing, alerts, owners, and spend approval.

  Expected: absence of any item blocks deployment but does not block source
  verification.

### Task 3: Audit production configuration, topology, and container contracts

**Files:**

- Modify only on reproduced failure: production configuration/topology files
  listed in the file map.
- Test: `apps/api/src/test/config.test.ts`,
  `apps/api/src/test/app.integration.test.ts`,
  `infra/scripts/mvp-source-check.mjs`

**Interfaces:**

- Consumes: environment variables and immutable image references.
- Produces: a fail-closed private-pilot configuration and vendor-neutral
  production topology exposing only the web ingress.

- [ ] **Step 1: Review the candidate diff against ADR 0008**

  Confirm HTTPS-only production origin, bounded proxy hops, required Mongo,
  invite-only registration, mock AI, disabled external AI/agents, private API,
  optional Python, omitted PostgreSQL, idempotent compiled seed, non-root
  runtime, readiness, cache policy, and no public source maps.

- [ ] **Step 2: Run the focused configuration tests**

  ```bash
  pnpm --filter @codelift/api exec vitest run src/test/config.test.ts
  ```

  Expected: production rejects missing/HTTP origin, optional persistence,
  missing Mongo, open registration, and incomplete external-provider setup.

- [ ] **Step 3: Run the source contract and Compose configuration gates**

  ```bash
  pnpm mvp:check
  pnpm compose:check
  ```

  Expected: immutable artifacts match the baseline; local and production
  Compose contracts parse; source check explicitly reports `hostedClaims:
false`.

- [ ] **Step 4: Repair only reproduced contract failures**

  Invoke systematic debugging and TDD before editing. Add the failing case to
  `apps/api/src/test/config.test.ts` or the structural assertion to
  `infra/scripts/mvp-source-check.mjs`, prove red, implement the smallest
  correction, then rerun Steps 2–3.

### Task 4: Audit invitation, recovery, session, export, and deletion boundaries

**Files:**

- Modify only on reproduced failure: access/lifecycle files in the file map.
- Test: `packages/contracts/test/contracts.test.ts`,
  `apps/api/src/test/m2.mongo.integration.test.ts`,
  `apps/web/src/test/account-flow.test.tsx`

**Interfaces:**

- Consumes: CSRF-protected browser input, one-time opaque access tokens, and an
  authenticated tenant identity.
- Produces: replay-safe invitation/reset transitions, tenant-scoped export, and
  transactional deletion with all-session invalidation.

- [ ] **Step 1: Start the local Mongo replica set and verify readiness**

  ```bash
  docker compose -f infra/compose.m2.yaml up -d --wait
  ```

  Expected: replica-set Mongo is healthy on the documented local test URI.

- [ ] **Step 2: Run contract and account component-flow tests**

  ```bash
  pnpm --filter @codelift/contracts test
  pnpm --filter @codelift/web exec vitest run src/test/account-flow.test.tsx
  ```

  Expected: register/reset/export UI contracts parse; URL tokens are removed
  from rendered browser history; failure and success states are honest.

- [ ] **Step 3: Run real-Mongo access and lifecycle integration tests**

  ```bash
  pnpm test:integration
  ```

  Expected: invitation email binding, expiry, revoke, single-use, replay and
  concurrency; password-reset expiry/single-use/all-session revocation; generic
  failures; CSRF/origin enforcement; export tenant scope/secret exclusion; and
  complete source/derived deletion all pass.

- [ ] **Step 4: Inspect query-bound authorization and transaction use**

  Confirm every user-owned query includes `userId`, invitation consumption and
  user creation share one transaction, reset consumption/password replacement/
  session revocation share one transaction, and account deletion still covers
  newly added records.

- [ ] **Step 5: Repair only reproduced lifecycle defects**

  Add the smallest failing regression to the relevant contract, integration,
  or component-flow file; prove red; repair the service/query/UI boundary;
  rerun the focused test and full `pnpm test:integration`.

### Task 5: Audit privacy-minimized errors, logs, and pilot metrics

**Files:**

- Modify only on reproduced failure: observability/metrics files in the file
  map.
- Test: `apps/api/src/test/app.integration.test.ts`,
  `apps/api/src/test/m2.mongo.integration.test.ts`

**Interfaces:**

- Consumes: Express request metadata and aggregate Mongo records.
- Produces: normalized bounded operational events and cohort-suppressed metrics
  with no identity or private-content dimension.

- [ ] **Step 1: Inspect logging fields and route normalization**

  Confirm request and server-error events contain only request ID, method,
  normalized route, status, duration, and bounded error class. Confirm query,
  raw URL, body, email, token, cookie, note, evidence, reflection, prompt,
  response, and database URI are absent.

- [ ] **Step 2: Run focused HTTP/error and metrics tests**

  ```bash
  pnpm --filter @codelift/api exec vitest run src/test/app.integration.test.ts
  pnpm test:integration
  ```

  Expected: normalized logs correlate with RFC-style request IDs, unexpected
  errors remain generic, cohorts below five are suppressed, and unsuppressed
  output contains aggregates only.

- [ ] **Step 3: Exercise the metrics CLI against synthetic test data**

  Use the local replica-set URI and a synthetic bounded date window. Verify
  human and `--json` output, minimum cohort enforcement, Core/Recovery
  separation, zero per-user rows, and zero private content.

- [ ] **Step 4: Repair only reproduced observability/privacy defects**

  Write a failing integration assertion before changing production code, then
  rerun both focused suites and inspect captured output for prohibited fields.

### Task 6: Audit the Core, Recovery, supporting, and failure journeys

**Files:**

- Modify only on reproduced failure: account/workspace API and UI boundaries.
- Test: `apps/web/src/test/workspace-flow.test.tsx`,
  `apps/web/src/test/workspace-surfaces.test.tsx`,
  `e2e/codelift-journeys.spec.ts`

**Interfaces:**

- Consumes: isolated invite/open-mode synthetic accounts through normal UI and
  HTTP contracts.
- Produces: persisted honest Core and Recovery journeys plus functioning
  supporting learning surfaces.

- [ ] **Step 1: Run all component and domain tests**

  ```bash
  pnpm test
  pnpm test:component-flow
  ```

  Expected: strict domain state transitions, tasks/time, evidence/reflection,
  roadmap/reviews/skills/portfolio, RAG, coach, planner, evals, gallery,
  settings, and deletion tests pass.

- [ ] **Step 2: Run the real-Mongo Chromium journey suite**

  ```bash
  pnpm exec playwright test --project=chromium
  ```

  Expected: first-use Core journey, isolated Recovery journey, reload/logout/
  login persistence, supporting surfaces, cross-user denial, RAG abstention,
  AI fallback, direct routes, protected refresh, and honest failures pass with
  no uncaught browser errors.

- [ ] **Step 3: Validate Recovery semantics against authoritative state**

  Confirm the database status remains `recovery_completed`, Recovery earns only
  the approved Recovery reward, UI/roadmap/export never relabel it Core, and
  Today selects the next incomplete day according to the existing approved
  domain behavior.

- [ ] **Step 4: Rehearse representative service failures**

  Exercise unavailable API, unavailable Python, invalid/expired session,
  CSRF/origin rejection, invalid input, abstaining RAG, and deterministic AI
  fallback. Confirm no failed write renders completion or saved state.

- [ ] **Step 5: Repair only P0/P1 or release-critical journey defects**

  Invoke systematic debugging and TDD. Keep large components intact unless the
  demonstrated root cause cannot be corrected safely without a narrowly scoped
  extraction.

### Task 7: Perform real-browser accessibility and responsive review

**Files:**

- Modify only on reproduced failure: web components/styles and browser tests.
- Evidence: `docs/quality/release-manual.json`,
  `docs/quality/screenshots/release-*.png`

**Interfaces:**

- Consumes: the real local web/API/Mongo stack and isolated synthetic users.
- Produces: source-digest-bound browser evidence at desktop, mobile, dark, and
  reduced-motion states.

- [ ] **Step 1: Load the frontend testing/debugging workflow**

  Read and follow the applicable skill before browser testing or UI repair.

- [ ] **Step 2: Run automated Chromium axe and mobile WebKit journeys**

  ```bash
  pnpm test:e2e
  ```

  Expected: critical-flow axe scans and the invite/cookie/Today WebKit mobile
  journey pass without critical/serious violations or raw tokens.

- [ ] **Step 3: Inspect the real UI at 1440, 390, and exact 320 pixels**

  Verify keyboard order, skip link, visible focus, landmarks/headings, labels,
  error association, non-color cues, dark mode, reduced motion, long content,
  loading/empty/failure/Core/Recovery/completion states, console errors, and
  failed requests. Scrutinize Today’s primary action and hierarchy.

- [ ] **Step 4: Repair only critical accessibility/responsive or P1 clarity defects**

  Add an axe, Playwright, or React Testing Library regression first; prove red;
  make the smallest semantic/style/copy correction; rerun the focused browser
  test and affected component suite.

- [ ] **Step 5: Regenerate source-bound manual evidence**

  Capture synthetic-data-only screenshots, update
  `docs/quality/release-manual.json` with the current reviewed source digest,
  observed viewports/themes/motion/keyboard states, console/network result, and
  issues list, then run:

  ```bash
  pnpm browser:evidence
  ```

  Expected: evidence freshness and required page/state coverage pass.

### Task 8: Run the standard security audit and supply-chain gates

**Files:**

- Modify only on validated finding: the narrow affected boundary and its
  regression test.
- Evidence: ignored reports under `reports/`

**Interfaces:**

- Consumes: source, lockfiles, production dependency graphs, and built images.
- Produces: evidence of zero critical findings and no silent waiver.

- [ ] **Step 1: Load and follow the standard repository security-scan workflow**

  Scope the scan to the whole release candidate, preserve the accepted threat
  model, and do not use exploitative actions against external systems.

- [ ] **Step 2: Run static structural and negative-control checks**

  ```bash
  pnpm security:check
  ```

  Expected: no secret/browser bypass/unsafe structure finding; scanner negative
  controls pass.

- [ ] **Step 3: Audit locked JavaScript and Python dependencies**

  ```bash
  pnpm security:audit
  pnpm python:lock-check
  pnpm python:audit
  ```

  Expected: no high/critical JavaScript advisory, no strict Python audit
  finding, and no lock drift.

- [ ] **Step 4: Build and scan production images**

  ```bash
  pnpm image:audit
  ```

  Expected: API/web/Python production images run non-root, omit test/dev
  dependencies and public source maps, include required runtime artifacts, and
  have no unwaived HIGH/CRITICAL vulnerability.

- [ ] **Step 5: Validate or repair findings**

  Triage every scanner result against runtime reachability and policy. Any
  validated release finding receives a focused regression and smallest fix;
  no severity downgrade or ignore rule is added merely to pass the gate.

### Task 9: Verify curriculum, AI/RAG, planner, and MCP invariants

**Files:**

- Preserve unchanged: controlling prompt and curriculum seed.
- Modify only on reproduced runtime/tooling failure: generated/runtime code or
  its tests, never the immutable artifacts.

**Interfaces:**

- Consumes: immutable curriculum, deterministic providers, local eval dataset,
  and public MCP allowlist.
- Produces: verified 365-day runtime, zero-cost deterministic behavior, and
  bounded proposal-only agency.

- [ ] **Step 1: Run curriculum source and runtime validators**

  ```bash
  pnpm curriculum:preflight
  pnpm curriculum:validate
  pnpm seed
  pnpm seed
  pnpm seed:validate
  ```

  Expected: exactly 365 sequential days, correct 52-week-plus-Day-365 shape,
  30-minute Core schedules, valid Recovery/resources/prerequisites, and an
  idempotent global seed.

- [ ] **Step 2: Run the bounded live resource check**

  ```bash
  pnpm curriculum:links
  ```

  Expected: no malformed/missing/unreachable static integrity failure;
  transient results remain `unknown` and never mutate the source artifact.

- [ ] **Step 3: Run AI/RAG and MCP behavioral gates**

  ```bash
  pnpm eval:local
  pnpm mcp:check
  ```

  Expected: all local cases pass with score 1.0, zero critical failures,
  passing negative controls, zero external network/model downloads, zero
  provider cost, RAG citations or abstention, proposal-only planner behavior,
  and the exact read-only public MCP allowlist.

- [ ] **Step 4: Reconfirm immutable hashes and diffs**

  ```bash
  shasum -a 256 codelift_ai_codex_master_prompt_v2_2026.md codelift_ai_curriculum_seed_v2_2026.json
  git diff 424de51004e08e7e6b115b72e61519c35388f040 -- codelift_ai_codex_master_prompt_v2_2026.md codelift_ai_curriculum_seed_v2_2026.json
  ```

  Expected: the declared hashes and an empty diff.

### Task 10: Verify build, performance, Compose runtime, restart persistence, and deletion

**Files:**

- Modify only on reproduced failure: Dockerfiles, Compose, nginx, build/budget
  scripts, or corresponding tests.
- Evidence: ignored bundle and Compose reports.

**Interfaces:**

- Consumes: locked source and local Docker daemon.
- Produces: production images and a fresh-volume local release rehearsal.

- [ ] **Step 1: Run the production build and bundle budget**

  ```bash
  pnpm build
  pnpm performance:check
  ```

  Expected: strict production build passes, no public source map exists, and
  compressed browser JavaScript remains within the 204,800-byte cap.

- [ ] **Step 2: Run Compose configuration and fresh-volume smoke**

  ```bash
  pnpm compose:check
  pnpm compose:smoke
  ```

  Expected: four release images build, Mongo initializes as a replica set, seed
  is idempotent, API/web become ready, Python mock works, stopping Python causes
  deterministic fallback without losing readiness, persisted data survives
  service restart, and the synthetic account is transactionally deleted.

- [ ] **Step 3: Inspect bounded container logs**

  Confirm no secret, database URI, token, cookie, email, note, evidence,
  reflection, prompt, or model response appears. Confirm health and readiness
  are distinct and failure states are honest.

- [ ] **Step 4: Repair only reproduced runtime failures**

  Add a focused smoke assertion or lower-layer regression before changing the
  runtime contract; rerun the failed build/smoke and the affected source suite.

### Task 11: Reconcile release documentation and create the clean candidate commit

**Files:**

- Modify: release-truth documentation listed in the file map and only evidence
  files invalidated by current source.
- Inspect: every changed and untracked path against the snapshot.

**Interfaces:**

- Consumes: measured focused-test, browser, security, curriculum, and runtime
  evidence.
- Produces: one clean reviewable M16 candidate commit plus any separate focused
  defect-fix commits created during earlier tasks.

- [ ] **Step 1: Reconcile documentation with measured truth**

  Update status, commands, results, risks, identity, production boundary,
  post-MVP debt, and exact operator actions. Remove stale claims and avoid
  representing an ignored/generated report as checked-in proof.

- [ ] **Step 2: Run formatting, lint, type, unit, integration, browser, and build gates**

  ```bash
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:integration
  pnpm test:e2e
  pnpm build
  ```

  Expected: every command passes on the complete candidate.

- [ ] **Step 3: Review the complete release diff**

  Run `git diff --check`, `git status --short`, `git diff --stat`, targeted
  diffs for every trust boundary, and a secret-safe filename/source scan.
  Confirm no generated cache, local environment, report, test user, or
  credential file is staged.

- [ ] **Step 4: Stage the audited M16 candidate intentionally**

  Stage only the reviewed release paths. Inspect `git diff --cached --stat`,
  `git diff --cached --name-status`, and sensitive boundary hunks before
  committing.

- [ ] **Step 5: Commit the candidate**

  ```bash
  git commit -m "feat: harden private-pilot MVP release"
  ```

  Expected: the working tree is clean apart from ignored generated evidence.

### Task 12: Run exact-revision clean-clone and aggregate release gates

**Files:**

- Evidence only: ignored `reports/*.json`
- Modify source only when a gate identifies a root-cause defect.

**Interfaces:**

- Consumes: the clean committed candidate revision.
- Produces: source-, clone-, browser-, container-, and toolchain-bound release
  evidence naming that exact revision.

- [ ] **Step 1: Confirm the release input is clean**

  ```bash
  git status --porcelain
  git rev-parse HEAD
  ```

  Expected: no output from status and one candidate SHA recorded for the gate.

- [ ] **Step 2: Run isolated fresh-clone verification**

  ```bash
  pnpm fresh-clone:check
  ```

  Expected: no-hardlink clone, offline frozen JavaScript install, locked Python
  3.12 dev install, build/tests/curriculum validation, and fresh-volume runtime
  smoke pass at the exact candidate SHA.

- [ ] **Step 3: Run the authoritative aggregate suite**

  ```bash
  pnpm quality:report
  ```

  Expected: score at least 95, zero failed commands, zero critical failures,
  clean source at both ends, and all report/artifact revision/digest freshness
  checks pass.

- [ ] **Step 4: Repair aggregate failures without papering over evidence**

  For each failure, reproduce with its focused command, invoke systematic
  debugging/TDD, commit the smallest correction, and restart Task 12 from Step
  1 on the new clean SHA. An old passing command does not carry over to a new
  revision.

- [ ] **Step 5: Load verification-before-completion workflow**

  Independently inspect the final report fields, current `git status`, commit
  SHA, hashes, and high-risk command outputs before making any completion claim.

### Task 13: Push the verified branch, create the draft PR if authorized, and verify CI

**Files:**

- Modify: no source files unless exact-SHA CI exposes a reproducible defect.

**Interfaces:**

- Consumes: locally verified clean commit and existing Git credentials.
- Produces: a remote release branch, draft PR when authenticated, and passing
  CI at the same SHA.

- [ ] **Step 1: Reconfirm remote and branch targets**

  Confirm `origin`, remote default `codex/initial-build`, no unexpected
  divergence, and no remote branch overwrite.

- [ ] **Step 2: Push without force**

  ```bash
  git push -u origin codex/mvp-launch-readiness
  ```

  Expected: the exact locally verified SHA exists on the remote release branch.

- [ ] **Step 3: Open a draft PR only if GitHub authentication is valid**

  Target `codex/initial-build`. Include scope, exact SHA, quality evidence,
  identity decision, production blocker, and residual risks. Do not change the
  default branch or protections.

- [ ] **Step 4: Verify GitHub Actions on the exact SHA**

  Wait for the `quality` workflow. Expected: release-quality succeeds and its
  uploaded report identifies the same SHA. If CI fails, diagnose, fix, commit,
  rerun local aggregate verification, push, and recheck the new SHA.

### Task 14: Conditionally deploy the verified revision and perform live production verification

**Files:**

- Evidence only: redacted operator/live records outside source unless the
  repository already defines a safe tracked record.

**Interfaces:**

- Consumes: exact verified commit and a fully authorized existing production
  environment.
- Produces: either hosted Full MVP evidence or exact deployment-pending operator
  actions.

- [ ] **Step 1: Apply the deployment authorization gate**

  Proceed only when the existing environment has explicit host/region/domain/
  spend approval, immutable image deployment, managed Mongo replica set,
  secret injection, private routing, readiness rollout, limits, logs/alerts,
  owners, backup policy, and isolated restore target. Otherwise skip deployment
  and record every missing operator action.

- [ ] **Step 2: Deploy only the verified commit**

  Confirm image labels/digests and platform release metadata name the exact
  source SHA. Never deploy the dirty starting snapshot or an intermediate
  commit.

- [ ] **Step 3: Run the guarded HTTPS live check**

  Issue a one-time synthetic invitation through an access-controlled operator
  channel, then run `pnpm mvp:live-check` with locally supplied credentials and
  cleanup guard. Expected: TLS, headers, caching, health/readiness, invite-only
  mock configuration, secure cookie, onboarding, Today, persisted Recovery
  write, logout/login, export, and deletion pass.

- [ ] **Step 4: Verify restart persistence, logs, alerting, and backup restore**

  Perform a safe application-service restart/redeploy, confirm Mongo-backed
  persistence, inspect bounded logs, trigger the approved test alert, restore a
  backup into an isolated target, verify the accepted RPO/RTO, and confirm
  deleted synthetic accounts are not silently reactivated.

- [ ] **Step 5: Apply the verdict boundary**

  Hosted checks all pass: production may receive the production score and be
  considered for `FULL_MVP_PASS`. Any unavailable hosted control:
  `SOURCE_MVP_COMPLETE_DEPLOYMENT_PENDING`; localhost/Compose evidence cannot
  fill the gap.

### Task 15: Produce the final release assessment and handoff

**Files:**

- Modify only if measured truth still contradicts release documentation.
- Read: final ignored reports, Git history/status, CI, and any redacted live
  evidence.

**Interfaces:**

- Consumes: all exact-revision local, CI, and conditional hosted evidence.
- Produces: the required final verdict and operator handoff.

- [ ] **Step 1: Score all nine requested categories from current evidence**

  Use 20/15/10/15/10/10/10/5/5 weighting. Do not award hosted-production
  points for local rehearsal.

- [ ] **Step 2: Classify remaining items**

  Separate blockers, P1 items, and post-MVP debt. Confirm no P0 or unresolved
  core-journey P1 is hidden inside the backlog.

- [ ] **Step 3: Report the exact release identity**

  Include branch, final commit SHA, tag only if legitimately created, verified
  production URL only if live-tested, and the CodeLift AI/CodePilot identity
  distinction.

- [ ] **Step 4: Report journeys, production verification, commands, and score**

  Name the journeys actually executed, exact final commands/results, CI status,
  production checks actually performed, and anything not performed.

- [ ] **Step 5: Emit exactly one permitted verdict**

  Choose `FULL_MVP_PASS`, `SOURCE_MVP_COMPLETE_DEPLOYMENT_PENDING`, or
  `MVP_BLOCKED` according to the design truth table. Stop implementing once the
  verdict is fully evidenced.
