-- ─────────────────────────────────────────────────────────────────────────────
-- 053 — Resync employees.is_admin from profiles.role (the authoritative column).
--
-- WHY THIS EXISTS
-- `profiles.role` is the only source of truth for access. `employees.is_admin` is
-- a denormalized copy with exactly two writers (/api/employees/invite,
-- /api/admin/users/[id]/role). Every doc warned the copy *could* drift. As of
-- 2026-07-16 it HAS drifted, live, and was measured against prod:
--
--   jacob.younker@dehumidifiers.com   is_admin = false, profiles.role = 'admin'
--   jacob@dehumidifiers.com           is_admin = false, profiles.role = 'admin'
--
-- Both are real admins. The predicted third path is exactly what happened: an
-- account created or promoted BY HAND in the Supabase dashboard skips both
-- writers, and `is_admin` keeps its `default false` (migration 001).
--
-- The drift is in the SAFE direction — under-grant, not over-grant. Zero rows
-- have is_admin = true with a non-admin role, so the copy never handed anyone
-- access they lacked. It DENIED two admins things instead (admin digests, new
-- ticket / PTO notifications, ticket ownership — all fixed in code the same day
-- by re-sourcing those from profiles.role).
--
-- WHY RESYNC RATHER THAN DROP THE COLUMN
-- No application code reads is_admin any more. The RLS policies still do —
-- migrations 001 (employees, time_off_requests, accrual_log), 007 (accrual_log)
-- and 022 (us_rotors_orders) all gate on
--   exists (select 1 from employees e where e.id = auth.uid() and e.is_admin = true)
-- so Postgres refuses to DROP the column while they depend on it, AND those
-- policies are currently WRONG for the two rows above: at the RLS layer, Jacob's
-- own daily-driver account is not an admin. That's latent (every server read uses
-- the service-role key and bypasses RLS) but it is real.
--
-- This migration is the STOPGAP: it makes the copy correct today. The actual fix
-- is rewriting those policies to join profiles.role = 'admin' and then dropping
-- the column — tracked as a follow-up, deliberately not bundled here because it
-- touches live RLS on four tables.
--
-- Safe to re-run (idempotent — it converges on profiles.role, changing nothing
-- once they agree). Read the verify block's BEFORE query first.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── BEFORE: what's about to change (run this first, keep the output) ─────────
-- select e.id, e.name, e.email, e.is_admin, p.role
-- from public.employees e
-- left join public.profiles p on p.id = e.id
-- where e.is_admin is distinct from (p.role = 'admin')
-- order by e.name;

-- ── The resync ──────────────────────────────────────────────────────────────
-- Both directions, from profiles.role. An employees row with NO profiles row
-- resolves to role null → is_admin false: correct, and it matches the app, where
-- normalizeRole(null) holds no permission. (One employee-portal test account is
-- legitimately in that state — see docs/roles-and-permissions.md.)
update public.employees e
set    is_admin = coalesce(p.role = 'admin', false)
from   public.profiles p
where  p.id = e.id
  and  e.is_admin is distinct from coalesce(p.role = 'admin', false);

-- Rows with no matching profile at all (the join above can't reach them).
update public.employees e
set    is_admin = false
where  e.is_admin = true
  and  not exists (select 1 from public.profiles p where p.id = e.id);

-- ── VERIFY (must return zero rows) ──────────────────────────────────────────
-- select e.id, e.name, e.email, e.is_admin, p.role
-- from public.employees e
-- left join public.profiles p on p.id = e.id
-- where e.is_admin is distinct from coalesce(p.role = 'admin', false);
--
-- And the admin roster the RLS policies now see (expect 6 as of 2026-07-16:
-- lee.childers, kacy, jacob.younker, crystal, jacob, mike):
-- select name, email from public.employees where is_admin = true order by name;
