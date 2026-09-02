# CodeLift AI build plan

## Status

- Current milestone: **M16 — private-pilot MVP launch readiness**
- State: **candidate repaired and reviewed; one required automated WebKit release
  gate remains red; exact-revision evidence decides the release verdict** on
  `codex/mvp-launch-readiness` from verified baseline
  `424de51004e08e7e6b115b72e61519c35388f040`
- Updated: 2026-09-02 (America/Los_Angeles)
- Passing threshold: 95/100 with zero critical failures

## User value

A returning full-stack developer can register, build a realistic 365-day plan,
continue the next incomplete 30-minute mission, choose honest Recovery, save
evidence/reflections/tasks, review and demonstrate skills, grow a portfolio,
search private notes with citations, use a mock-first coach, and approve a
bounded weekly plan without a paid API or model download.

## Completed vertical slices

1. strict monorepo/contracts and immutable curriculum source preflight;
2. secure account, onboarding, Mongo sessions, progress, evidence, reflection,
   resume, and transactional deletion;
3. display-ready 365-day enrichment, global seed, link maintenance, and runtime
   validation;
4. Today mission, FocusOrb, Core/Recovery/Stretch, nested knowledge checks,
   scratch, persisted tasks/time/reschedule, and false-success handling;
5. roadmap, catch-up, reviews, momentum, skills, achievements, periodic
   reflections, and signature visual systems;
6. portfolio/career evidence and Error Museum;
7. typed FastAPI/Pydantic, pandas/scikit-learn baseline, protocols, mocks,
   containers, and PostgreSQL lab;
8. provider-neutral structured AI Coach with consent, timeout/retry, kill
   switch, trace, and deterministic fallback;
9. tenant-scoped note ingestion, hybrid retrieval, citations, support labels,
   abstention, versioning, and deletion;
10. operations/evals/security controls and a 38-case executable local dataset;
11. optional local inference/PEFT learning boundary;
12. bounded approval-gated planning and read-only MCP demo;
13. Compose/CI, architecture, ADRs, runbooks, curriculum, deployment, and
    portfolio documentation.

## Final acceptance checks

- fresh locked install plus Python 3.12 dev install;
- Compose configuration and production images;
- format, lint, typecheck, unit, real-Mongo integration, browser, and build;
- idempotent seed/validation and 365-day runtime validation;
- bounded live resource report;
- local AI eval, MCP, static security, dependency audit, and bundle budget;
- wide/320px, light/dark, reduced-motion, keyboard, error, citation,
  approval, and deletion browser evidence;
- machine-readable score ≥95 with zero critical failures.

## Security and privacy implications

The browser calls only Node. External AI requires server enablement, profile
opt-in, per-request consent, and a disabled kill switch. Every user-owned query
is scoped, private inputs are hashed in traces, model output is runtime parsed,
the planner is read-only until approval, and account deletion cascades product
and derived/index state in one transaction.

## Test/eval plan

- domain: date mapping, streak/momentum, review scheduling, chunking/scoring,
  catch-up, planner bounds, provider schema/fallback/kill switch;
- contracts/curriculum: strict boundaries, 365 invariants, display enrichment,
  resource fidelity, task/reflection/career inputs;
- Node: auth/CSRF/session, isolation, Core/Recovery, replay safety, tasks,
  retrospectives, career, RAG, coach, planning, eval, deletion;
- Python: health, analysis, ML schema/safeguards, provider protocols/mocks,
  embeddings, reranking, local/PEFT no-download behavior;
- browser: critical private journey and accessibility/responsive states;
- local eval/security: 38 behavioral AI/RAG/privacy/agency cases with failing
  negative controls, plus static structural and dependency security checks.

## M15 baseline checkpoint evidence (not M16 release evidence)

These historical measurements were regenerated on 2026-08-10 by
`pnpm quality:report` from clean baseline revision
`424de51004e08e7e6b115b72e61519c35388f040`. They describe the prior M15
checkpoint only. The ignored reports have not yet been regenerated for the M16
candidate and cannot support an M16 release claim.

| Check                             | Current measured result                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| pinned toolchain                  | Node 24.14.0; pnpm 11.9.0                                            |
| frozen offline install            | passed for all 8 workspace projects                                  |
| format / lint / strict typecheck  | passed, including Ruff and strict mypy                               |
| root unit/service suite           | passed: web 45, API 39, curriculum 14, Python 11, packages 23        |
| real-Mongo integration            | passed: 27/27 across public and private boundaries                   |
| Playwright browser journeys       | passed: 10/10 in Chromium, including visual/accessibility evidence   |
| source-bound browser evidence     | passed: 11 required + 3 additional pages; four current screenshots   |
| curriculum runtime validation     | 365 days; 7,046 semantic fields; zero failures or duplicate groups   |
| bounded live curriculum links     | 87/87 reachable; zero unknown/unreachable; 841 day references        |
| local behavioral AI eval          | 38/38; score 1.0; zero critical; zero external calls/downloads; $0   |
| MCP / static security             | exact 3-tool public allowlist; zero findings/critical failures       |
| dependency audit                  | zero known vulnerabilities after patched routing/transitive releases |
| production web bundle             | 135,246 gzip bytes; within the 204,800-byte cap                      |
| fresh-volume Compose smoke        | passed: four builds, seed, Python integration, fallback, deletion    |
| isolated clean-clone verification | passed: offline frozen JS, Python 3.12 dev install, build/test/smoke |
| aggregate release quality         | passed: 100/100; zero failed commands; zero critical failures        |

Those generated reports were authoritative for the named M15 baseline only.
M16 must replace them with fresh evidence bound to its final clean commit.

## M15 baseline release gate outcome (historical)

- The isolated no-hardlink clone matched the release revision and passed its
  frozen install, Python 3.12 environment, build, tests, curriculum validation,
  and fresh-volume runtime/fallback smoke.
- Every required aggregate command passed with score 100/100 and zero critical
  failures.
- No application-source release blocker remains. Optional hosted infrastructure
  and paid/local model integrations remain documented boundaries, not
  fabricated success.

## 2026-08-10 whole-application review (historical baseline)

The full application was re-reviewed across browser privacy, HTTP boundaries,
API configuration, curriculum edge cases, Python validation, supply-chain
advisories, visual fixtures, deployment documentation, and clean-container
build behavior. The review produced no unresolved critical finding.

Remediated findings:

- browser-local mission scratch is now bounded, account-scoped, resilient to
  unavailable storage, and cleared only for the deleted account;
- local dates and IANA timezones are validated as real values in TypeScript,
  while Python parses dates at its Pydantic boundary and bounds embedding text;
- portfolio, job, evidence, and admin resource links accept HTTPS URLs without
  embedded credentials rather than generic URL schemes;
- Express trusts zero proxy hops by default, accepts only an explicit bounded
  hop count, and the included nginx topology documents and configures one hop;
- the guest CSRF bootstrap has a dedicated limiter so repeated anonymous
  requests cannot create unbounded session records;
- roadmap previews no longer duplicate Day 365, Recovery gallery evidence now
  matches the domain's +5 XP award, and both behaviors have regressions;
- the vulnerable `nanoid` transitive range is pinned to the patched 3.3.17
  release, with the frozen lockfile regenerated; and
- a fresh container build exposed and removed an unsupported Testing Library
  selector option that a warm dependency tree had masked.

Current-source evidence includes 139 passing unit/service tests, 28 passing
real-Mongo integration tests, 10 passing Chromium journeys, strict TypeScript
and mypy, clean formatting/lint, a successful production build, zero static
security findings, zero known dependency vulnerabilities, a 135,563-byte gzip
JavaScript bundle under the 204,800-byte cap, 38/38 behavioral eval cases, and
a fresh-volume Compose deployment rehearsal covering four image builds, seed,
Python availability, deterministic fallback, readiness, and account deletion.
The source-bound manual browser review covered all 14 required routes at wide
and 320px layouts, light/dark themes, reduced motion, keyboard focus, contrast,
error/empty/approval states, and deletion with zero console errors.

The clean-revision aggregate report remains the authoritative final gate and is
generated after the review commit. A live hosted deployment is intentionally
not claimed without a configured Git remote, valid GitHub authentication, a
named deployment target/domain, secret injection, TLS ingress, and a managed
Mongo replica-set/backup plan. The verified local Compose rehearsal is release
evidence, not a substitute for those operator-owned production controls.

## Risks

- third-party resource reachability changes over time; preserve `unknown`
  separately and never delete a link on one transient failure;
- local model hardware/licensing varies; the base path must remain no-download;
- hosted production infrastructure is operator-owned; Compose/build/readiness
  evidence is not a claim of a live deployment;
- browser suspension can skew elapsed wall clock, so actual minutes stay
  learner-authored.

At that M15 checkpoint, no persistent blocker survived its then-applicable
repair policy. That statement does not assess the M16 candidate.

## 2026-08-10 M16 private-pilot launch-readiness execution

Controlling release request: production-safe private-pilot configuration and
topology, invite-gated access and operator recovery, usable privacy/support/
export controls, privacy-minimized observability, reproducible supply-chain
gates, critical-flow accessibility, aggregate pilot measurement, and protected
release governance without expanding the product scope.

Initial evidence:

- repository worktree was clean at the exact stated baseline commit;
- the only remote branch and repository default branch is
  `codex/initial-build`; `main` does not yet exist;
- the connected GitHub app reported no PR-triggered workflow run or combined
  status for the baseline SHA, while the checked-in M15 report records the
  prior local 100/100 result;
- GitHub CLI authentication is invalid, so publishing through `gh` is deferred
  until repository work and clean-commit gates are complete;
- no M15 milestone file existed under `docs/milestones`; M16 will add the
  source-bound acceptance record rather than retroactively inventing M15
  evidence;
- the immutable product prompt and canonical curriculum were inspected by
  repository references only and will not be edited.

Execution evidence resumed on 2026-09-02:

- the exact pre-change candidate remains recoverable from a mode-0700 snapshot
  outside tracked release files, including starting status, diff/stat, binary
  patch, and untracked-file archive; no ignored environment file was captured;
- the approved design and implementation plan are committed separately as
  `624cb5a` and `92cee1c`; CodeLift AI remains the product name and CodePilot the
  repository/project name;
- production configuration, invitation/recovery, lifecycle, privacy-minimized
  observability, fixed-window metrics, supply-chain/container,
  browser/accessibility, and governance changes were implemented under the MVP
  feature freeze;
- the standard pre-repair security audit found seven release-relevant race,
  lifecycle, resource-bound, and provider-boundary findings. Each received a
  focused implementation correction and regression coverage. Final review also
  found and corrected request-target access-token exposure, stale-password
  login/deletion races, unsafe production AI/proxy defaults, unsupported Mongo
  topology acceptance, internal export identifiers, an interruption-wedged
  planner claim, and open-ended cohort measurement;
- post-review focused evidence passes 72/72 API unit tests, the affected
  real-Mongo account/export/metrics group 6/6, the stale-password/planner group
  4/4, API and contracts typechecking, source-contract validation, complete
  candidate formatting, and the affected Chromium fragment/accessibility
  journey. Earlier candidate evidence records the web suite at 55/55 and the
  Chromium release journeys at 11/11. The focused mobile-WebKit journey
  exposed a macOS/Vite dev-transform stall, so the test harness now serves the
  production build through Vite preview. The real mobile invited-account,
  Today, logout, re-login, and deletion interactions then reached successful
  API responses, but the automated gate remains red because authentication
  correctly honors `returnTo=/app/account` while the test still requires
  `/app/today`; the two-approach repair budget is exhausted;
- ESLint and Ruff pass, and strict mypy reports no issues in all seven Python
  source files. Host filesystem provenance scanning required the unchanged
  repository lint gate to run in an ephemeral pinned-Node container; no lint or
  version requirement was weakened;
- the operator now emits invitation and reset credentials only in URL fragments;
  the frontend scrubs the fragment after reading it, and HTML/Nginx enforce a
  no-referrer policy plus a query-free bounded access-log format;
- exact-revision reporting checks the full untracked-file inventory before any
  gate runs and again after the gates, and rejects a changed SHA or dirty source
  at either boundary;
- the immutable controlling prompt and canonical curriculum remain unchanged
  from baseline; generated caches, environment files, and ignored reports are
  excluded from the candidate; and
- the current ignored `reports/release-quality.json`, `reports/security.json`,
  and `reports/fresh-clone.json` still identify the 2026-08-10 baseline and are
  deliberately treated as stale until Task 12 regenerates them.

The next release boundary is mechanical and revision-specific: create the clean
reviewable commit, run `pnpm fresh-clone:check`, then run the authoritative
`pnpm quality:report` once for that same SHA. The report must retain the red
WebKit gate unless exact-revision execution proves otherwise; its two-approach
repair budget is exhausted and it cannot be waived by the aggregate score. The most recent
read-only remote/deployment discovery found invalid GitHub CLI authentication
and no approved hosted application, domain, managed Mongo deployment, alert
route, or restore target. No infrastructure has been purchased or provisioned.
If all source gates pass and those operator-owned inputs remain absent, the
truthful terminal status is `SOURCE_MVP_COMPLETE_DEPLOYMENT_PENDING`. If the
WebKit gate remains red, the truthful status is `MVP_BLOCKED`. Neither state is
a localhost production claim.
