-- ============================================================
-- IAT Forms Portal — Row Level Security
-- Paste this into: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- The service role key (used by the admin backend) bypasses RLS
-- entirely, so no admin functionality is affected by these policies.
-- Only the anon key (public portal) is constrained.
-- ============================================================

-- Step 1: Enable RLS on every table
ALTER TABLE public.categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- Step 2: categories — employees need to read these to browse the portal
CREATE POLICY "anon_read_categories"
  ON public.categories
  FOR SELECT TO anon
  USING (true);

-- Step 3: forms — employees can only see active forms
CREATE POLICY "anon_read_active_forms"
  ON public.forms
  FOR SELECT TO anon
  USING (is_active = true);

-- Step 4: form_fields — employees can read fields, but only for active forms
CREATE POLICY "anon_read_fields_of_active_forms"
  ON public.form_fields
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.forms
      WHERE forms.id = form_fields.form_id
        AND forms.is_active = true
    )
  );

-- Step 5: submissions — employees can INSERT (submit a form) but cannot
--         read, update, or delete any submissions. Only service role can.
CREATE POLICY "anon_insert_submissions"
  ON public.submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- Step 6: submission_notes — no anon policies = fully locked to service role
-- Step 7: notification_rules — no anon policies = fully locked to service role

-- ============================================================
-- Verify: run this query to confirm RLS is enabled
-- ============================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
