-- ─────────────────────────────────────────────────────────────────────────────
-- 043_deals.sql — Sales deal pipeline ("Forecast Pulse" MVP)
--
-- One row per sales deal/opportunity. Rebuilds the core of the Monday.com
-- "Sales Forecasting" board natively — this runs in parallel with Monday until
-- proven out, not a day-one replacement. Three admin views (Pipeline / CRM /
-- Focused) all read this one table; `weighted` (total_cost * confidence/100)
-- is intentionally NOT stored — it's computed client-side (lib/deals.ts),
-- matching the repo's convention for derived values (see Gantt's lib/gantt.ts).
--
-- Internal data: RLS on, NO policies — service-role only, like equipment/
-- gantt_charts. Access is gated in the app layer: admin (full) and sales
-- (scoped, both read AND write per product decision — see lib/api-auth.ts
-- requireDealsAuth and docs/roles-and-permissions.md for why this deviates
-- from the v1 default of write-APIs being admin-only).
--
-- Seeded with the 5 sample deals from the Monday scaffolding prompt so the
-- three views can be built/demoed against real-shaped data immediately. The
-- real spreadsheet import is a follow-up once the views are dialed in.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer     text        NOT NULL,
  assigned_to  text,
  date_quoted  date,
  status       text        CHECK (status IN ('Won', 'Lost')), -- null = active/open
  unit_model   text,
  job_name     text,
  total_cost   numeric     NOT NULL DEFAULT 0,
  confidence   integer     NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  projected    text,
  rep          text,
  rep_contact  text,
  notes        text,
  group_name   text        NOT NULL DEFAULT 'MAIN',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_group_idx  ON deals (group_name);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status);

-- keep updated_at fresh on edits
CREATE OR REPLACE FUNCTION set_deals_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_set_updated_at ON deals;
CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_deals_updated_at();

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- ── seed: the 5 sample deals from the Monday scaffolding prompt ─────────────
-- No natural key to ON CONFLICT against (id is a random uuid), so guard
-- idempotency by only seeding an empty table — reruns of this migration won't
-- duplicate rows.
INSERT INTO deals (customer, assigned_to, date_quoted, status, unit_model, job_name, total_cost, confidence, projected, rep, rep_contact, notes, group_name)
SELECT * FROM (VALUES
  ('QCorp (20+ compacts)',      NULL,        NULL::date, NULL::text, NULL,             NULL, 190000, 90, 'July 2025',   NULL,   NULL,                 NULL,
   'MAIN'),
  ('H&H Nashville (Coorstek)',  NULL,        NULL,       NULL,       '5000RG-IDP',     NULL, 269405, 70, 'May 2025',    'H&H',  'Chris Turbeville',   NULL,
   'JACOB'),
  ('Aerojet (4K CFM, Jerry)',   NULL,        NULL,       NULL,       '4000 CFM IDP',   NULL, 379401, 60, 'August 2025', NULL,   NULL,                 NULL,
   'DAVE'),
  ('H&H (MBI Battery)',         NULL,        NULL,       NULL,       NULL,             NULL, 775149, 80, 'Q4 2025',     NULL,   NULL,                 '8.27.25, Chris said it''s still a valid project, consensus is that it will go soon.',
   'MIKE'),
  ('Holden (Home Chef)',        'Kacy Orr',  NULL,       NULL,       NULL,             NULL, 450000, 20, NULL,          NULL,   NULL,                 'Gone quiet the last month.',
   'MIKE')
) AS seed (customer, assigned_to, date_quoted, status, unit_model, job_name, total_cost, confidence, projected, rep, rep_contact, notes, group_name)
WHERE NOT EXISTS (SELECT 1 FROM deals);
