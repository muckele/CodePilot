# Deployment guide

## Private Mac self-host checkpoint

`infra/compose.selfhost.yaml` is the dedicated M16.3B local self-host stack:
web, API, and authenticated MongoDB 8 `rs0`, with only `127.0.0.1:8080`
published. Follow the [private self-host runbook](runbooks/self-host.md) for
operator state, secret-file configuration, bounded builds, initialization,
encrypted local backup, isolated restore, and persistence verification. It
keeps production HTTPS-origin and Secure-cookie policy while public exposure
and real HTTPS browser testing remain deferred.

## Reproducible local stack

```bash
docker compose -f infra/compose.yaml up --build -d
docker compose -f infra/compose.yaml --profile tools run --rm seed
```

Open `http://localhost:8080`. The stack includes web, Node API, Mongo replica
set, PostgreSQL lab, and Python service. The API uses `python_mock`; no model or
paid key is needed.

## Production shape

No provider has been selected or provisioned. Review the dated
[deployment decision packet](deployment-decision.md) and obtain explicit
approval for host, database tier, region, domain, spend, and named owners before
creating paid resources.

- Terminate TLS at a trusted ingress and set `WEB_ORIGIN` to the exact HTTPS
  origin. Production automatically uses the `__Host-` secure session cookie.
  Set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops so account
  rate limits use the real client address; keep it `0` for direct connections.
- Keep Mongo and Python on private networks. Do not publish PostgreSQL unless
  the optional lab/analytics use case is explicitly secured.
- Inject `MONGO_URI` and optional provider secrets from a secret manager; never
  bake them into images or browser variables.
- Run the global seed as an idempotent release job, then require `/ready`.
- Use encrypted Mongo backup/restore, retention, and deletion procedures from
  the data-lifecycle runbook.
- Set CPU/memory/request limits, provider budgets, centralized structured logs,
  and alerts for auth failures, error rates, latency, cost, fallback rate, and
  citation/abstention regressions.
- Keep AI external use disabled until the privacy policy, model/data retention
  terms, learner opt-in, and incident process are approved.

`infra/compose.production.yaml` is the separate private-pilot example. It omits
PostgreSQL, exposes only the web ingress, uses managed Mongo through injected
`MONGO_URI`, keeps the API private, defaults to invitation-only registration and
deterministic mock AI, and treats Python as an optional profile. Run the seed
profile once per release; the operation is idempotent and rollout readiness is
the API `/ready` endpoint. The local `infra/compose.yaml` remains a development
and release-rehearsal stack and is not a production credential template.

Production browser source maps are not generated or served. If an approved
error tracker is added later, use hidden source maps and upload them only during
the protected build; do not make them public by default.

The repository does not prescribe a cloud vendor. A release is incomplete if
TLS, exact origin, secret injection, Mongo replica availability, backup restore,
or readiness routing is unverified.

## Pre-invitation verification

After deployment, use a newly issued synthetic invitation and pass credentials
only as local shell arguments in a controlled operator terminal:

```bash
pnpm mvp:live-check -- \
  --base-url https://pilot.example.test \
  --synthetic-email codelift-smoke-release@example.invalid \
  --synthetic-password '<generated test-only password>' \
  --invitation-token '<one-time synthetic invitation token>' \
  --allow-synthetic-cleanup
```

The command verifies health/readiness, SPA deep links, headers, caching,
invite-only/mock/no-external/no-agent configuration, registration, onboarding,
Today, export, and transactional cleanup. Do not save the command in shell
history, CI logs, tickets, or documentation. It does not verify alert delivery
or backup restore; those require separate redacted evidence.
