-- ─────────────────────────────────────────────────────────────────────────────
-- 075_rep_scorecard.sql — Rep scorecard (/admin/rep-scorecard)
--
-- Sales' rep-health review, ported from the IAT_Rep_Scorecard workbook (two
-- tabs: "Individual Reps" scored by hand, "Firm Rollup" aggregating them). The
-- spreadsheet's model is kept exactly — ten 0/1/2 health signals summing to a
-- Total out of 20, with tier and grade bands from the Inside Sales Playbook —
-- and the parts Excel could not do become the reason this lives in the portal:
-- one shared copy, scores kept BY PERIOD so a rep's trend is visible, and the
-- firm/portfolio rollups computed rather than re-linked.
--
-- Built on the CRM layer (062), same as the territory map (068): rep firms are
-- `companies` rows with kind='rep_firm', reps are `contacts`. That is a
-- deliberate reuse — the workbook's firm dropdown and the map's firm list are
-- the same 30-odd firms, and a rep added here shows up in the map's directory
-- (and vice versa) instead of drifting into a second roster.
--
-- Adds:
--  • contacts.territory  — the rep's territory/region (workbook column C).
--    Free text, not a company_territories FK: this is "Ohio Valley", the human
--    patch a person covers, not the painted state/county set a FIRM owns.
--  • contacts.rep_status — Active | Developing | Dormant | House/Direct
--    (workbook column E's dropdown). Named rep_status, not `status`: `contacts`
--    is the shared CRM table, and a bare `status` there would read as a
--    contact-lifecycle field rather than "how we classify this rep".
--  • rep_scorecards — one row per (rep, period). The ten signals are smallint
--    0/1/2 and NULLABLE: an unscored signal is genuinely different from a 0
--    ("we haven't looked" vs "no"), which is why Total in the workbook is blank
--    until at least one is scored. The CHECKs enforce the 0–2 dropdown.
--
-- Total / Score % / Tier / Grade are deliberately NOT stored — they are pure
-- functions of the ten signals and live in lib/rep-scorecard.ts, so a band
-- change is one edit rather than a backfill of every historical row.
--
-- Hard numbers (goal, booked, pipeline, RFQs, hit rate) stay optional context
-- exactly as the workbook has them. Open pipeline and RFQ counts can also be
-- suggested live from the DryWare deal mirror (name-matched on deals.rep_contact)
-- in the UI — the stored value is always what a human accepted, never a silent
-- overwrite.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as 062
-- and 068. Access gated in the app via requireRepScorecardAuth (keyed on the
-- same `deals` permission — same trust boundary and audience as the CRM,
-- Performance and Territory pages, so there is NO new perm to seed and the
-- check-perm-seed prebuild gate stays quiet); writes additionally require the
-- admin or sales role.
--
-- Apply via Supabase CLI (npx supabase db query --linked -f <this file>).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory  text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rep_status text;

CREATE TABLE IF NOT EXISTS rep_scorecards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Review period, 'YYYY-Qn' (e.g. '2026-Q3'). Text rather than a date range:
  -- it is a label Sales picks from a dropdown, and sorts correctly as a string.
  period     text NOT NULL,

  -- ── The ten health signals (0 = red/no/unknown · 1 = watch/partial · 2 = healthy)
  rfqs_regularly   smallint CHECK (rfqs_regularly   BETWEEN 0 AND 2),
  registers_early  smallint CHECK (registers_early  BETWEEN 0 AND 2),
  coverage_3x      smallint CHECK (coverage_3x      BETWEEN 0 AND 2),
  pipeline_shaped  smallint CHECK (pipeline_shaped  BETWEEN 0 AND 2),
  hit_rate_in_band smallint CHECK (hit_rate_in_band BETWEEN 0 AND 2),
  responsive       smallint CHECK (responsive       BETWEEN 0 AND 2),
  forecast_trust   smallint CHECK (forecast_trust   BETWEEN 0 AND 2),
  training_1_3     smallint CHECK (training_1_3     BETWEEN 0 AND 2),
  logs_win_loss    smallint CHECK (logs_win_loss    BETWEEN 0 AND 2),
  booked_to_plan   smallint CHECK (booked_to_plan   BETWEEN 0 AND 2),

  -- ── Hard numbers (optional context — they inform the signals, they don't score)
  -- numeric(14,2) arrives from PostgREST as a STRING (unlike double precision),
  -- so lib/rep-scorecard.ts coerces with Number() at the edge. Dollars stay
  -- exact here rather than riding float.
  annual_goal   numeric(14,2),
  booked_ytd    numeric(14,2),
  open_pipeline numeric(14,2),
  rfqs_60d      integer  CHECK (rfqs_60d >= 0),
  -- Stored as a FRACTION (0.40 = 40%), matching the workbook's cell format.
  hit_rate      numeric(5,4) CHECK (hit_rate >= 0 AND hit_rate <= 1),

  notes          text,
  scored_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scored_by_name text,
  scored_at      timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One scorecard per rep per period — the upsert target for the drawer's save.
CREATE UNIQUE INDEX IF NOT EXISTS rep_scorecards_rep_period_uniq ON rep_scorecards (contact_id, period);
CREATE INDEX IF NOT EXISTS rep_scorecards_period_idx ON rep_scorecards (period);

-- keep updated_at fresh on edits (per-table function, matching 062/068's pattern)
CREATE OR REPLACE FUNCTION set_rep_scorecards_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rep_scorecards_set_updated_at ON rep_scorecards;
CREATE TRIGGER rep_scorecards_set_updated_at
  BEFORE UPDATE ON rep_scorecards
  FOR EACH ROW EXECUTE FUNCTION set_rep_scorecards_updated_at();

ALTER TABLE rep_scorecards ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- ── Verify (run after applying) ──────────────────────────────────────────────
-- SELECT count(*) FROM rep_scorecards;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'contacts' AND column_name IN ('territory', 'rep_status');
