-- ─────────────────────────────────────────────────────────────────────────────
-- 034_customer_portal_requests.sql — self-serve "Request Portal Access"
--
-- Lets a customer who's already submitted a support ticket ask for portal
-- access without forcing account creation on everyone. The request sits in a
-- pending queue for an admin to approve (which runs the SAME invite pipeline
-- as api/admin/customers/invite) or deny (no account, no email). Approving
-- also stamps a real customer_id onto the triggering ticket instead of the
-- app continuing to rely on email/serial string-matching forever.
--
--   • customer_portal_requests  — one row per self-serve access request
--   • tickets.customer_id       — links a ticket to the customer account that
--                                 owns it, once one exists
--
-- SECURITY: customer_portal_requests is service-role only (RLS enabled, NO
-- policies) — exactly like customers/equipment_milestones (026). The public
-- request route and the admin queue both run server-side.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── customer_portal_requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_portal_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id              uuid        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  requested_email        text        NOT NULL,   -- snapshotted from the ticket at request time
  requested_company      text,
  requested_contact_name text,
  requested_phone        text,
  suggested_customer_id  uuid        REFERENCES customers(id) ON DELETE SET NULL,
                                     -- signal only: set when the ticket's equipment serial is
                                     -- already linked to a customer — surfaced to the approving
                                     -- admin as "attach to this company instead?" to avoid dupes
  status                 text        NOT NULL DEFAULT 'pending',  -- pending | approved | denied
  decided_by             uuid,       -- admin auth user id; no FK, mirrors audit_log.actor_id
  decided_at             timestamptz,
  deny_reason            text,
  resulting_customer_id  uuid        REFERENCES customers(id) ON DELETE SET NULL,  -- set on approve
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_portal_requests_status_idx ON customer_portal_requests (status);
CREATE INDEX IF NOT EXISTS customer_portal_requests_ticket_idx ON customer_portal_requests (ticket_id);
CREATE INDEX IF NOT EXISTS customer_portal_requests_email_idx  ON customer_portal_requests (lower(requested_email));

-- At most one OPEN request per ticket. Race-safe: a concurrent double-submit
-- hits a unique-violation (23505) on insert instead of creating two rows; the
-- API treats that as an idempotent "already pending" response, not an error.
CREATE UNIQUE INDEX IF NOT EXISTS customer_portal_requests_one_pending_per_ticket
  ON customer_portal_requests (ticket_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS customer_portal_requests_set_updated_at ON customer_portal_requests;
CREATE TRIGGER customer_portal_requests_set_updated_at
  BEFORE UPDATE ON customer_portal_requests
  FOR EACH ROW EXECUTE FUNCTION set_customers_updated_at();  -- reuse 026's generic fn

ALTER TABLE customer_portal_requests ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- ── tickets: link to the customer account that owns it ──────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_customer_id_idx ON tickets (customer_id);

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename='customer_portal_requests';
--   SELECT indexname FROM pg_indexes WHERE tablename='customer_portal_requests';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='tickets' AND column_name='customer_id';
