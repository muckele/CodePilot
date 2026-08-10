# Deployment guide

## Reproducible local stack

```bash
docker compose -f infra/compose.yaml up --build -d
docker compose -f infra/compose.yaml --profile tools run --rm seed
```

Open `http://localhost:8080`. The stack includes web, Node API, Mongo replica
set, PostgreSQL lab, and Python service. The API uses `python_mock`; no model or
paid key is needed.

## Production shape

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

The repository does not prescribe a cloud vendor. A release is incomplete if
TLS, exact origin, secret injection, Mongo replica availability, backup restore,
or readiness routing is unverified.
