-- ─────────────────────────────────────────────────────────────────────────────
-- 036_warranty_requests.sql — customer self-serve "File a warranty claim"
--
-- Lets a logged-in customer file a warranty claim on one of their IN-WARRANTY
-- units from /customer (WarrantyCard → WarrantySubmitModal). The claim sits in
-- a pending queue at /admin/customers (Warranty tab) for an admin to:
--   • Approve — opens a real ticket (request_type='warranty') so the EXISTING
--     ticket workflow handles servicing the claim, same dashboard/notes/status
--     pipeline as any other support ticket.
--   • Deny — no ticket, a reason is recorded.
-- Either decision emails the customer (lib/resend-customer.ts →
-- sendWarrantyDecisionEmail).
--
--   • warranty_requests    — one row per claim
--   • tickets.request_type — 'support' | 'warranty', so a ticket created from an
--                             approved claim is flagged for the admin UI without
--                             needing a join back to warranty_requests
--
-- SECURITY: warranty_requests is service-role only (RLS enabled, NO policies) —
-- exactly like customer_portal_requests (034) / customers (026). The customer
-- submit route and the admin approve/deny routes all run server-side.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── warranty_requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranty_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  equipment_id        uuid        NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  serial_number       text        NOT NULL,   -- snapshotted from equipment at request time
  description         text        NOT NULL,
  problem_started     text,
  resolution          text        NOT NULL DEFAULT 'repair',  -- repair | replace | credit
  status              text        NOT NULL DEFAULT 'pending', -- pending | approved | denied
  decided_by          uuid,       -- admin auth user id; no FK, mirrors audit_log.actor_id
  decided_at          timestamptz,
  deny_reason         text,
  resulting_ticket_id uuid        REFERENCES tickets(id) ON DELETE SET NULL,  -- set on approve
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warranty_requests_status_idx    ON warranty_requests (status);
CREATE INDEX IF NOT EXISTS warranty_requests_customer_idx  ON warranty_requests (customer_id);
CREATE INDEX IF NOT EXISTS warranty_requests_equipment_idx ON warranty_requests (equipment_id);

-- At most one OPEN claim per unit. Race-safe: a concurrent double-submit hits a
-- unique-violation (23505) on insert instead of creating two rows; the API
-- treats that as an idempotent "already pending" response, not an error.
CREATE UNIQUE INDEX IF NOT EXISTS warranty_requests_one_pending_per_unit
  ON warranty_requests (equipment_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS warranty_requests_set_updated_at ON warranty_requests;
CREATE TRIGGER warranty_requests_set_updated_at
  BEFORE UPDATE ON warranty_requests
  FOR EACH ROW EXECUTE FUNCTION set_customers_updated_at();  -- reuse 026's generic fn

ALTER TABLE warranty_requests ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- ── tickets: flag a ticket as having come from an approved warranty claim ───
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'support'; -- support | warranty
CREATE INDEX IF NOT EXISTS tickets_request_type_idx ON tickets (request_type);

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='warranty_requests';
--   SELECT indexname FROM pg_indexes WHERE tablename='warranty_requests';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='tickets' AND column_name='request_type';
