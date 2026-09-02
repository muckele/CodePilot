# Data lifecycle, backup, restore, and deletion

MongoDB stores product state. PostgreSQL is a separate curriculum lab and is
not needed to restore product operation.

For a production environment, use encrypted, access-controlled Mongo snapshots
with a documented retention period. The private-pilot default proposal is one
daily snapshot with the provider's most recent eight snapshots retained, a
maximum 24-hour recovery point objective (RPO), and a four-hour recovery time
objective (RTO). If either objective is unacceptable, use a dedicated tier with
continuous point-in-time recovery. The release owner must record the accepted
values; these defaults are not automatically approved.

Retention policy:

- product and derived learner data: until account deletion or the operator-
  approved end of the pilot, whichever comes first;
- privacy-minimized authenticated activity: one owner/date record containing
  only the UTC date and first/last timestamps, retained and exported with the
  account and removed by account deletion;
- sessions: seven-day idle / 30-day absolute expiry, then Mongo TTL deletion;
- invitation records: unusable at their configured expiry and TTL-deleted 30
  days later; only a digest is stored, but the email is operational personal
  data until deletion;
- password-reset records: unusable at their configured expiry and TTL-deleted
  seven days later; only a digest is stored; issuing a replacement revokes
  every older unused link, and a successful reset revokes every sibling link;
- identity-free daily export/deletion counters: TTL-deleted after 400 days;
- centralized request logs: proposed 30 days for the pilot; no request body,
  query string, credential, raw token, note, evidence, or reflection text;
- backups: provider policy above, then permanent expiry. Do not extend backup
  retention merely to retain data an account owner deleted.

## Isolated restore drill

Run before invitations and at least once per pilot release that changes data
models:

1. Create a synthetic account with an invitation, onboarding, one persisted
   mission/evidence/reflection, a note/index, and a second isolated tenant.
2. Capture the provider snapshot identifier, source cluster, release SHA,
   encryption/region, start time, and expected RPO.
3. Restore into a new isolated cluster/project that has no production ingress,
   provider integration, webhook, or email capability. Never restore over the
   source cluster for a drill.
4. Point a one-off API/seed validation job at the restored URI. Validate indexes,
   run `pnpm seed:validate`, verify both synthetic tenants remain isolated, and
   export the first account.
5. Record measured RPO/RTO, document count checks, test result, operator, and
   redacted provider evidence. Do not attach a connection string or export.
6. Destroy the isolated application/cluster and verify destruction. If the
   drill fails or exceeds the accepted RPO/RTO, the pilot is blocked.

After a real restore, keep `REGISTRATION_MODE=closed`, revoke sessions and
outstanding access links as the incident requires, run the guarded live check,
and obtain incident-owner approval before reopening access. A restore can
reintroduce data deleted after the recovery point; reconcile deletion requests
from the incident log before reopening.

Account export is authenticated and includes tenant-scoped source plus derived
records in a versioned JSON document. It excludes password/session/CSRF/token
hashes, internal Mongo identifiers, user ownership keys, and content/input
hashes. Collection cursors are consumed sequentially in batches, stop at 1,000
records per collection, and enforce an 8 MiB pre-serialization data budget; the
HTTP boundary retains its final 10 MiB body limit. A `413` requires a
support-controlled isolated export rather than raising either limit in the
shared API process. Treat the downloaded file as private user data; it is not
written to server disk or analytics.

Private notes are bounded to 100 sources and 2 MiB of cumulative UTF-8 source
content per account. Creation and updates calculate that budget inside the
same active-account transaction used for the write, so concurrent requests
cannot both pass the last available slot. Search and list paths also stop and
fail closed if legacy data exceeds the supported source count.

Account deletion verifies the current password and confirmation, starts a
Mongo transaction, writes the User document's active-account fence, and
serially deletes every user-owned collection:
progress, reflections, XP, achievements, skill evidence, reviews,
misconceptions, Error Museum entries, portfolio, AI traces, eval runs, indexed
sources/embeddings, agent runs, job applications, authenticated activity,
invitations consumed by the account, password resets, and sessions, followed by
the user. Serial operations are intentional because the Mongo driver does not
support parallel operations on one transaction session. The only surviving
lifecycle signal is an identity-free daily deletion counter with the bounded
retention above.

Every user-owned create or upsert, including lazy derived records, sessions,
progress/reflections, notes, traces, evals, and planner runs, must first write
that same User fence and persist the child record in the same short Mongo
transaction. Long provider or evaluation computation stays outside the
transaction; only final persistence is fenced. A writer that commits first is
included in the deletion cascade, while a deletion that commits first makes a
retried writer fail because the User no longer exists.

After a deletion incident test, assert all records with the former `userId`
and consumed invitation ownership are absent, every former session is rejected,
and the public curriculum remains available. Never retain raw note text in an
AI trace, metric, log, issue, or quality report.
