-- ─────────────────────────────────────────────────────────────────────────────
-- 045_role_permissions.sql — the editable role→permission matrix
--
-- Until now the matrix lived only in code (lib/roles.ts DEFAULT_ROLE_PERMS). This
-- table makes it editable from /admin/permissions without a deploy: presence of a
-- (role, perm) row = that scoped role holds that permission (mirrors the array
-- model exactly). The SET of permissions (columns) and their nav/route bindings
-- stay in code — only role→perm membership is stored here.
--
--   • `admin` is never stored — it implicitly holds every permission in code.
--   • `production` / `customer` are structurally barred from /admin regardless,
--     so they're not seeded/editable either.
--   • Once seeded, this table is the source of truth. lib/permissions.getPermMatrix
--     falls back to the code defaults if it's ever missing/empty/unreadable, so a
--     DB hiccup never changes access from today's behavior.
--
-- SECURITY: RLS on. Any AUTHENTICATED session may SELECT (middleware + sidebar
-- read it — it's authz config, not user data). No write policy exists, so only
-- the service role (the admin API route, getAdminUser-gated) can modify it.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL,
  perm text NOT NULL,
  PRIMARY KEY (role, perm)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_read ON role_permissions;
CREATE POLICY role_permissions_read ON role_permissions
  FOR SELECT TO authenticated USING (true);

-- Seed from lib/roles.ts DEFAULT_ROLE_PERMS. ON CONFLICT DO NOTHING keeps this
-- idempotent — re-running never duplicates rows or resets admin-made edits.
INSERT INTO role_permissions (role, perm) VALUES
  ('sales','dashboard'),('sales','tickets'),('sales','equipment'),('sales','customers'),('sales','gantt'),('sales','jerry'),('sales','deals'),
  ('hr','dashboard'),('hr','org_chart'),('hr','forms'),('hr','employee_forms'),('hr','pto'),('hr','sick'),('hr','scheduling'),('hr','accrual'),('hr','employees'),('hr','jerry'),
  ('marketing','dashboard'),('marketing','presentations'),('marketing','jerry'),
  ('engineering','dashboard'),('engineering','submissions'),('engineering','tickets'),('engineering','equipment'),('engineering','gantt'),('engineering','jerry'),
  ('production_manager','dashboard'),('production_manager','tickets'),('production_manager','equipment'),('production_manager','gantt'),('production_manager','scheduling'),('production_manager','jerry')
ON CONFLICT (role, perm) DO NOTHING;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role ORDER BY role;
