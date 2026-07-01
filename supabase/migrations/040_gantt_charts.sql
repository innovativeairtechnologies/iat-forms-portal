-- ─────────────────────────────────────────────────────────────────────────────
-- 040_gantt_charts.sql — the internal "Gantt / Project Timelines" tool (admin-only)
--
-- One row per customer project timeline. A timeline is a simple finish-to-start
-- chain of tasks/milestones; one task is the `anchor` (the long-lead /
-- critical-path driver) whose arrival date drives everything downstream. Tasks
-- live INLINE as a jsonb array — they're owned by the chart, small, and always
-- read/written as a whole, so a separate table would only add joins.
--
-- SECURITY: admin-only. RLS enabled with NO policies — every read/write goes
-- through the service-role client (supabaseAdmin) behind an admin-gated
-- route/action, exactly like presentations (039) and digest_runs (038).
--
-- Idempotent. Run by hand in the Supabase SQL editor before deploying the feature.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gantt_charts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL DEFAULT 'Untitled project',
  customer     text,
  status       text        NOT NULL DEFAULT 'active'  CHECK (status   IN ('active', 'complete', 'draft')),
  start_date   date        NOT NULL DEFAULT current_date,
  scenario     text        NOT NULL DEFAULT 'likely'  CHECK (scenario IN ('best', 'likely', 'worst')),
  failure      boolean     NOT NULL DEFAULT false,
  reset_weeks  integer     NOT NULL DEFAULT 8         CHECK (reset_weeks >= 0 AND reset_weeks <= 104),
  -- [{ id, name, kind:'task'|'milestone', cat:'routine'|'uncertain'|'build',
  --    owner, durMin, durMax, anchor }]
  tasks        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by   uuid,                                  -- auth user id of the admin who created it
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz                            -- soft-delete: NULL = active in the list
);

CREATE INDEX IF NOT EXISTS gantt_charts_updated_idx ON gantt_charts (updated_at DESC);
CREATE INDEX IF NOT EXISTS gantt_charts_active_idx   ON gantt_charts (archived_at);

-- ── RLS: service-role only (no policies) ──────────────────────────────────────
ALTER TABLE gantt_charts ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — all access via supabaseAdmin behind admin-gated code

-- ── verify (run after applying) ───────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='gantt_charts';
