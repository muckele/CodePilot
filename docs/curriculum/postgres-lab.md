# PostgreSQL learning-data lab

This optional lab mirrors a deliberately small subset of CodeLift data so the
learner can practice relational constraints, joins, transactions, indexes, and
query plans. Product operation remains MongoDB-backed and does not depend on
this schema.

Try these exercises after `docker compose -f infra/compose.yaml up`:

1. Insert one learner and three curriculum days inside a transaction.
2. Record one Core and one Recovery event, then query
   `learning_lab.learner_momentum`.
3. Join progress to curriculum titles in reverse completion order.
4. Run `EXPLAIN (ANALYZE, BUFFERS)` for a learner’s recent events and identify
   whether `progress_events_learner_completed_idx` is selected.
5. Attempt duplicate progress and an invalid 45-minute Core day; explain which
   constraints reject each record.

Do not copy real private notes into this lab.
