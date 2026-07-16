-- ─────────────────────────────────────────────────────────────────────────────
-- 051_role_perms_tools.sql — seed the 'tools' grants migration 045 left out
--
-- WHY: lib/roles.ts DEFAULT_ROLE_PERMS has granted 'tools' (the /admin/tools
-- field-app launcher — duct traverse, calculators) to all five scoped roles
-- since the perm was introduced, but 045 seeded role_permissions WITHOUT a
-- single 'tools' row. That mismatch silently granted nothing: once the table
-- holds ANY rows, lib/permissions.getPermMatrix() seeds every scoped role to []
-- and then fills from the DB, so matrix[role] is always a non-null array — which
-- means hasPermission()'s `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never
-- falls through to the code default. Middleware's own per-role read behaves the
-- same way. The code list is ONLY the fallback for an errored/empty table, so
-- the grant existed in code and nowhere else: the Tools sidebar entry stayed
-- hidden and /admin/tools 302'd back to /admin for every scoped role.
--
-- ENGINEERING IS ALREADY CORRECT IN PROD and is intentionally re-listed below.
-- It holds 'tools' today only because it was granted BY HAND from
-- /admin/permissions on 2026-07-14 (audit_log: "Granted Tools & Apps to
-- Engineering"), which is why that one role could reach the launcher while the
-- other four could not. ON CONFLICT makes its row a no-op here, but including it
-- keeps this seed a faithful mirror of DEFAULT_ROLE_PERMS — so a fresh or
-- rebuilt database (where that manual grant does not exist) reproduces the
-- intended state, and so scripts/check-perm-seed.mjs can prove the two agree.
--
-- Confirmed with Jacob 2026-07-16 that all five roles SHOULD hold 'tools': a
-- plethora of per-department tools are planned, so the launcher stays open to
-- every department rather than being narrowed to Engineering.
--
-- GUARDRAIL: scripts/check-perm-seed.mjs now asserts DEFAULT_ROLE_PERMS and the
-- role_permissions seed INSERTs across these migrations agree. This whole class
-- of bug — edit the code list, forget the migration, silently grant nothing —
-- now fails loudly instead of shipping.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO role_permissions (role, perm) VALUES
  ('sales','tools'),
  ('hr','tools'),
  ('marketing','tools'),
  ('engineering','tools'),
  ('production_manager','tools')
ON CONFLICT (role, perm) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role ORDER BY role;
--     -- every scoped role EXCEPT `production` must now include tools
--
--   -- expect 5 rows (sales, hr, marketing, engineering, production_manager):
--   SELECT role FROM role_permissions WHERE perm = 'tools' ORDER BY role;
