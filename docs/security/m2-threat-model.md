# Milestone 2 threat model

## Scope and assets

Milestone 2 protects:

- email addresses and password hashes;
- opaque session and CSRF credentials;
- onboarding identity, schedule, motivation, and privacy preferences;
- progress evidence and private reflections;
- account ownership and deletion state;
- the integrity of the canonical curriculum and its Mongo seed;
- availability of the public no-database preview.

Out of scope for this milestone are uploads, provider credentials, AI prompts,
embeddings, agents, password reset, email verification, and production
multi-region operation.

## Trust boundaries

```text
Untrusted browser input
        |
        | HTTPS in production, explicit Origin, CORS, CSRF, Zod
        v
Node API (authentication, authorization, policy, redacted logs)
        |
        | scoped repositories, bounded Mongo operations
        v
MongoDB (users, hashed sessions, progress, reflections)

Canonical root curriculum file
        |
        | hash + schema + invariant preflight
        v
Public preview API (no Mongo/session dependency)
```

The local Mongo port is published only on `127.0.0.1:27018`. Compose's internal
hostname is not a browser trust boundary. The local database has no Mongo
authentication and must never be exposed on a LAN or public interface.

## Threats, controls, and regression evidence

| Threat                                  | Controls                                                                                                | Required regression evidence                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Credential stuffing and brute force     | Argon2id, bounded password input, generic login response, dummy verification, auth-specific rate limits | Correct/wrong/missing-user timing path tests; `429` contract test         |
| Password disclosure                     | Hash only; password projection disabled; redacted logs and problems                                     | Repository projection and log-capture tests                               |
| Session theft after database disclosure | 256-bit opaque cookie; only SHA-256 token hash stored; expiry and rotation                              | Assert raw cookie is absent from Mongo and old token fails after rotation |
| Session fixation                        | Regenerate session and CSRF values after register/login                                                 | Pre-auth cookie cannot authorize after login rotation                     |
| CSRF                                    | Pre-auth synchronizer session, separate token, exact Origin, SameSite cookie                            | Missing/wrong/replayed token and wrong/missing Origin return `403`        |
| XSS-assisted credential access          | HttpOnly cookie; no unsafe HTML; CSRF token only in memory; CSP/Helmet                                  | Cookie flags and unsafe-render regression tests                           |
| Broken object-level authorization       | Repository methods require user ID; compound ownership filters                                          | Two-user read/write denial against real Mongo                             |
| Email enumeration                       | Generic login response and dummy hash path; privacy-safe registration copy                              | Same public problem shape for missing user and wrong password             |
| NoSQL/operator injection                | Strict Zod objects; construct Mongo filters from parsed scalar fields; never spread request objects     | `$`, nested-object, and unknown-field rejection tests                     |
| Duplicate/concurrent progress writes    | Unique ownership index, optimistic version, idempotency keys, transactions where needed                 | Concurrent duplicate and stale-version integration tests                  |
| False completion                        | Service enforces evidence before Core or Recovery completion; response only after committed write       | Persistence-failure and missing-evidence tests                            |
| Sensitive logging                       | Existing normalized-route/request-ID logger; no body, query, cookie, email, evidence, or reflection     | Captured-log assertions for every auth failure class                      |
| Mongo outage                            | Public preview bypasses Mongo; auth/progress fail closed; explicit optional/required readiness          | Preview succeeds while account routes return `503`                        |
| Stale or poisoned curriculum seed       | Canonical source hash and 365-day validation; Mongo seed must match source SHA                          | Wrong-hash/missing-day readiness tests                                    |
| Account-deletion gaps                   | Central deletion registry, transaction, all-session invalidation, user existence check                  | Real-Mongo cascade and stale-session denial tests                         |
| Local database exposure                 | Loopback-only published port, internal Compose network, no production reuse                             | Compose configuration assertion for `127.0.0.1` binding                   |
| Resource exhaustion                     | 32 KiB JSON limit, bounded fields/arrays, rate limits, database timeouts                                | Oversized body/field and bounded-timeout tests                            |

## Session and CSRF lifecycle

1. The browser requests a CSRF token.
2. The API creates a pre-auth Session with hashed opaque and CSRF tokens.
3. The browser sends the cookie automatically and the CSRF token explicitly.
4. Successful registration/login deletes the pre-auth session and creates new
   session and CSRF values.
5. Logout deletes the session and expires the cookie.
6. Account deletion removes all sessions for the user before success is
   reported.
7. Idle and absolute expiry are enforced by the API; a Mongo TTL index performs
   eventual storage cleanup but is not the authorization check.

## Data deletion and retention

User-owned M2 data:

- User;
- Session;
- ProgressLog;
- Reflection.

Account deletion must:

1. reauthenticate the current password and require an exact confirmation;
2. validate CSRF and Origin;
3. delete every registered user-owned collection in a transaction;
4. invalidate all sessions for that user;
5. clear the current cookie;
6. return success only after the committed deletion;
7. verify that the former session cannot authorize.

Shared CurriculumDay and Resource records are not user-owned and remain.
Future `IndexedSource`, embedding, trace, agent, and provider-derived records
must be added to the deletion registry before those features can ship.

Logs contain request IDs and normalized route/status metadata only. They must
not contain email, raw session/CSRF tokens, passwords or hashes, onboarding
motivation, evidence, or reflections.

## Residual risks and deferred controls

- Local Compose MongoDB has no database authentication; loopback binding is
  mandatory and production must use authenticated encrypted MongoDB.
- In-memory rate limiting is single-process only; distributed deployment needs
  a shared limiter.
- Email verification, password reset, session-management UI, and suspicious
  login notification are deferred.
- XSS can perform actions as the active user even when it cannot read the
  HttpOnly cookie; output safety and CSP remain mandatory.
- Immediate deletion is not recoverable. The confirmation and password check
  are intentional safeguards.
