-- ─────────────────────────────────────────────────────────────────────────────
-- 041_gantt_ranges_risks.sql — Gantt v2 "honest schedules": baselines + assumptions
--
-- Additive + idempotent. Tasks stay inline jsonb on gantt_charts.tasks; the new
-- per-task risk rules live INSIDE each task object (no new columns for them):
--   risks: [{ id, prob (0-100), delayMin, delayMax, note, fired }]
--
-- New columns:
--   baseline    — frozen schedule snapshot in ABSOLUTE dates (GanttBaseline in
--                 lib/gantt.ts) or NULL. Absolute dates on purpose: a later
--                 start_date change must not silently drag the baseline along.
--   assumptions — [{ id, text }] register printed with the chart.
--
-- failure / reset_weeks are DEPRECATED as of 041: normalizeChart() in
-- lib/gantt.ts lazily migrates them onto the anchor task's risks[]; the columns
-- are retained for old rows and never written again.
--
-- Run by hand in the Supabase SQL editor BEFORE deploying the v2 code (the
-- editor autosave writes baseline/assumptions and will 500 without them).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gantt_charts
  ADD COLUMN IF NOT EXISTS baseline    jsonb,
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN gantt_charts.failure     IS 'DEPRECATED since 041 — migrated to anchor task risks[] by normalizeChart()';
COMMENT ON COLUMN gantt_charts.reset_weeks IS 'DEPRECATED since 041 — migrated to anchor task risks[] by normalizeChart()';

-- ── verify (run after applying) ───────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'gantt_charts' AND column_name IN ('baseline', 'assumptions');
