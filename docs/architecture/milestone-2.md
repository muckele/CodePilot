# Milestone 2 architecture — account, onboarding, and Mongo progress

## Runtime shape

```text
React browser
  |-- public preview requests ------------------------------.
  |                                                         |
  `-- cookie + Origin + CSRF authenticated requests --.     |
                                                           v v
                                                     Express API
                                                       |       |
                                      canonical file --'       `-- scoped repositories
                                                                    |
                                                                    v
                                                             MongoDB replica set
```

The public preview remains available from the preflighted canonical file when
MongoDB is absent. Authentication, onboarding, personalized Today, progress,
reflection, and deletion are Mongo capabilities and never fall back to memory.

## Pinned local MongoDB

Milestone 2 uses:

```text
mongo:8.0.26@sha256:3ce3de7f40e914034b03b7dec654005ab54f7dc8306937e44ec6760d9e9409a1
```

The verified image platform is `linux/arm64`. The Compose file publishes Mongo
only on `127.0.0.1:27018` and configures one replica-set member:

```text
rs0 / mongodb:27017
```

The replica set is required to test account-deletion transactions and
concurrent progress behavior under the same transaction semantics expected in
production. The initializer is idempotent: it initiates an unconfigured
database, accepts the exact existing CodeLift configuration, and fails if an
unexpected replica configuration already exists.

Host-side clients use `directConnection=true` because the replica-set member
advertises its Compose-internal hostname:

```text
mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true
```

## Development commands

Create the protected external volume once:

```bash
docker volume create codelift_m2_mongo_data
```

Validate configuration without starting services:

```bash
docker compose -f infra/compose.m2.yaml config
```

Start MongoDB and run the bounded idempotent initializer:

```bash
docker compose -f infra/compose.m2.yaml up -d mongodb mongo-rs-init
docker compose -f infra/compose.m2.yaml wait mongo-rs-init
```

Inspect primary state:

```bash
docker compose -f infra/compose.m2.yaml exec mongodb \
  mongosh --quiet --eval 'EJSON.stringify(db.hello())'
```

Stop services without deleting data:

```bash
docker compose -f infra/compose.m2.yaml down
```

`codelift_m2_mongo_data` is declared `external`, so ordinary Compose teardown,
including a project-level volume teardown, does not own or delete it. Database
removal is a separate explicit operator action and is not part of normal
commands.

The local database is unauthenticated and safe only because the published port
is loopback-only. Do not deploy this Compose file as production infrastructure.

## Test database safety

Mongo integration tests use a distinct URI such as:

```text
mongodb://127.0.0.1:27018/codelift_m2_test?replicaSet=rs0&directConnection=true
```

Before any reset, cleanup, or `dropDatabase`, the test bootstrap must require:

- `NODE_ENV === "test"`;
- an explicitly provided `MONGO_TEST_URI`;
- a parsed database name ending in `_test`;
- a database name different from the development and production names.

If any guard fails, the suite exits without issuing a destructive database
command. Tests run serially or use unique names ending in `_test` per worker.
They delete only records/databases created by the current test suite.

Unit, contract, policy, controller, and service tests use injected fakes and do
not need MongoDB. Real Mongo is mandatory evidence for:

- indexes and duplicate-key behavior;
- hashed session persistence and rotation;
- user-scoped cross-tenant denial;
- optimistic concurrency and idempotent progress;
- 365-day source-hash seed integrity;
- transaction-backed account deletion;
- session invalidation after deletion;
- optional/required behavior during a real disconnect.

## Readiness and degraded operation

Configuration:

```text
PERSISTENCE_MODE=optional|required
MONGO_URI=mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true
```

Readiness states:

| Curriculum | Mongo and matching seed | Mode     | `/ready`       | Capabilities                                              |
| ---------- | ----------------------- | -------- | -------------- | --------------------------------------------------------- |
| invalid    | any                     | any      | `503`          | none                                                      |
| valid      | ready                   | any      | `200 ready`    | preview + accounts                                        |
| valid      | unavailable/stale       | optional | `200 degraded` | preview only                                              |
| valid      | unavailable/stale       | required | `503`          | preview route still responds, instance is not fully ready |

`GET /health` remains process-only. Public curriculum routes use no session or
Mongo middleware. Account/progress routes check persistence capability before
reading cookies and return a generic `503 application/problem+json` with a
bounded retry hint when unavailable.

Production defaults to `required`. Optional mode is an honest local preview,
not an in-memory persistence implementation.

## Data and service boundaries

Controllers parse shared Zod contracts and call services. They never import
Mongoose models directly.

Services:

- `AuthService`;
- `CsrfService`;
- `OnboardingService`;
- `TodayService`;
- `ProgressService`;
- `AccountDeletionService`;
- `CurriculumMongoSeeder`.

Repositories:

- `UserRepository`;
- `SessionRepository`;
- `ProgressRepository`;
- `ReflectionRepository`;
- `CurriculumMongoRepository`;
- `MongoUnitOfWork`.

Every user-owned repository method requires `userId`. Progress and reflection
records have a unique `(userId, dayNumber)` index. Account deletion calls a
central ownership registry so future derived records cannot silently escape
the deletion lifecycle.

## Operational assumptions

- Docker server `29.6.1` on `linux/arm64` and the pinned image were confirmed
  before this file was written.
- The application process runs on the host for M2, hence port `27018` and
  `directConnection=true`.
- Production supplies authenticated, encrypted MongoDB and does not reuse this
  local Compose file.
- Argon2 native compatibility and latency must be verified under Node 24 on
  both macOS ARM64 and the production Linux image before auth is declared
  ready.
- Email verification and password reset remain explicitly deferred.
