-- ─────────────────────────────────────────────────────────────────────────────
-- 052_normalize_admin_display_name.sql — fix one mangled display name
--
-- WHY: employees.name is what every user-facing surface renders — the org chart,
-- the employee directory, Avatar initials in every admin list, the Tool Crib
-- holder column, and the actor_name snapshot that crib_events freezes into
-- permanent custody history. The admin account jacob.younker@dehumidifiers.com
-- carries name = 'jacob.younker', so the custody trail on IAT-0001 currently
-- reads "jacob.younker took it out", and initialsOf() renders a lone "J"
-- (components/admin/list.tsx splits on a literal space, and there isn't one).
--
-- ROOT CAUSE — a rule, not a typo. handle_new_user() (migration 001) sets:
--     coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
-- An account created BY HAND in the Supabase dashboard carries no
-- user_metadata.name, so its name silently becomes the email's local part.
-- Accounts created through the invite routes pass a real name and come out
-- clean. This predicts the live data exactly: the only three accounts with no
-- user_metadata.name are jacob.younker, crystal and lee.childers — the three
-- oldest hand-made ones, and the only three with a mangled name. The trigger is
-- deliberately left alone: dashboard account creation is rare and the invite
-- routes are the real path, so hardening it would be ceremony.
--
-- THIS IS NOT A DUPLICATE MERGE. There are four 'Jacob' rows in employees and
-- all four are DISTINCT auth accounts with distinct emails and distinct jobs:
--     jacob.younker@dehumidifiers.com   role=admin      43 logins  ← the daily
--                                                                    driver; the
--                                                                    only row
--                                                                    touched here
--     younk.jacob@gmail.com             no profiles row  8 logins  employee-portal
--                                                                  test account
--     iat@dehumidifiers.com             role=customer   16 logins  customer-portal
--                                                                  test (Shick)
--     marketing@dehumidifiers.com       role=customer    0 logins  customer-portal
--                                                                  test (PFENING)
-- Merging or deleting any of them would destroy real data — the gmail account
-- alone owns 3 time_off_requests and an accrual_log row, and employees.id is
-- referenced by crib_tools.held_by, crib_events, and employees.manager_id.
-- Offboarding is is_active = false (migration 013), never a DELETE.
--
-- BOTH COLUMNS, deliberately. profiles.display_name is a SEPARATE string that no
-- edit route keeps in sync with employees.name: /api/employees/[id] and
-- /api/employees/me whitelist 'name' only; /api/admin/profile writes
-- display_name only. Lee Childers is the standing proof — employees.name was
-- hand-corrected to 'Lee Childers' at some point while display_name still reads
-- 'lee.childers' to this day. The two render in different places:
-- employees.name on OTHER people's screens, display_name in the acting user's
-- own admin topbar and stamped into every audit_log actor string. Fixing one
-- alone just moves the wrong name somewhere else.
--
-- Keyed on EMAIL, not id: employees.email is UNIQUE, stable and readable, and a
-- reviewer can tell at a glance which human this touches. Idempotent — re-running
-- changes nothing.
--
-- DOES NOT rewrite history, BY DESIGN. crib_events.actor_name/subject_name are
-- immortal snapshots captured at write time (see the long note in 050), so the
-- four existing rows keep saying 'jacob.younker'. An audit trail that
-- retroactively rewrites itself is not an audit trail. New events record
-- 'Jacob Younker'; the live holder column on /admin/tool-crib joins through the
-- FK and updates immediately.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE employees
   SET name = 'Jacob Younker'
 WHERE email = 'jacob.younker@dehumidifiers.com';

UPDATE profiles
   SET display_name = 'Jacob Younker'
 WHERE id = (SELECT id FROM employees WHERE email = 'jacob.younker@dehumidifiers.com');


-- ── Verify (run after applying) ──────────────────────────────────────────────
--
-- 1. Both columns agree. MUST return exactly one row, both reading 'Jacob Younker'
--    — if display_name still says 'Jacob Y', the second UPDATE matched nothing:
--      SELECT e.name, p.display_name
--        FROM employees e JOIN profiles p ON p.id = e.id
--       WHERE e.email = 'jacob.younker@dehumidifiers.com';
--
-- 2. The other three Jacob accounts are UNTOUCHED. Expect 4 rows total, with
--    younk.jacob@gmail.com still 'jacob younker' (role NULL — it has no profiles
--    row, which is intentional) and both customer rows still 'Jacob Younker':
--      SELECT e.email, e.name, p.role
--        FROM employees e LEFT JOIN profiles p ON p.id = e.id
--       WHERE e.name ILIKE '%jacob%' ORDER BY e.created_at;
--
-- 3. History still says 'jacob.younker'. This is CORRECT, not a missed update —
--    do not "fix" it:
--      SELECT action, actor_name, created_at FROM crib_events ORDER BY created_at;
