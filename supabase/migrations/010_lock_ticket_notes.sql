-- ─────────────────────────────────────────────────────────────────────────────
-- 010_lock_ticket_notes.sql
-- ⚠️ RUN ONLY AFTER deploying the code that writes notes via the service-role
-- route /api/tickets/[id]/notes. Do NOT run before that deploy — the currently
-- live code writes notes from the browser as the `authenticated` role and relies
-- on the policy this migration drops; running early breaks note-saving.
--
-- FINDING: `ticket_notes` carried
--     "authenticated_manage_notes"  FOR ALL TO authenticated  USING (true) WITH CHECK (true)
-- i.e. EVERY logged-in employee (not just admins) could read/write ALL internal
-- ticket notes directly via the Supabase REST API, bypassing the admin-only UI.
--
-- After the code change, notes flow exclusively through the admin-gated,
-- service-role API route (reads are also server-side service role), so no
-- authenticated direct access is needed.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_manage_notes" ON ticket_notes;

-- Resulting `ticket_notes` posture: RLS on, NO policies -> service role only.
--
-- Verify afterward (expect zero rows):
--   SELECT policyname FROM pg_policies WHERE tablename='ticket_notes';
