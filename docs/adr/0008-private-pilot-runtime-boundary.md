# ADR 0008 — Private-pilot runtime and access boundary

- Status: accepted for M16
- Date: 2026-08-10

## Context

The release-rehearsal Compose stack includes Mongo, PostgreSQL, Python, API,
web, and seed services. A private pilot needs a smaller production contract,
controlled account creation, recoverable access, and honest evidence without
claiming that a local rehearsal is a hosted deployment.

## Decision

Use a separate vendor-neutral production manifest with one public web ingress,
a private Node API, managed Mongo, and an idempotent seed release job.
PostgreSQL is not a product dependency. Python is an optional profile and mock
AI is the default. Registration defaults to `invite_only`; production requires
an exact HTTPS origin and required persistence. External AI and bounded agents
remain disabled at launch.

Invitations and password resets are operator-issued one-time bearer links whose
raw token is shown once and only its SHA-256 digest is stored. Registration
binds an invitation to an email and consumes it atomically with user creation.
Password reset consumes the token atomically with Argon2id replacement and all-
session revocation. Public policy/support pages, authenticated export, and
transactional deletion form the lifecycle boundary.

## Consequences

The repository can prove source and local runtime readiness without purchasing
infrastructure. A live claim additionally requires an approved host/domain,
secret injection, alerts, managed backup and isolated restore evidence, and a
passing HTTPS journey. Open public signup remains blocked until verified email,
automated recovery, abuse response, and revised policy controls exist.
