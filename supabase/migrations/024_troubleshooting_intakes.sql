-- ─────────────────────────────────────────────────────────────────────────────
-- 024_troubleshooting_intakes.sql
-- Customer-facing "Troubleshooting Checklist" intake (the "DATA BEFORE DECISIONS"
-- quick-reference card, turned into a guided card-by-card form at
-- /support/troubleshooting). Phase 1 = capture the data; the admin view, AI tips,
-- status lookup, and card export come in Phase 2.
--
-- SECURITY: submissions flow ONLY through the rate-limited /api/troubleshooting
-- route using the service role, so this table needs NO anon/authenticated
-- policies. RLS is enabled with zero policies → service-role-only (the service
-- role bypasses RLS). This is deliberately tighter than `tickets`, which still
-- carries a legacy public-insert policy for the standalone ticketing app.
--
-- AFTER applying, verify in the live DB:
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='troubleshooting_intakes';
--   SELECT policyname FROM pg_policies WHERE tablename='troubleshooting_intakes';
--   -- expect rowsecurity=true and ZERO policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.troubleshooting_intakes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number    text NOT NULL,

  -- Contact (card 1)
  customer_name       text NOT NULL,
  customer_company    text,
  customer_email      text NOT NULL,
  customer_phone      text,

  -- Equipment (card 2) — serial is the gate: "No serial number = no troubleshooting"
  serial_number       text NOT NULL,
  model_number        text,
  voltage             text,

  -- Problem (card 3)
  problem_description text NOT NULL,
  problem_started     text,

  -- Onset (card 4) — the most important question: sudden vs gradual
  onset               text CHECK (onset IN ('sudden', 'gradual', 'unsure')),
  what_changed        text,

  -- Current status & alarms (card 5)
  unit_running        boolean,
  has_alarms          boolean,
  alarm_details       text,

  -- Airflow & reactivation readings (card 6) — optional, "if known"
  process_airflow_cfm text,
  react_airflow_cfm   text,
  react_temp_f        text,

  -- Wheel & seals (card 7) — Five Fundamentals
  wheel_rotating      text CHECK (wheel_rotating     IN ('yes', 'no', 'unsure')),
  seal_light_leakage  text CHECK (seal_light_leakage IN ('yes', 'no', 'unsure')),

  -- External variables (card 8) — multi-select
  external_factors    text[],

  -- Photos (card 9) — reuse the public `ticket-photos` storage bucket
  photo_urls          text[],

  -- Triage (Phase 2 admin view will use this)
  status              text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.troubleshooting_intakes ENABLE ROW LEVEL SECURITY;
-- intentionally NO policies — service-role only (writes via /api/troubleshooting)

CREATE INDEX IF NOT EXISTS troubleshooting_intakes_created_at_idx
  ON public.troubleshooting_intakes (created_at DESC);
CREATE INDEX IF NOT EXISTS troubleshooting_intakes_status_idx
  ON public.troubleshooting_intakes (status);
CREATE INDEX IF NOT EXISTS troubleshooting_intakes_serial_idx
  ON public.troubleshooting_intakes (serial_number);
