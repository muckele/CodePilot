# M16 Full MVP Launch Readiness Design

## Status and authority

This design records the evidence-first M16 execution approved on 2026-09-01.
It implements the supplied “M16 Full MVP Launch Readiness and Production
Release” request without expanding the frozen product scope.

Repository instructions in `AGENTS.md`, the controlling product specification
in `codelift_ai_codex_master_prompt_v2_2026.md`, the immutable curriculum in
`codelift_ai_curriculum_seed_v2_2026.json`, and accepted ADRs remain
authoritative. This design resolves execution choices that those sources leave
open; it does not replace them.

## Objective

Convert the existing locally implemented CodeLift AI release candidate into the
strongest defensible Full MVP release state by:

1. preserving and auditing the existing uncommitted M16 candidate;
2. reproducing and repairing only demonstrated launch defects or release-gate
   failures;
3. verifying the real learner journeys, failure behavior, accessibility,
   security, persistence, curriculum integrity, and operational contract;
4. generating release evidence from the exact clean final revision;
5. deploying that verified revision only when an already authorized production
   environment and every required credential and operational control exist; and
6. reporting a truthful verdict when hosted verification remains externally
   blocked.

## Starting state and recovery boundary

The starting branch is `codex/mvp-launch-readiness` at commit
`424de51004e08e7e6b115b72e61519c35388f040`. The branch began this execution
with a substantial uncommitted M16 candidate: 45 tracked files changed, 2,189
tracked additions, 147 tracked deletions, and 19 non-ignored untracked paths.

Before any repository edit, the exact non-ignored state was captured at:

`/private/tmp/codelift-m16-start.hk9ITF`

That private, permission-restricted snapshot contains:

- base commit and branch;
- porcelain-v2 Git status;
- tracked diff statistics;
- a full-index binary patch of tracked modifications;
- a path inventory and compressed archive of non-ignored untracked files;
- recovery instructions; and
- verified SHA-256 digests.

Ignored environment and credential files are not included. Existing M16 work
must be reviewed in place and must not be reset, overwritten wholesale, or
silently discarded.

## Identity decision

**CodeLift AI is the product name. CodePilot is the repository/project name.**

Evidence:

- the controlling specification explicitly names the application CodeLift AI;
- current UI, package scopes, architecture, documentation, and immutable source
  artifacts consistently use CodeLift/CodeLift AI; and
- the GitHub repository is named CodePilot without a newer authoritative
  product-renaming decision.

The release documentation may explain the distinction. Historical and
immutable source artifacts must not be renamed or rewritten. A speculative
global search-and-replace is prohibited.

## Scope and feature freeze

### In scope

- validation and repair of the core learner journey;
- validation and repair of existing supporting MVP surfaces;
- authentication, authorization, privacy, persistence, deletion, and
  curriculum-integrity defects;
- production configuration, container, readiness, logging, backup guidance,
  release tooling, and deployment defects;
- P0/P1 UX, accessibility, responsive-layout, reliability, and honest-failure
  defects;
- exact-revision automated and manual release evidence; and
- documentation corrections required to describe measured release truth.

### Out of scope

- new product capabilities, providers, model features, RAG features, vector
  infrastructure, social features, notifications, gamification, payments,
  organizations, admin functionality, or autonomous writes;
- speculative refactors of `AccountExperience.tsx`, `WorkspaceExperience.tsx`,
  the learning service, or other large files;
- PostgreSQL as a production dependency;
- a new design system, SSR, Kubernetes, new microservices, or speculative scale
  infrastructure; and
- any P2 polish that does not materially affect launch safety or the core
  learner experience.

Non-blocking findings are recorded in a short post-MVP backlog rather than
implemented.

## Runtime architecture and production contract

The accepted runtime boundary remains:

```text
Browser
  -> HTTPS web ingress
     -> private Node/Express policy boundary
        -> managed MongoDB replica set (authoritative product state)
        -> optional private Python service (safe degradation only)
```

The browser calls only Node. Node owns authentication, authorization, CSRF,
tenant scope, validation, product state transitions, provider consent, and
public response contracts. MongoDB remains the product database and must
provide transaction-capable replica-set behavior. Python remains stateless,
internal, optional, and unable to make readiness or the learner journey depend
on its availability. PostgreSQL remains an optional curriculum lab.

The private-pilot production profile must enforce:

- exact HTTPS `WEB_ORIGIN`;
- the exact trusted ingress count in `TRUST_PROXY_HOPS`;
- secure `__Host-` HTTP-only session cookies;
- `PERSISTENCE_MODE=required` and a managed Mongo replica-set URI;
- invite-only registration;
- deterministic mock AI;
- external AI and agent execution disabled;
- server-side secret injection;
- idempotent seed as a release operation;
- readiness-based rollout;
- public exposure of only the web ingress; and
- bounded privacy-minimized logs without request bodies, query tokens, private
  learning content, or secrets.

No production contract may be weakened to accommodate the local shell,
Corepack sandbox, Docker permissions, or unavailable credentials.

## Candidate-audit method

The existing M16 working tree is an unverified candidate, not accepted source.
Audit it by behavioral boundary rather than assuming that documentation or test
names prove correctness.

For every demonstrated defect:

1. reproduce the behavior;
2. classify P0, P1, P2, security/reliability, or release-gate impact;
3. identify the root cause;
4. write or identify a focused failing regression test;
5. implement the smallest correction;
6. run the focused test;
7. run the affected broader suite;
8. inspect the real UI when user-facing; and
9. commit a coherent reviewable change.

Tests are never weakened to accept a defect. Unrelated cleanup is excluded.

## Product-journey verification

Use isolated synthetic users and the real local stack through normal browser
and API boundaries.

### Core journey

Verify:

```text
register through the configured policy
-> login/session establishment
-> onboarding
-> Today and the correct next incomplete day
-> create/use a task and record actual time
-> start Core
-> save evidence
-> save reflection
-> complete Core
-> reload
-> log out
-> log in
-> confirm authoritative persisted progress
-> inspect roadmap, reviews, skills, portfolio, and supporting surfaces
```

No calendar gap may auto-skip curriculum, no failed mutation may display
success, and completion must require valid persisted evidence and reflection.

### Recovery journey

Use a separate account/state. Verify Recovery prerequisites, evidence,
reflection, completion, XP/reward, display labels, resume behavior, and the
approved next-day selection semantics. The persisted status and all UI copy
must remain `recovery_completed`; nothing may claim that Core was completed.

### Supporting surfaces

Verify Today, Tasks, Roadmap, Reviews, Skills, Portfolio, Error Museum,
private-note search/RAG, zero-cost AI Coach, bounded proposal-only Planner,
Evals, Gallery, account settings/export, and deletion. Repair only defects that
materially affect MVP value, privacy, reliability, or release gates.

### Failure journeys

Verify honest behavior for:

- Node/API unavailability;
- optional Python unavailability;
- invalid or expired session;
- missing or invalid CSRF/origin;
- invalid user input;
- RAG abstention or missing support;
- deterministic AI fallback;
- cross-user resource access;
- direct SPA routes and protected-route refresh; and
- persistence/readiness failure.

## UX, accessibility, and responsive verification

Exercise the real browser at approximately 1440 px, 390 px, and exact 320 px.
Cover keyboard-only navigation, visible focus, skip links, headings and
landmarks, labels and descriptions, error association, non-color status cues,
dark mode, reduced motion, long content, loading/empty/failure/completion and
Recovery states, console errors, and failed network requests.

Automated axe coverage supplements, but does not replace, browser inspection.
Today receives the highest scrutiny. Only the smallest demonstrated P0/P1
clarity correction is permitted; this milestone does not redesign the product.

## Security and privacy verification

The release audit covers:

- production configuration fail-closed behavior;
- Argon2id credential handling and generic authentication failures;
- opaque session rotation/revocation, cookie attributes, and session expiry;
- exact-origin CSRF and CORS defense in depth;
- invitation and password-reset hashing, expiry, revocation, replay, races,
  email binding, and all-session reset revocation;
- query-bound tenant authorization and cross-user isolation;
- account export tenant scope and exclusion of credential/session/token/hash
  material;
- transactional deletion of source and derived records;
- RAG citation, abstention, prompt-injection, and deletion boundaries;
- provider consent, schema validation, timeout, retry, kill switch, fallback,
  and zero external calls in the default path;
- planner proposal-only, approval, budget, idempotency, and tool allowlist
  behavior;
- privacy-minimized normalized logging;
- static secret and unsafe-structure checks;
- locked JavaScript and Python dependency audits;
- non-root, production-only container contents and HIGH/CRITICAL image scans;
  and
- immutable curriculum hash, exactly 365 sequential days, 30-minute Core
  schedules, resources, prerequisites, and Core/Recovery separation.

An auth bypass, cross-user leak, secret exposure, unsafe side effect, invalid
curriculum, data loss, false completion/deletion/export, or unhandled provider
outage is release-critical regardless of numeric score.

## Release evidence and Git hygiene

The candidate is converted into coherent reviewable commits without rewriting
history. No force push, destructive reset, or incidental default-branch change
is permitted. Generated reports remain outside tracked release source unless
the repository explicitly treats a manual evidence artifact as tracked.

The exact clean final revision must pass the repository’s authoritative gates,
including its aggregate `pnpm quality:report`. Focused tests run after repairs;
affected suites run before commits; the full aggregate suite runs only after
the release revision is clean and reviewable. Final reports must name that
exact revision and reject stale source, browser, clone, or container evidence.

If authentication permits, push the release branch and open a draft pull
request against the actual remote default branch. Required CI must pass at the
same head SHA. Creating or switching the GitHub default branch is an
operator-owned action unless separately authorized.

## Conditional production deployment

Deployment discovery may run while source verification proceeds, but a
production release may not deploy until:

1. the candidate is a clean reviewable commit;
2. required source/release gates pass for that exact revision; and
3. an already authorized production target supplies every required input.

Discovery may inspect authenticated tooling and existing non-secret metadata.
It must not print credentials or create paid resources.

Production requires an approved host and region, domain and exact HTTPS origin,
managed Mongo replica set, accepted backup RPO/RTO, secret injection, private
routing, readiness rollout, resource limits, centralized logs and alert owner,
release/incident/data owners, and a billing/spend decision. No host, domain,
database, or other billable service may be created or purchased without
explicit authorization.

When the environment exists, deploy the verified revision—not a dirty or
intermediate tree—and verify HTTPS, health/readiness, secure cookies, invite
registration, onboarding, Today, a persisted write, reload/logout/login,
deterministic fallback, protected routes, persistence across a safe service
restart/redeploy, synthetic account deletion, bounded logs, and an isolated
backup/restore drill.

Localhost, local Compose, and container rehearsal are source/runtime evidence,
not production deployment evidence.

## Verdict rules

| Verdict                                  | Required evidence                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FULL_MVP_PASS`                          | Score at least 95/100, zero critical/P0/core-journey P1 failures, all exact-revision source gates and CI pass, and the hosted HTTPS deployment plus backup/restore and live journey are verified.         |
| `SOURCE_MVP_COMPLETE_DEPLOYMENT_PENDING` | All source and local runtime gates pass with no source blocker, but one or more required hosted environment, credential, owner, alert, backup/restore, or live-smoke gates remain externally unavailable. |
| `MVP_BLOCKED`                            | A required source, security, data-integrity, curriculum, core-journey, or release-quality gate remains unresolved.                                                                                        |

A score over 95 never overrides a missing hosted-production gate. No MVP tag is
created until `FULL_MVP_PASS` is proven. If deployment remains external, the
final report supplies exact operator actions and uses
`SOURCE_MVP_COMPLETE_DEPLOYMENT_PENDING`.

## Release assessment

The final assessment uses the requested 100-point scale:

- Core learner journey — 20
- Persistence/auth/security — 15
- Curriculum integrity — 10
- Real-user UX/accessibility — 15
- Reliability/failure handling — 10
- AI/RAG mock-first behavior — 10
- Production deployment/operations — 10
- Test/release evidence — 5
- Documentation/portfolio readiness — 5

Each score must cite current measured evidence. Hosted-production points and a
Full MVP verdict are withheld when hosted verification is absent.

## Completion boundary

Stop implementing when the applicable verdict is fully evidenced. Preserve the
feature freeze, record non-blocking ideas as post-MVP debt, update only release-
truth documentation, and report blockers, P1 items, and post-MVP debt
separately.
