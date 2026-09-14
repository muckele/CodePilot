# Incident response

## Ownership (assign before launch)

- Incident commander: `[name / secure contact]`
- Release and rollback owner: `[name / secure contact]`
- Security/data owner: `[name / secure contact]`
- Hosting/DNS owner: `[name / secure contact]`
- Mongo backup/restore owner: `[name / secure contact]`
- Learner communication owner: `[name / secure contact]`

Support pages intentionally direct learners to the invitation operator through
the same trusted out-of-band channel that delivered access. Replace the
placeholders above in the operator-only release record; do not fabricate a
public address in product copy.

## Severity and stop conditions

- **SEV-0:** confirmed cross-user disclosure, auth bypass, secret/raw access-
  token exposure, material data loss, false deletion/export success, unsafe
  tool action, or failed backup restoration. Immediately close registration,
  stop invitations/deployments, disable external providers/agents, and page all
  owners. Target acknowledgment: 5 minutes.
- **SEV-1:** persistent unavailability, repeated lost/failed saves, readiness or
  Mongo failure, or integrity regression without confirmed disclosure. Close
  registration and stabilize/roll back. Target acknowledgment: 15 minutes.
- **SEV-2:** degraded latency, elevated provider fallback, isolated recoverable
  UX defect, transactional-email provider outage with password/session/operator
  access intact, or support issue with a safe workaround. Preserve available
  learning and account paths and schedule a bounded fix. A provider outage is
  not a readiness incident unless it also breaks the application readiness
  contract.

Alert/triage thresholds for a 5–20-person pilot:

- any sanitized unexpected-500 event tied to export, deletion, registration,
  reset, or tenant ownership: investigate immediately;
- HTTP 5xx at least 5% over five minutes with at least 20 requests;
- p95 API latency over two seconds for 15 minutes;
- `/ready` failing twice in succession or Mongo unavailable for two minutes;
- AI errors plus fallbacks over 20% for 15 minutes with at least 10 interactions;
- more than 20 failed login/reset attempts from one normalized client in 15
  minutes, or a sudden cohort-wide authentication failure;
- sustained password-reset/sign-in-code delivery failure over 20% for 15
  minutes with at least 10 requests; verify password login, existing sessions,
  operator recovery, `/health`, and `/ready` before escalating severity;
- any raw invite/reset token, credential, request body, private note,
  reflection, evidence text, six-digit code, mailbox, user/internal ID,
  provider idempotency key, or provider response observed in centralized logs.

The repository emits privacy-minimized structured request/error logs but does
not provision a log/alert vendor. Missing alert routing blocks a live pilot.

## Procedure

1. **Contain:** set `REGISTRATION_MODE=closed`; revoke the affected invitation,
   reset, session, or provider secret; disable `AI_EXTERNAL_ENABLED` and
   `AI_AGENT_ENABLED`; use the provider kill switch if relevant. For an email
   incident, use the protected `email-disable` workflow rather than deleting
   files or changing Compose by hand. Preserve password login, established
   sessions, learner routes, and operator recovery unless they are implicated.
2. **Identify:** record UTC timeline, release SHA, request IDs, normalized route,
   status, latency, sanitized error name, provider outcome, and aggregate
   counts. Never increase logging to capture raw private content or bearer URLs.
3. **Rollback:** redeploy the last known-good immutable image digest/commit,
   keeping registration closed. Do not roll back Mongo blindly. If the release
   changed stored data, follow the forward-compatibility/migration decision and
   obtain the data owner's approval.
4. **Restore escalation:** for corruption or loss, freeze writes when feasible,
   preserve forensic snapshots, and follow the isolated restore procedure in
   the data-lifecycle runbook. Never overwrite production during a drill. A
   restore that reintroduces deleted accounts requires deletion reconciliation.
5. **Eradicate:** fix the trust-boundary root cause, rotate exposed secrets,
   revoke all affected sessions/access links, and delete poisoned indexed
   sources if applicable.
6. **Recover:** run focused regression, full integration, security/audit/image
   gates, build, seed validation, and the guarded live journey. Reopen access
   only after security/data and release owners sign off.
7. **Review:** record impact, root cause, detection gap, learner notification,
   residual risk, and an ADR/threat-model/runbook update within two business
   days. Notify affected learners honestly if their data crossed a boundary.

## Transactional-email incidents

- **Provider outage or timeout:** keep the application running, confirm no
  Resend probe exists in health/readiness, and use operator-issued reset links
  through the established trusted channel for urgent recovery. Do not add an
  automatic send retry or extend a Mongo transaction around provider work.
- **Ambiguous provider acceptance:** confirm the affected reset/code remains
  unacknowledged and revoked/unverifiable. Never disclose it or mark `sentAt`
  manually. The learner must request a new credential through the bounded flow.
- **Resend key exposure:** disable email, revoke/rotate the key at the provider
  through an explicitly authorized operator action, install the replacement
  using `email-rotate-key`, restart/verify, perform one authorized synthetic
  send, then finalize or roll back the retained key. Do not place either key in
  chat, shell arguments, evidence, or tickets.
- **Login-code pepper exposure or loss:** create a fresh encrypted backup, stop
  the API, rotate the pepper with explicit active-code invalidation, and restart.
  The self-host `email-rotate-pepper --invalidate-active-codes` command enforces
  that sequence. Notify learners only that outstanding codes were invalidated;
  never attempt to recover or log them.
- **Unexpected provider metadata/content:** treat any raw internal ID, user ID,
  token, code, session value, or unintended content as a potential disclosure.
  Preserve only sanitized provider audit references and follow the security/data
  owner’s containment decision.

Never use the numeric quality score to waive an auth bypass, cross-user
disclosure, data loss, unsafe tool action, fabricated success, missing alert
route, or failed backup/restore evidence.
