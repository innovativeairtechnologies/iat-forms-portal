-- ─────────────────────────────────────────────────────────────────────────────
-- 008_ticket_rls.sql
-- Lock down Row-Level Security on `tickets` and `ticket_notes`.
--
-- WHY: neither table had an RLS artifact in the repo (only column-adding ALTERs).
-- If RLS was never enabled by hand in the live project, the public anon key
-- (which ships in every client bundle and the legacy ticketing app's HTML) could
-- read every customer's PII and every internal note directly via the Supabase
-- REST API — bypassing the /api/tickets/status two-factor guard entirely.
--
-- This migration makes the intended posture explicit and version-controlled. It
-- is idempotent and safe to run whether or not RLS was already enabled.
--
-- AFTER applying, verify in the live DB:
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename IN ('tickets','ticket_notes');
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--    WHERE tablename IN ('tickets','ticket_notes');
-- ─────────────────────────────────────────────────────────────────────────────

-- ── tickets ──────────────────────────────────────────────────────────────────
-- Public can INSERT only (the legacy standalone ticketing app inserts directly
-- with the anon key; it generates the ticket number client-side and does NOT
-- read the row back). The portal's own wizard inserts via /api/tickets using the
-- service role, and all admin reads/updates use the service role — so anon/
-- authenticated clients need NO select/update/delete here.
--
-- NOTE: when the legacy standalone app is retired (docs §8.7/§8.1), DROP the
-- tickets_public_insert policy so writes only flow through the rate-limited API.
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tickets' AND policyname = 'tickets_public_insert'
  ) THEN
    EXECUTE 'CREATE POLICY tickets_public_insert ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;
END $$;

-- ── ticket_notes ─────────────────────────────────────────────────────────────
-- Internal staff notes. Service-role ONLY: created via the admin-gated
-- /api/tickets/[id]/notes route and read server-side on the ticket detail page.
-- RLS enabled with NO policies → anon/authenticated clients cannot read or write.
ALTER TABLE ticket_notes ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only
