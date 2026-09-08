# Milestone 16 — Private-pilot MVP launch readiness

## Outcome

M16 converts the production-shaped source candidate into an invitation-only,
mock-first MVP release candidate with explicit production configuration,
one-time operator access/recovery, policy and lifecycle controls, privacy-
minimized observability and metrics, reproducible dependency/container gates,
critical-flow browser coverage, and protected release governance.

The acceptance distinction is deliberate:

- **source-ready** means the exact clean commit passes the repository gate;
- **pilot-ready** additionally requires an approved environment, TLS/domain,
  secrets, alerts, managed backup plus isolated restore evidence, and a passing
  guarded live check;
- **public-ready** is out of scope and is not claimed.

## Acceptance matrix

| Slice                              | Acceptance evidence                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M16.1 configuration                | production rejects HTTP/missing origin, optional persistence, missing Mongo, unsafe external provider setup, and implicit signup policy                                                |
| M16.2 topology                     | production manifest exposes only web, keeps API private, omits Postgres, defaults invite-only/mock, runs compiled idempotent seed, and uses non-root production images                 |
| M16.3 access/recovery              | email-bound invitations and password resets are hashed, expiring, single-use, replay-safe, transactionally consumed; replacement/success revokes sibling reset links and every session |
| M16.4 lifecycle/policy             | accurate public privacy/terms/support routes, bounded authenticated tenant export/note corpus, and an active-account fence tested against concurrent source/derived deletion           |
| M16.5 observability/live smoke     | request IDs and normalized route/status/latency on errors; vendor-neutral operational adapter and guarded HTTPS smoke; no body, query, raw token, credential, reflection, or note text |
| M16.6 reproducibility/supply chain | JavaScript and Python locks, frozen checks, audits, production-only images, non-root runtime, and HIGH/CRITICAL image scan                                                             |
| M16.7 accessibility                | Chromium critical-flow axe journeys plus WebKit mobile invite/cookie/Today coverage and retained manual evidence requirements                                                          |
| M16.8 pilot learning loop          | thresholded aggregate metrics, exact five research questions, and hypothesis-labeled launch/continue/stop criteria                                                                     |
| M16.9 release governance           | deployment decision packet, draft PR/required checks, protected environment guidance, safe default-branch playbook, and no live claim without restore/smoke evidence                   |

## Earlier candidate verification disposition (historical)

- Chromium release journeys pass 11/11, including the critical-flow axe scan.
- Focused post-review evidence passes the 72-test API unit suite, affected
  real-Mongo account/export/metrics and stale-password/planner regressions,
  API/contracts typechecking, source-contract validation, and the affected
  Chromium fragment/accessibility journey.
- Review repairs keep invitation/reset credentials in fragments with
  no-referrer/query-free logging, use password-hash compare-and-set for
  authentication and deletion, fail production closed for proxy/AI/topology
  boundaries, scrub internal export references, recover expired planner claims,
  and bind metrics to an exact half-open UTC window.
- The first exact-clone runtime smoke found an invalid Nginx asset-cache regex;
  the corrected image now checks syntax while building, preserves the runtime
  `api:4000` upstream, runs as `101:101`, and returns a healthy `/healthz`.
- The mobile-WebKit flow reaches invited registration, authenticated Today,
  logout, re-login, and product deletion, but its automated gate remains red:
  login honors `returnTo=/app/account` while the test still expects
  `/app/today`. The bounded WebKit repair budget is exhausted.
- The original WebKit timeout was an execution-environment Vite dev-transform
  stall, not a product navigation failure. The E2E harness now serves the
  production build through Vite preview.
- A red required browser gate blocks source-ready and pilot-ready status even
  if a numeric aggregate score reaches the threshold.
- The clean-commit, isolated-clone, aggregate-report, exact-SHA CI, and hosted
  deployment boundaries remain evidence tasks, not implied passes.

## Release evidence contract

Resolve the source revision from the commit containing this document and require
every generated report and CI run to identify that same SHA. Generated reports
remain ignored evidence rather than checked-in proof.

- candidate commit: the containing clean commit; record its exact SHA in the
  generated quality report and release handoff
- pull request and CI: not established until the candidate is published and an
  exact-SHA workflow completes
- quality report / score / critical failures: regenerate after the clean commit;
  do not claim a pass while the required WebKit gate is red
- immutable prompt/curriculum diff: must remain empty from baseline
  `424de51004e08e7e6b115b72e61519c35388f040`
- live environment and backup-restore drill: **not supplied; blocks pilot-ready status**

Until the exact-revision source gates pass, this milestone remains
implementation evidence rather than a release claim.

## Subsequent private self-host checkpoint

The M16.3B request identifies `5e85e6463f30f2d5c069941e282335784718659c` as the
subsequently verified `SOURCE_MVP_COMPLETE` baseline, including its green
release aggregate and exact-SHA CI. New deployment-only work is isolated on
`codex/selfhost-private-mvp`; see [M16.3B local self-host](16-3b-private-self-host.md).
That changed source requires fresh aggregate/CI evidence and does not inherit
the baseline result. Its local restore and loopback checks do not establish a
public HTTPS pilot.
