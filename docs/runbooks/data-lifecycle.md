# Data lifecycle, backup, restore, and deletion

MongoDB stores product state. PostgreSQL is a separate curriculum lab and is
not needed to restore product operation.

For a production environment, use encrypted, access-controlled Mongo snapshots
with a documented retention period. Test restore into an isolated environment,
validate indexes, run `pnpm seed:validate`, and avoid restoring deleted user
data beyond the declared legal/backup retention window.

Account deletion verifies the current password and confirmation, starts a
Mongo transaction, and serially deletes every user-owned collection:
progress, reflections, XP, achievements, skill evidence, reviews,
misconceptions, Error Museum entries, portfolio, AI traces, eval runs, indexed
sources/embeddings, agent runs, job applications, and sessions, followed by the
user. Serial operations are intentional because the Mongo driver does not
support parallel operations on one transaction session.

After a deletion incident test, assert all records with the former `userId`
are absent and the public curriculum remains available. Never retain raw note
text in an AI trace or quality report.
