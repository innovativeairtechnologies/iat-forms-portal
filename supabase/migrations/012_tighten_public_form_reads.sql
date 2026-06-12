-- ─────────────────────────────────────────────────────────────────────────────
-- 012_tighten_public_form_reads.sql
-- RUN AFTER 011. Pure SQL.
--
-- The public SELECT policies on `forms` and `form_fields` are USING(true), so
-- DRAFT forms (is_active=false) and their fields are readable by anon via the
-- REST API — including AI-built forms still pending review. The public site only
-- ever requests ACTIVE forms (every public query already filters is_active=true,
-- and admin/builder reads use the service role), so scoping these policies to
-- active forms hides drafts without changing anything the public site can see.
--
-- After running, smoke-test the PUBLIC site: open /forms, open a form, submit it.
-- (Admin form editing is unaffected — it uses the service role.)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public read forms" ON forms;
CREATE POLICY "Public read forms" ON forms
  FOR SELECT TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read fields" ON form_fields;
CREATE POLICY "Public read fields" ON form_fields
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_fields.form_id
      AND forms.is_active = true
  ));

-- Verify afterward:
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE tablename IN ('forms','form_fields') ORDER BY tablename;
