-- ─────────────────────────────────────────────────────────────────────────────
-- 062_crm_companies.sql — Companies & contacts (CRM Phase 2)
--
-- The relational customer model behind the deals pipeline. Until now every
-- customer/rep/contact on a deal was a bare text string; this adds:
--
--  • companies — one row per account (prospects, customers, rep firms).
--    `normalized_name` (lower, suffix/punct-stripped — lib/crm-normalize.ts is
--    the single normalizer) is UNIQUE and doubles as the dupe guard.
--    `customer_id` optionally links a company to its support-portal
--    `customers` row (logins/equipment) once it becomes a real customer —
--    sales prospecting stays OUT of that table.
--  • contacts — people at a company (name, title, email, phone). Multiple per
--    company; `is_primary` is informational.
--  • deals.company_id / deals.primary_contact_id — the deal's account + the
--    human being worked. Both ON DELETE SET NULL: removing a company/contact
--    never destroys deals. `deals.customer` (text) SURVIVES as a derived
--    display cache — the API rewrites it whenever company_id is set or the
--    company is renamed, so every pre-062 view/analytic keeps working.
--
-- Backfill of the 441 existing free-text customers into companies is NOT done
-- here — it runs through the two-phase review flow in the Companies tab
-- (/admin/deals → Companies → Review & link), where a human confirms the
-- fuzzy clusters before anything is written.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as
-- deals (043). Access gated in the app via requireCrmAuth (keyed on the same
-- `deals` permission — same trust boundary and audience, no new perm to seed).
--
-- Apply via Supabase CLI (npx supabase db query --linked -f <this file>).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  normalized_name text        NOT NULL,
  kind            text        NOT NULL DEFAULT 'prospect'
                              CHECK (kind IN ('prospect', 'customer', 'rep_firm', 'other')),
  customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
  domain          text,
  website         text,
  phone           text,
  location        text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_normalized_idx ON companies (normalized_name);

CREATE TABLE IF NOT EXISTS contacts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  title      text,
  email      text,
  phone      text,
  is_primary boolean     NOT NULL DEFAULT false,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_company_idx ON contacts (company_id);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id         uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES contacts(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deals_company_idx ON deals (company_id);

-- keep updated_at fresh on edits (per-table functions, matching 043's pattern)
CREATE OR REPLACE FUNCTION set_companies_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_companies_updated_at();

CREATE OR REPLACE FUNCTION set_contacts_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_contacts_updated_at();

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts  ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)
