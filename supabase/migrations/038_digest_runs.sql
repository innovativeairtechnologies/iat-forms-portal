-- ─────────────────────────────────────────────────────────────────────────────
-- 038_digest_runs.sql — idempotency guard for the daily admin email digest
--
-- The admin digest (app/api/cron/admin-digest) is meant to fire exactly once
-- per America/New_York calendar day at ~4:30pm. Vercel Cron is UTC-only and
-- does not shift for US daylight saving, so vercel.json registers TWO cron
-- entries 60 minutes apart (one correct for EDT, one for EST) and the route
-- itself checks the real NY wall clock before doing anything. The two entries
-- are designed so only one falls inside the "~4:30pm NY" window per day, but a
-- cold start, retry, or manual re-trigger could still cause the send logic to
-- run twice in the same day. An in-memory "already sent today" flag doesn't
-- survive serverless cold starts / separate function instances, so it can't
-- be trusted — we need a durable, race-safe guard instead.
--
-- digest_runs gives us that: one row per NY calendar date, enforced by a
-- unique index. The cron route does an insert (not upsert) and treats "no
-- row came back" as "someone already sent today's digest" and no-ops.
--
-- SECURITY: service-role only (RLS enabled, NO policies) — exactly like
-- customer_portal_requests (034) and other internal/admin-only tables. Only
-- the cron route (using supabaseAdmin) ever touches this table.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS digest_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date        date        NOT NULL,          -- America/New_York calendar date this digest covers (NOT a UTC date)
  sent_at         timestamptz NOT NULL DEFAULT now(),
  recipient_count integer     NOT NULL DEFAULT 0
);

-- At most one digest per NY calendar day. The cron route relies on this to
-- detect "already sent" via a failed/empty insert rather than a second query
-- (closes the race between the two possible daily cron fires).
CREATE UNIQUE INDEX IF NOT EXISTS digest_runs_one_per_day ON digest_runs (run_date);

ALTER TABLE digest_runs ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='digest_runs';
--   SELECT indexname FROM pg_indexes WHERE tablename='digest_runs';
