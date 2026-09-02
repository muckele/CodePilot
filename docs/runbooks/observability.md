# Private-pilot observability adapter

CodeLift's default adapter is vendor-neutral structured stdout/stderr plus
health/readiness probes and the aggregate pilot report. No monitoring vendor is
provisioned by the source repository.

## Structured events

Every completed request emits `http.request` with request ID, method, normalized
route template, status code, and duration milliseconds. Every unexpected 500
also emits `http.server_error` to stderr with the same request ID, method,
normalized route, status 500, bounded error class/name, and current duration.
The RFC-style browser problem includes that same request ID.

An approved platform log adapter should derive:

- request count by method, normalized route, and status class;
- error count/rate from 5xx statuses and `http.server_error`;
- p50/p95/p99 latency from `durationMs`;
- authentication failures from 401/403 on normalized auth/private routes;
- rate-limit responses from status 429;
- readiness availability by probing `/ready`; `/health` is process liveness and
  must not substitute for Mongo/curriculum readiness.

The thresholded `pnpm mvp:metrics` report derives fixed-window funnel,
completion, UTC-calendar D1/D7 return, persisted-save, AI reliability/cost, and
export/deletion totals from first-party records. Every count uses UTC-midnight
boundaries and `[since, until)`; activity stores no route or content. The report
does not claim a historical agent kill-switch value because the current mutable
flag has no event history (`agentKillSwitchEnabled` is `null`). Verify the live
flag independently. In the launch profile the expected provider cost is exactly
zero and agent execution must remain disabled.

## Prohibited dimensions and payloads

Do not ingest request/response bodies, query strings, email/name/account ID,
password, cookie, CSRF value, invite/reset token, note/reflection/evidence,
prompt/model response, database query/URI, export, or per-user metric. Do not add
raw URL as a label. Invitation and reset bearer values are carried only in URL
fragments, which must never be promoted into request targets or telemetry.
Request IDs are correlation identifiers, not learner analytics keys.

Limit metric labels to service, environment, release SHA, method, normalized
route, status class, error class, provider name/outcome, and region. Reject
unbounded path/query labels.

## Deployment wiring

Before invitations, configure the selected platform to collect API stdout and
stderr, parse one JSON object per line, retain it for the approved 30-day pilot
window, and route the incident-runbook thresholds to the named incident owner.
Verify one synthetic 500 in an isolated environment, one readiness failure, and
one test alert end-to-end. Record redacted screenshots/configuration references;
never include raw log streams or bearer links in release evidence.
