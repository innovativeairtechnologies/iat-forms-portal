-- ─────────────────────────────────────────────────────────────────────────────
-- 097_engineering_upsert_index.sql — make the eng_tasks uniqueness usable by
-- ON CONFLICT.
--
-- 096 created the index PARTIAL:
--
--   CREATE UNIQUE INDEX eng_tasks_job_step_uniq
--     ON eng_tasks (job_id, stream, step) WHERE job_id IS NOT NULL;
--
-- The predicate was there to let standing support work (job_id IS NULL) repeat
-- the same step — 'support' / 'sales_support' every week — which the whole
-- Support & Other bucket depends on.
--
-- ⚠️ But a PARTIAL index cannot be inferred by `ON CONFLICT (job_id, stream, step)`.
-- Postgres refuses with 42P10, "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification", and there is no way to hand PostgREST
-- the index predicate that would make the inference match. So
-- generateTasksForJob — which upserts with ignoreDuplicates precisely so that
-- regenerating a plan is idempotent rather than additive — threw on EVERY job
-- creation.
--
-- It compiled, it type-checked, and `next build` was green: the pages are
-- force-dynamic, so nothing ran the query at build time. Caught by executing the
-- real insert against the real database before deploying.
--
-- ── The fix, and why it does not cost the thing the predicate bought ────────
-- A plain (non-partial) unique index gives ON CONFLICT something to infer, AND
-- still allows unlimited standing tasks — because in a Postgres unique index
-- NULLs are DISTINCT from one another by default. Two rows of
-- (NULL, 'support', 'sales_support') do not conflict; they are two different
-- keys as far as the index is concerned.
--
-- 🔴 That behavior is load-bearing, and it is a default that can be turned off.
-- Never add NULLS NOT DISTINCT to this index (Postgres 15+ syntax): it would
-- silently collapse the Support & Other bucket to one row per step forever, and
-- the failure would look like "the second sales-support task just does not save".
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS eng_tasks_job_step_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS eng_tasks_job_step_uniq
  ON eng_tasks (job_id, stream, step);

-- ── Verify (run after applying) ──────────────────────────────────────────────
-- Index exists and is NOT partial (indpred must be NULL):
--   SELECT indexrelid::regclass AS name, indpred IS NULL AS not_partial
--   FROM pg_index WHERE indexrelid = 'eng_tasks_job_step_uniq'::regclass;
--
-- Two standing tasks with the same step still insert (NULLs are distinct):
--   INSERT INTO eng_tasks (job_id, stream, step, title) VALUES
--     (NULL, 'support', 'sales_support', 'A'), (NULL, 'support', 'sales_support', 'B');
--   DELETE FROM eng_tasks WHERE title IN ('A','B') AND job_id IS NULL;
