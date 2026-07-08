-- ─────────────────────────────────────────────────────────────────────────────
-- 044_ticket_customer_resolved.sql — customer "mark resolved" signal
--
-- Lets a logged-in customer tell IAT that their issue is resolved from
-- /customer/tickets/[id], WITHOUT touching the staff-owned status enum. Moving a
-- ticket to 'resolved'/'closed' stays a deliberate staff act (it requires a
-- resolved_reason and is audit-logged in the admin flow); this is a separate,
-- advisory flag so staff know a ticket is ready to close out.
--
--   • tickets.customer_marked_resolved  boolean NOT NULL DEFAULT false
--       Flipped true by POST /api/customer/tickets/[id]/resolve (customer-only,
--       ownership re-checked). The customer can also un-mark it (set back to
--       false) if they clicked by mistake / the issue recurs.
--   • tickets.customer_resolved_at      timestamptz
--       When they last marked it resolved (NULL when not / un-marked).
--
-- SECURITY: no RLS change. tickets access runs exclusively through service-role
-- API routes; the resolve route re-verifies ownership (customer_id/email match)
-- exactly like the contact + notes routes. This migration only adds columns.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS customer_marked_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_resolved_at     timestamptz;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--    WHERE table_name='tickets'
--      AND column_name IN ('customer_marked_resolved','customer_resolved_at');
