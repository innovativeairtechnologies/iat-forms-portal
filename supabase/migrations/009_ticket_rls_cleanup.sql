-- ─────────────────────────────────────────────────────────────────────────────
-- 009_ticket_rls_cleanup.sql
-- RUN NOW (safe immediately). Closes a CONFIRMED read/write exposure on `tickets`
-- and removes redundant insert policies, found in the 2026-06-12 live RLS audit.
--
-- FINDING: `tickets` carried a permissive policy
--     "Service role tickets"  FOR ALL TO public  USING (true)
-- Postgres combines permissive policies with OR, so this catch-all granted
-- SELECT / UPDATE / DELETE on every row to ANY role — including anon — silently
-- overriding the correct admin-only SELECT/UPDATE policies. (rowsecurity was
-- TRUE, but a USING(true) policy is functionally "no RLS".)
--
-- The service-role key BYPASSES RLS, so this policy never granted anything the
-- server actually needs. Dropping it is safe: all portal reads/updates use the
-- service role, public ticket creation is covered by the INSERT policy, and the
-- admin SELECT/UPDATE policies remain for any direct authenticated-admin access.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role tickets" ON tickets;

-- Consolidate three duplicate INSERT policies into one. Keep tickets_public_insert
-- (migration 008, scoped TO anon, authenticated); drop the two hand-made duplicates.
DROP POLICY IF EXISTS "Public can insert tickets" ON tickets;
DROP POLICY IF EXISTS "Public insert tickets" ON tickets;

-- Resulting `tickets` posture:
--   SELECT -> admins only      ("Admins can view tickets")
--   UPDATE -> admins only      ("Admins can update tickets")
--   INSERT -> anon/auth        ("tickets_public_insert")  [legacy app + wizard]
--   DELETE -> none             -> service role only
--
-- Verify afterward:
--   SELECT policyname, cmd, roles, qual, with_check
--     FROM pg_policies WHERE tablename='tickets' ORDER BY cmd;
