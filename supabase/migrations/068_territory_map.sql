-- ─────────────────────────────────────────────────────────────────────────────
-- 068_territory_map.sql — Rep territory map (/admin/territories)
--
-- Replaces Mapline ($1,700/yr): an interactive US+Canada map where Sales tracks
-- which rep firm owns which territory, with pins at rep locations. Built on the
-- dormant CRM layer (062): rep firms are `companies` rows (kind='rep_firm'),
-- reps are `contacts`. This adds:
--
--  • company_territories — one row per (firm, territory) assignment.
--    level 'state' | 'province' | 'county'; code is the USPS state code ('TX'),
--    Canadian province code ('ON'), or 5-digit county FIPS ('48201').
--    OVERLAP IS ALLOWED (unique per firm+geo, not per geo): real arrangements
--    split by product line — `exclusivity` carries that detail per assignment
--    (Mapline's editable "exclusive in territory: yes, for food and bev").
--    Shared territories render neutral with all owners listed on click.
--  • company_locations — pins. Separate table (not lat/lng on companies)
--    because firms have multiple offices; contact_id is the seam for deferred
--    per-rep pins. Address fields all nullable — the sensitive-fields import is
--    deferred, and lat/lng NULL = "not yet placed on the map" (the org_x/org_y
--    free-placement precedent; pins are click-to-place + drag in v1, no geocoder).
--  • companies.map_color — the firm's fill color, from the curated palette in
--    lib/territories.ts (stored, not hashed: ~15 firms over a 12-color palette
--    would collide with no way to fix it). NULL renders slate.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as 062.
-- Access gated in the app via requireTerritoryAuth (keyed on the same `deals`
-- permission — same trust boundary and audience, no new perm to seed; writes
-- additionally require the admin or sales role).
--
-- Apply via Supabase CLI (npx supabase db query --linked -f <this file>).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_territories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level       text        NOT NULL CHECK (level IN ('state', 'province', 'county')),
  code        text        NOT NULL,
  exclusivity text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_territories_uniq ON company_territories (company_id, level, code);
CREATE INDEX IF NOT EXISTS company_territories_code_idx ON company_territories (level, code);

CREATE TABLE IF NOT EXISTS company_locations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  label      text,
  address    text,
  city       text,
  region     text,
  postal     text,
  country    text        NOT NULL DEFAULT 'US' CHECK (country IN ('US', 'CA')),
  lat        double precision,
  lng        double precision,
  is_primary boolean     NOT NULL DEFAULT false,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_locations_company_idx ON company_locations (company_id);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS map_color text;

-- keep updated_at fresh on edits (per-table function, matching 062's pattern)
CREATE OR REPLACE FUNCTION set_company_locations_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_locations_set_updated_at ON company_locations;
CREATE TRIGGER company_locations_set_updated_at
  BEFORE UPDATE ON company_locations
  FOR EACH ROW EXECUTE FUNCTION set_company_locations_updated_at();

ALTER TABLE company_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_locations   ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- ── Verify (run after applying) ──────────────────────────────────────────────
-- SELECT count(*) FROM company_territories;
-- SELECT count(*) FROM company_locations;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'companies' AND column_name = 'map_color';
