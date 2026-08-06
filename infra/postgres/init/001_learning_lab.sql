BEGIN;

CREATE SCHEMA IF NOT EXISTS learning_lab;

CREATE TABLE IF NOT EXISTS learning_lab.learners (
  learner_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name text NOT NULL,
  timezone_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_lab.curriculum_days (
  day_number integer PRIMARY KEY CHECK (day_number BETWEEN 1 AND 365),
  month_number integer NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  title text NOT NULL,
  core_minutes integer NOT NULL CHECK (core_minutes = 30)
);

CREATE TABLE IF NOT EXISTS learning_lab.progress_events (
  progress_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  learner_id bigint NOT NULL REFERENCES learning_lab.learners(learner_id) ON DELETE CASCADE,
  day_number integer NOT NULL REFERENCES learning_lab.curriculum_days(day_number),
  completion_mode text NOT NULL CHECK (completion_mode IN ('core', 'recovery')),
  completed_at timestamptz NOT NULL,
  actual_minutes integer NOT NULL CHECK (actual_minutes BETWEEN 0 AND 240),
  UNIQUE (learner_id, day_number)
);

CREATE INDEX IF NOT EXISTS progress_events_learner_completed_idx
  ON learning_lab.progress_events (learner_id, completed_at DESC);

CREATE VIEW learning_lab.learner_momentum AS
SELECT
  learner_id,
  count(*) FILTER (WHERE completed_at >= now() - interval '7 days') AS returns_7d,
  count(*) FILTER (WHERE completed_at >= now() - interval '30 days') AS returns_30d,
  count(*) FILTER (WHERE completion_mode = 'core') AS core_completions,
  count(*) FILTER (WHERE completion_mode = 'recovery') AS recovery_wins
FROM learning_lab.progress_events
GROUP BY learner_id;

COMMIT;
