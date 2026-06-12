-- ─────────────────────────────────────────────────────────────────────────────
-- 011_rls_catchall_cleanup.sql
-- RUN AFTER the deploy that switches /forms to read submission counts via the
-- service role (app/forms/page.tsx). Pure SQL — no Vercel deploy of its own.
--
-- A schema-wide sweep (2026-06-12) found the SAME anti-pattern that affected
-- `tickets` (see 009) on nearly every table: a policy named "Service role <x>"
-- defined as  FOR ALL TO public USING (true).  The service-role key BYPASSES
-- RLS, so these policies never granted the server anything — their only effect
-- was to expose every row (SELECT/INSERT/UPDATE/DELETE) to anon/public. Most
-- serious: `submissions` (all form-response data was anon-readable AND
-- anon-deletable) and `notification_rules` (recipient emails exposed + rules
-- tamperable).
--
-- Verified safe before writing: every write to these tables in the app uses the
-- service-role client (supabaseAdmin); public form rendering reads via the
-- dedicated "Public read ..." SELECT policies (left intact); the only anon read
-- of `submissions` (the /forms count) was moved to the service role in the same
-- change set. Employee rows are created by a DB trigger (SECURITY DEFINER) and
-- the invite flow uses the service role, so the public INSERT policy on
-- `employees` is unused.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role all"           ON submissions;        -- all form data
DROP POLICY IF EXISTS "Service role all"           ON submission_notes;   -- internal notes
DROP POLICY IF EXISTS "Service role notifications"  ON notification_rules; -- recipient emails
DROP POLICY IF EXISTS "Service role forms"          ON forms;
DROP POLICY IF EXISTS "Service role fields"         ON form_fields;
DROP POLICY IF EXISTS "Service role categories"     ON categories;
DROP POLICY IF EXISTS "employees_insert_service"    ON employees;          -- anon could insert HR rows

-- Intentionally LEFT IN PLACE so the public site keeps working:
--   categories  : "Public read categories" / "anon_read_categories"  (SELECT)
--   forms       : "Public read forms"   (SELECT)  -- tightened in 012
--   form_fields : "Public read fields"  (SELECT)  -- tightened in 012
--   submissions : "anon_insert_submissions" / "Public insert submissions" (INSERT)
--
-- Verify afterward — the sweep below should now return far fewer rows, and NONE
-- for submissions/submission_notes/notification_rules:
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--    WHERE schemaname='public' AND (qual='true' OR with_check='true')
--    ORDER BY tablename;
