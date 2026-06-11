-- 006_form_approvals.sql
-- Adds a super-admin tier and a one-time approval gate for new forms.
--
-- WHY: New forms (manual "+ New Form" and "Build with AI") must be approved by a
-- super admin before they can go live, so no single admin can spin up live forms
-- unchecked. Approval is required ONCE (the first time a form goes live); after
-- that, regular admins can pause/unpause freely.
--
-- HOW TO RUN: paste into the Supabase SQL editor (project dsbuhdjlkgwcghskvdse)
-- and run. Safe to re-run (idempotent). Run this BEFORE deploying the matching
-- app code — it is additive, so the currently-live app keeps working in between.

-- 1. Super-admin flag on the login/role table (sits on TOP of role='admin').
alter table profiles
  add column if not exists is_super_admin boolean not null default false;

-- 2. Approval state on forms.
--    approval_status: 'pending' (default for new forms) | 'approved'
alter table forms
  add column if not exists approval_status text not null default 'pending';
alter table forms
  add column if not exists approved_by uuid;          -- profiles.id / auth user id of the approver
alter table forms
  add column if not exists approved_at timestamptz;

-- 3. Grandfather every EXISTING form as approved, so nothing already built
--    disappears or gets blocked. (New inserts default to 'pending' going forward.)
update forms
  set approval_status = 'approved',
      approved_at = coalesce(approved_at, now())
  where approval_status <> 'approved';

-- 4. Make Jacob's admin account a super admin (the designated approver).
--    profiles.id matches the Supabase Auth user id; look it up by email.
update profiles
  set is_super_admin = true
  where id = (select id from auth.users where email = 'jacob.younker@dehumidifiers.com');

-- Sanity checks (optional — uncomment to verify after running):
-- select id, role, is_super_admin from profiles where is_super_admin;
-- select approval_status, count(*) from forms group by approval_status;
