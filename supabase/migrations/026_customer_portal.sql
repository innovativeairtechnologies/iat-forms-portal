-- ─────────────────────────────────────────────────────────────────────────────
-- 026_customer_portal.sql  — Phase 1: customer-facing portal (/customer)
--
-- Adds external CUSTOMER accounts on top of the existing internal (admin/employee)
-- auth. A customer is a company that has bought one or more units; one login sees
-- all of that company's equipment, build/ship status, and support requests.
--
--   • customers              — the company account (1 row per customer company)
--   • profiles.customer_id   — links a login (auth user) to its customer company
--   • profiles.role          — now allows 'customer'
--   • equipment.customer_id  — links each unit to its owning customer
--   • equipment_milestones   — staff-updated build/ship timeline shown on the portal
--
-- SECURITY: customers, equipment, and equipment_milestones are service-role only
-- (RLS enabled, NO policies) — exactly like `equipment` today. The /customer pages
-- run server-side, derive the customer_id from the logged-in session, and fetch
-- ONLY that customer's rows via the service role. The browser never queries these
-- tables directly, so one customer can never read another's data. profiles keeps
-- its existing read-own policy (middleware needs it for the role check).
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         text        NOT NULL,
  primary_contact_name text,
  contact_email        text,                 -- mirrors the login email (auth.users)
  phone                text,
  location             text,
  logo_url             text,                 -- nullable: light white-label, later
  accent_color         text,                 -- nullable: light white-label, later
  status               text        NOT NULL DEFAULT 'active',  -- active | inactive
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_contact_email_idx ON customers (lower(contact_email));

CREATE OR REPLACE FUNCTION set_customers_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_customers_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (portal reads run server-side)

-- ── profiles: allow the 'customer' role + link to a customer company ──────────
-- The original CHECK (from 002) is auto-named profiles_role_check.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'employee', 'customer'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_customer_id_idx ON profiles (customer_id);

-- ── equipment: link each unit to its owning customer ─────────────────────────
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS equipment_customer_id_idx ON equipment (customer_id);

-- ── equipment_milestones: build / ship timeline (staff-updated) ──────────────
-- Rendered as the shipping tracker on the customer portal. Staff advance stages
-- in the admin equipment UI. `stage` is a free label (canonical defaults live in
-- lib/customer.ts); `status` drives the stepper; occurred_at stamps completion.
CREATE TABLE IF NOT EXISTS equipment_milestones (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  uuid        NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  stage         text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',  -- pending | in_progress | complete
  occurred_at   timestamptz,
  note          text,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_milestones_equipment_idx
  ON equipment_milestones (equipment_id, sort_order);

-- reuse the generic updated_at trigger fn defined in 016_equipment.sql
DROP TRIGGER IF EXISTS equipment_milestones_set_updated_at ON equipment_milestones;
CREATE TRIGGER equipment_milestones_set_updated_at
  BEFORE UPDATE ON equipment_milestones
  FOR EACH ROW EXECUTE FUNCTION set_equipment_updated_at();

ALTER TABLE equipment_milestones ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename IN ('customers','equipment_milestones');
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='profiles'::regclass AND conname='profiles_role_check';
