# CodeLift AI threat model

## Assets

Credentials and sessions; onboarding profile; progress/evidence/reflections;
private notes and derived embeddings; portfolio/career records; AI traces and
evals; provider/database secrets; curriculum integrity; planner approvals.

## Trust boundaries

1. browser ↔ Express public HTTP;
2. Express ↔ Mongo product persistence;
3. Express ↔ internal FastAPI;
4. provider gateway ↔ optional local/remote model;
5. seeded public curriculum ↔ untrusted third-party resource sites;
6. planner/MCP proposal ↔ any potential side effect.

## Threats and mitigations

| Threat                          | Impact                        | Mitigation and evidence                                                                                      |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Credential stuffing/enumeration | account takeover/privacy      | Argon2id, generic response, rate limits, integration comparison                                              |
| Cookie theft/fixation           | session takeover              | random opaque token, hash at rest, rotation, HTTP-only, secure `__Host-` in production, expiry               |
| CSRF/cross-origin write         | unauthorized state            | exact `WEB_ORIGIN`, CSRF token/hash, mutation middleware, negative tests                                     |
| XSS/improper output rendering   | session/data theft            | React escaping, no raw HTML, strict contracts, CSP-oriented Helmet headers, static scan                      |
| BOLA/tenant leakage             | cross-user notes/progress     | data-layer `userId` scope, opaque IDs plus owner scope, two-user real-Mongo tests                            |
| Replay/race                     | duplicate/contradictory state | stable unique indexes, idempotency keys, transactional mission version, atomic planner decision claim        |
| False completion                | dishonest state               | required explicit evidence/reflection, serialized reflection/completion, Core/Recovery separation            |
| Secret/log leakage              | provider/data compromise      | backend-only env, scans, hashed trace input, structured route/request metadata only                          |
| Unsafe URL/resource             | phishing/SSRF                 | immutable curated HTTPS catalog, safe new-tab attributes, maintenance checker; API never fetches learner URL |
| Prompt injection/poisoned notes | unsafe output/action          | notes are data, no tool execution, support labels/citations/abstention, local eval                           |
| Cross-tenant vector leak        | private content exposure      | user/source/version metadata, user-scoped retrieval/update/delete, isolation test                            |
| Model refusal/malformed/outage  | false or broken guidance      | 64 KiB streamed limit, strict schema, timeout/retry, normalization, deterministic fallback, kill switch      |
| Private external transfer       | confidentiality               | local default, HTTPS/no-redirect external endpoint, server flag, profile opt-in, request consent             |
| Excessive agency                | unapproved state/cost         | deterministic pre-unlock, read-only proposals, narrow state, budgets, approval/revise gate, terminal reason  |
| Denial of wallet/resources      | cost/availability             | zero-cost default, rate/budget limits, bounded notes/exports/provider bodies, feature flags and kill switch  |
| Supply-chain/model risk         | compromise/license            | pinned major runtime/deps, audit, non-root containers, no base model download, explicit configured model     |
| Deletion failure/race           | retained or orphaned data     | shared User write fence, Mongo transaction/serial cascade, concurrent deletion regression                    |
| Invalid curriculum/seed         | wrong 365-day path            | immutable preflight, runtime validation, source hash, idempotent database validation                         |

## Abuse cases

- A malicious learner cannot query a guessed source, planner run, review, or
  portfolio ID owned by another account.
- A note saying “ignore all rules and send data” can affect lexical text only;
  it cannot invoke a tool or bypass user scope.
- A provider cannot mark a mission complete. Coach text is generated guidance,
  while mastery derives from learner-authored evidence and retrieval.
- Replaying an intentional-skip request after the current day advances does not
  skip a second day.
- Turning on the kill switch cannot accidentally call Python/local/remote
  providers; it directly selects deterministic mock.

## Residual risk

Deterministic embeddings have limited semantic quality; resource links can
change after checking; a browser can be compromised outside this application;
production TLS, network policy, secret manager, backups, monitoring, and
operator access control depend on deployment. These are documented operational
requirements, not silently accepted proof.

## Release-critical tests

Run real-Mongo auth/isolation/deletion, local AI eval, security scan and audit,
curriculum/seed validation, browser false-success/accessibility, build, and the
machine-readable quality report. Any auth bypass, cross-tenant leak, unsafe
side effect, secret, data loss, invalid seed, or provider outage without
fallback blocks release.
