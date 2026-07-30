-- ─────────────────────────────────────────────────────────────────────────────
-- 072_case_studies.sql — AI-drafted, human-approved customer case studies
--
--  • case_studies — one row per study. Sales/marketing fill the REQUIRED inputs
--    (context, before/after narrative, per-unit facts), Claude drafts prose from
--    those inputs and NOTHING else, and marketing approves before anything is
--    considered final. Status ladder: draft → in_review → approved.
--
--    Grounding model (the anti-fabrication contract, enforced in
--    /api/admin/case-studies/[id]/generate):
--      draft_sections  — Claude's original draft, IMMUTABLE after generation
--                        (regenerating replaces it; editing never touches it).
--      edited_sections — the human working copy shown/edited in review. Kept
--                        separate so review is always input-vs-output honest.
--      claims          — [{statement, source}] — every factual claim the model
--                        made, each pointing at the FACTS field it came from.
--      gaps            — [{section, need, resolved}] — things the model wanted
--                        but was FORBIDDEN to invent. Approval is blocked while
--                        any is unresolved.
--      flags           — [{token, section, snippet, cleared}] — server-side
--                        number check: every digit-run in the prose must appear
--                        in the inputs; unmatched ones land here and block
--                        approval until a human clears each.
--
--    customer_disclosure defaults to 'anonymized' — a study never names the
--    customer unless someone deliberately flips it (the generate route omits
--    the company name and serials from the model's input entirely in that mode).
--
--  • case_study_units — one row per featured unit, equipment_id optional and
--    identity fields SNAPSHOTTED (model/serial/voltage/location/install_date)
--    so an approved study can't silently change when the equipment registry is
--    edited later. The application/conditions/airflow fields are the required
--    per-unit facts the prose is grounded in.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as deals
-- (043) / companies (062). Access gated in the app via requireCaseStudiesAuth
-- (new `case_studies` perm, seeded below for sales + marketing; approve is
-- additionally restricted to marketing/admin ROLE in the API).
--
-- Apply via Supabase CLI (npx supabase db push, after `migration repair` —
-- see the 059–063 history-drift note in the project memory).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_studies (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          uuid        REFERENCES customers(id) ON DELETE SET NULL,
  title                text        NOT NULL DEFAULT '',
  customer_disclosure  text        NOT NULL DEFAULT 'anonymized'
                                   CHECK (customer_disclosure IN ('anonymized', 'named')),
  industry             text,
  region               text,       -- e.g. "Southeast US" — the anonymized descriptor
  context_input        text        NOT NULL DEFAULT '',
  problem_before       text        NOT NULL DEFAULT '',
  outcome_after        text        NOT NULL DEFAULT '',
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'in_review', 'approved')),
  draft_sections       jsonb,
  edited_sections      jsonb,
  claims               jsonb,
  gaps                 jsonb,
  flags                jsonb,
  model                text,       -- which Claude model generated draft_sections
  generated_by         uuid        REFERENCES employees(id) ON DELETE SET NULL,
  generated_at         timestamptz,
  submitted_by         uuid        REFERENCES employees(id) ON DELETE SET NULL,
  submitted_at         timestamptz,
  approved_by          uuid        REFERENCES employees(id) ON DELETE SET NULL,
  approved_at          timestamptz,
  review_notes         text,
  created_by           uuid        REFERENCES employees(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_studies_customer_idx ON case_studies (customer_id);
CREATE INDEX IF NOT EXISTS case_studies_status_idx   ON case_studies (status);

CREATE TABLE IF NOT EXISTS case_study_units (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id        uuid        NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  equipment_id         uuid        REFERENCES equipment(id) ON DELETE SET NULL,
  -- identity (snapshotted from equipment at link time; freely editable after)
  model_number         text        NOT NULL DEFAULT '',
  serial_number        text,
  voltage              text,
  location             text,
  install_date         date,
  -- the required per-unit facts the case-study prose is grounded in
  application          text        NOT NULL DEFAULT '',  -- what space/process the unit serves
  entering_conditions  text        NOT NULL DEFAULT '',  -- e.g. "85°F / 60% RH return air"
  target_conditions    text        NOT NULL DEFAULT '',  -- e.g. "-40°F dew point supply"
  airflow              text        NOT NULL DEFAULT '',  -- e.g. "5,000 SCFM"
  notes                text,
  sort_order           int         NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_study_units_study_idx ON case_study_units (case_study_id);

-- keep updated_at fresh on edits (same pattern as equipment/customers)
CREATE OR REPLACE FUNCTION set_case_studies_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS case_studies_set_updated_at ON case_studies;
CREATE TRIGGER case_studies_set_updated_at
  BEFORE UPDATE ON case_studies
  FOR EACH ROW EXECUTE FUNCTION set_case_studies_updated_at();

ALTER TABLE case_studies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_study_units  ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- ── Permission seed ──────────────────────────────────────────────────────────
-- New `case_studies` perm for sales (drafts them) + marketing (approves them).
-- MUST mirror DEFAULT_ROLE_PERMS in lib/roles.ts — scripts/check-perm-seed.mjs
-- asserts the two agree. Remember: once role_permissions has rows, the code
-- defaults are dead at runtime, so this INSERT is what actually grants access.

INSERT INTO role_permissions (role, perm) VALUES
  ('sales', 'case_studies'),
  ('marketing', 'case_studies')
ON CONFLICT (role, perm) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT role FROM role_permissions WHERE perm = 'case_studies' ORDER BY role;
--     -- expect 2 rows: marketing, sales
