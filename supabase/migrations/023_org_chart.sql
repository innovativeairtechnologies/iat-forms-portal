-- ─────────────────────────────────────────────────────────────────────────────
-- 023_org_chart.sql  — interactive org chart: reporting hierarchy on employees
--
-- The org chart is derived live from the employees table, so adding or removing
-- an employee automatically updates the chart — there's no separate roster to
-- keep in sync. This migration adds the few columns the chart needs directly to
-- `employees`:
--
--   manager_id   — who this person reports to (self-FK). NULL = top of the org.
--   interests    — text tags shown on the employee's profile card.
--   org_visible  — the permission-gated "erase": hide someone from the chart
--                  without deleting the employee. Non-destructive, reversible.
--   org_sort     — optional left-to-right ordering among siblings.
--
-- All columns are nullable / defaulted, so this is additive and safe on the live
-- table — existing rows and queries are unaffected. Reads/writes for the chart go
-- through server code (service role + getAdminUser gate), so no new RLS policies
-- are required for the admin view. An employee-facing read view would add a
-- SELECT policy later. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.employees
  add column if not exists manager_id  uuid references public.employees(id) on delete set null,
  add column if not exists interests   text[] not null default '{}',
  add column if not exists org_visible boolean not null default true,
  add column if not exists org_sort    integer;

-- Fast lookups of a manager's direct reports (the chart's core query).
create index if not exists employees_manager_id_idx on public.employees(manager_id);

-- Guard rail: a person cannot report to themselves. (Deeper cycle prevention is
-- enforced in app code when a manager is reassigned.)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_no_self_manager'
  ) then
    alter table public.employees
      add constraint employees_no_self_manager
      check (manager_id is null or manager_id <> id);
  end if;
end $$;
