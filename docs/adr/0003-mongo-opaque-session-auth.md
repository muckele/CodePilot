# ADR 0003 — Mongo persistence with opaque server sessions

- Status: Accepted for Milestone 2
- Date: 2026-07-24

## Context

Milestone 1 deliberately has no user data. Its public curriculum preview loads
the immutable root blueprint through the Node API and must remain useful when
MongoDB is absent.

Milestone 2 introduces credentials, onboarding, user-owned progress,
reflections, and account deletion. These features require durable revocable
sessions, explicit CSRF protection, tenant-scoped queries, and a deletion
boundary. A browser bearer token would make revocation and secure deletion
harder, while a generic session framework would store more session state and
hide important security behavior from this learning project.

## Decision

### Public preview and persistence capability

- The public curriculum preview remains file-backed and independent of MongoDB.
- Session middleware is applied only to auth, account, and progress routes.
- `PERSISTENCE_MODE=optional` permits an honest degraded local preview.
- `PERSISTENCE_MODE=required` makes Mongo/session readiness mandatory and is the
  production default.
- An unavailable database returns `503 application/problem+json` for every
  account or progress route.
- There is no in-memory user, session, or progress fallback.

### Opaque sessions

The API owns a small session implementation backed by a `Session` collection.
It does not use JWT, `express-session`, or `connect-mongo`.

On session creation:

1. generate 32 random bytes with `node:crypto`;
2. return the base64url token only in the session cookie;
3. store only the SHA-256 token hash in MongoDB;
4. generate a separate 32-byte CSRF token and store only its SHA-256 hash;
5. rotate both values after registration and login.

The session record contains only:

- token hash;
- nullable user ID for a pre-authentication CSRF session;
- CSRF-token hash;
- issued, last-seen, idle-expiry, and absolute-expiry timestamps;
- schema version.

The raw cookie and CSRF token never enter MongoDB or logs. Session lookup hashes
the presented cookie before a constant-length comparison/query. Login,
registration, logout, password-sensitive actions, and account deletion rotate
or revoke the session to prevent fixation.

Cookie policy:

- `HttpOnly`;
- `SameSite=Lax`;
- `Path=/`;
- no `Domain`;
- `Secure` in production;
- production name `__Host-codelift.sid`;
- development name `codelift.sid` because loopback HTTP cannot set a Secure
  `__Host-` cookie.

### CSRF and origin

`GET /api/v1/auth/csrf` creates a short-lived pre-auth session and returns its
raw CSRF token in JSON. Every unsafe auth/account/progress request requires:

- the opaque session cookie;
- `X-CSRF-Token`;
- an exact configured browser `Origin`.

The API hashes the submitted CSRF token and compares fixed-length bytes with
`crypto.timingSafeEqual`. CSRF tokens live in browser memory, not local
storage. CORS is defense in depth and is not treated as authorization.

### Passwords

Passwords use Argon2id with:

- 64 MiB memory (`memoryCost: 65536`);
- three iterations (`timeCost: 3`);
- parallelism one;
- a random salt;
- an encoded hash carrying its algorithm and parameters.

The target must be benchmarked on Node 24 for both development and the
production container. Login uses a generic failure response and performs a
dummy verification when an email is absent to reduce account-enumeration
timing differences. Passwords and hashes are never logged or returned.

### Authorization and deletion

Controllers do not query Mongoose models directly. Repositories require the
authenticated `userId` for all user-owned reads and writes. Progress and
reflection uniqueness is `(userId, dayNumber)`.

`AccountDeletionService` owns a deletion registry. Every user-owned repository
must register its delete operation. Milestone 2 includes User, Session,
ProgressLog, and Reflection; future derived sources and embeddings must join
the same registry. Deletion runs in a Mongo transaction, invalidates all
sessions, and never deletes shared curriculum records.

Authentication confirms that the session user still exists. A stale session
therefore cannot regain access if best-effort cleanup is interrupted after the
user transaction commits.

## Consequences

Benefits:

- database compromise does not reveal usable raw session tokens;
- sessions are immediately revocable;
- public preview reliability is not coupled to MongoDB;
- auth and CSRF mechanics remain explicit and testable;
- account deletion has one extensible ownership boundary.

Costs:

- CodeLift must maintain narrowly scoped session middleware and tests;
- MongoDB is required for every authenticated capability;
- replica-set operation is required for transaction evidence;
- local and production cookie names differ;
- password reset and email verification remain out of Milestone 2 scope and
  must be disclosed.

The local Compose database is unauthenticated and loopback-only. It is a
development/test convenience, not a production MongoDB configuration.
