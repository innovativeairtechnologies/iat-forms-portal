-- ─────────────────────────────────────────────────────────────────────────────
-- 002_profiles.sql
-- Unified role-based auth — single login for admins and employees
--
-- After running this migration:
--   1. Create admin accounts in Supabase Dashboard → Authentication → Users
--      (set email + password, mark email as confirmed)
--   2. Then run this UPDATE for each admin account:
--         UPDATE profiles SET role = 'admin', display_name = 'Their Name'
--         WHERE id = '<their supabase user id>';
--   3. Existing employee accounts already have Supabase Auth — their profiles
--      are backfilled below with role = 'employee'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can read their own profile (needed for middleware role check)
CREATE POLICY "profiles_read_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ─── Trigger: create a profiles row for every new Supabase Auth user ───────

CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    'employee',
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user_profile();

-- ─── Backfill: create profiles rows for all existing employees ─────────────

INSERT INTO profiles (id, role, display_name)
SELECT e.id, 'employee', e.name
FROM employees e
ON CONFLICT (id) DO NOTHING;
