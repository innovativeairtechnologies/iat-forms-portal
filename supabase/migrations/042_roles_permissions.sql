-- ─────────────────────────────────────────────────────────────────────────────
-- 042_roles_permissions.sql — granular staff roles
--
-- Expands profiles.role from the old admin/employee/customer trio to the full
-- staff role set. The base employee tier is renamed to `production`; the old
-- `employee` value is migrated and dropped from the allowed set.
--
--   admin | sales | hr | marketing | engineering | production_manager
--         | production | customer
--
-- Permission-to-section mapping lives in code (lib/roles.ts) for v1, so there is
-- no permissions table here — this migration only widens the role vocabulary and
-- migrates existing rows.
--
-- SAFE / IDEMPOTENT. Run by hand in the Supabase SQL editor. Deploy the matching
-- app code promptly after.
--
-- DEPLOY-WINDOW SAFETY: 'employee' is KEPT in the CHECK set (as a deprecated
-- transitional value) even though existing rows are migrated to 'production'.
-- This means the currently-live (old) app can keep writing 'admin'|'employee'|
-- 'customer' during the window between running this migration and the code deploy
-- WITHOUT hitting a CHECK violation. The new code never writes 'employee', and
-- normalizeRole() maps any stray 'employee' → 'production' at read time. Once the
-- new code is confirmed live, a later migration can drop 'employee' from the set.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Drop the old CHECK so we can migrate the 'employee' value.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Migrate existing base employees to the new `production` tier.
UPDATE profiles SET role = 'production' WHERE role = 'employee';

-- 3. The auto-provision trigger (from 002) inserts new signups as 'employee'.
--    Point it at 'production' so freshly-created auth users get the base tier
--    under the new vocabulary.
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    'production',
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Change the column default to match.
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'production';

-- 5. Re-add the CHECK with the full role set. 'employee' is included as a
--    DEPRECATED transitional value so the old app can't 500 during the deploy
--    window (see header). Drop it in a follow-up migration once new code is live.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin', 'sales', 'hr', 'marketing', 'engineering',
    'production_manager', 'production', 'customer',
    'employee'  -- deprecated, transitional
  ));

-- 6. Fix a lone RESTRICT foreign key: time_off_requests.reviewed_by (from 001)
--    had no ON DELETE clause, so deleting an employee who ever reviewed a request
--    would be BLOCKED (e.g. by the Data Reset tool, or a normal offboarding). It
--    only records who reviewed and is nullable — SET NULL matches its siblings
--    (submitted_by, manager_id). The default inline constraint name is
--    time_off_requests_reviewed_by_fkey.
ALTER TABLE time_off_requests DROP CONSTRAINT IF EXISTS time_off_requests_reviewed_by_fkey;
ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL;

COMMIT;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT role, count(*) FROM profiles GROUP BY role ORDER BY role;
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_role_check';
