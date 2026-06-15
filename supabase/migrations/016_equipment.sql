-- ─────────────────────────────────────────────────────────────────────────────
-- 016_equipment.sql  — Phase 2: equipment / installed-base registry
--
-- One permanent record per physical unit, keyed by serial number. Tickets link
-- to it by serial (full service history); warranty is computed from ship_date +
-- warranty_months unless an explicit warranty_end override is set.
--
-- Records are created manually (admin UI) or auto-accrued from new tickets
-- (POST /api/tickets upserts by serial). Internal data: RLS on, NO policies —
-- service-role only, like ticket_notes. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number    text        NOT NULL UNIQUE,
  model_number     text,
  voltage          text,
  customer_company text,
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  location         text,
  ship_date        date,
  install_date     date,
  warranty_months  integer     NOT NULL DEFAULT 12,
  warranty_end     date,        -- optional override; else ship_date + warranty_months
  status           text        NOT NULL DEFAULT 'active',  -- active | decommissioned
  photo_urls       text[],
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_serial_idx   ON equipment (serial_number);
CREATE INDEX IF NOT EXISTS equipment_customer_idx ON equipment (customer_company);

-- keep updated_at fresh on edits
CREATE OR REPLACE FUNCTION set_equipment_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS equipment_set_updated_at ON equipment;
CREATE TRIGGER equipment_set_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_equipment_updated_at();

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)
