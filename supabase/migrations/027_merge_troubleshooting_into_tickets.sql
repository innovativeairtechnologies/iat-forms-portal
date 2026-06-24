-- ─────────────────────────────────────────────────────────────────────────────
-- 027_merge_troubleshooting_into_tickets.sql
-- Merge the "Troubleshooting Checklist" into the Equipment Support Ticket so the
-- support portal has ONE form (Kacy's call). The unified wizard submits to the
-- `tickets` pipeline (TKT-, admin queue, equipment registry, email loop), so the
-- diagnostic fields that previously only lived on `troubleshooting_intakes` are
-- added here. Column types/CHECKs mirror 024_troubleshooting_intakes exactly so
-- the two stores stay shape-compatible.
--
-- `tickets` already has: process_airflow_cfm, react_airflow_cfm, airflow_balanced,
-- pre/post_cooling*, react_heat_working/_setpoint, seals_good, photo_urls,
-- viewed_kb_articles, brand, ai_recommendations. This only adds what's missing.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS) — safe to re-run. No RLS change
-- (writes still flow through the service-role /api/tickets route).
--
-- NOTE: the existing troubleshooting_intakes table + /admin/troubleshooting queue
-- are intentionally LEFT in place for any historical intakes; only the customer-
-- facing form is retired. Retiring that table is a separate, later cleanup.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS problem_started    text,
  ADD COLUMN IF NOT EXISTS onset              text,
  ADD COLUMN IF NOT EXISTS what_changed       text,
  ADD COLUMN IF NOT EXISTS unit_running       boolean,
  ADD COLUMN IF NOT EXISTS has_alarms         boolean,
  ADD COLUMN IF NOT EXISTS alarm_details      text,
  ADD COLUMN IF NOT EXISTS react_temp_f       text,
  ADD COLUMN IF NOT EXISTS wheel_rotating     text,
  ADD COLUMN IF NOT EXISTS seal_light_leakage text,
  ADD COLUMN IF NOT EXISTS external_factors   text[];

-- Constrain the enum-ish columns to the same values the form/API use. Wrapped so
-- re-running doesn't error if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_onset_check') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_onset_check CHECK (onset IN ('sudden', 'gradual', 'unsure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_wheel_rotating_check') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_wheel_rotating_check CHECK (wheel_rotating IN ('yes', 'no', 'unsure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_seal_light_leakage_check') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_seal_light_leakage_check CHECK (seal_light_leakage IN ('yes', 'no', 'unsure'));
  END IF;
END $$;
