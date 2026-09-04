-- ═══════════════════════════════════════════════════════════════════
-- Migration 008: Opening balances + HR role grants
-- Source: HR spreadsheet "Employee Time 2026.xlsx", 2026 sheet
-- Run once in the Supabase SQL editor (after migrations 001–007)
-- ═══════════════════════════════════════════════════════════════════

-- ── PTO & sick opening balances ──────────────────────────────────
-- Matched by name (case-insensitive trim). Only eligible IAT employees
-- from the spreadsheet — those marked "not an IAT employee" are skipped.
-- Safe to re-run: rows that don't exist are silently unaffected.

update public.employees set pto_balance = 240,    sick_balance = 160    where lower(trim(name)) = 'crystal hill';
update public.employees set pto_balance = 240,    sick_balance = 160    where lower(trim(name)) = 'kyle dickerson';
update public.employees set pto_balance = 240,    sick_balance = 160    where lower(trim(name)) = 'eli kelly';
update public.employees set pto_balance = 240,    sick_balance = 25.26  where lower(trim(name)) = 'chris miller';
update public.employees set pto_balance = 129.73, sick_balance = 146.24 where lower(trim(name)) = 'chris hill';
update public.employees set pto_balance = 109.52, sick_balance = 160    where lower(trim(name)) = 'james pope';
update public.employees set pto_balance = 240,    sick_balance = 30.24  where lower(trim(name)) = 'jeremy reis';
update public.employees set pto_balance = 111.74, sick_balance = 53.24  where lower(trim(name)) = 'devon morgan';
update public.employees set pto_balance = 11.03,  sick_balance = 6.24   where lower(trim(name)) = 'tyler bell';
update public.employees set pto_balance = 91.24,  sick_balance = 0      where lower(trim(name)) = 'robin lamb';
update public.employees set pto_balance = 23.36,  sick_balance = 49.92  where lower(trim(name)) = 'jo evans';
update public.employees set pto_balance = 17.40,  sick_balance = 14.16  where lower(trim(name)) = 'bill jackson';
update public.employees set pto_balance = 32.66,  sick_balance = 8.42   where lower(trim(name)) = 'chris green';
update public.employees set pto_balance = 7.80,   sick_balance = 52.70  where lower(trim(name)) = 'jacob reagan';
update public.employees set pto_balance = 12.56,  sick_balance = 25.64  where lower(trim(name)) = 'tommy hill';
update public.employees set pto_balance = 11.20,  sick_balance = 0      where lower(trim(name)) = 'jarrad ragan';
update public.employees set pto_balance = 3.10,   sick_balance = 0      where lower(trim(name)) = 'austin fitts';
update public.employees set pto_balance = 3.10,   sick_balance = 0      where lower(trim(name)) = 'anthony wyant';

-- ── Ledger entries for opening balances ──────────────────────────
-- One manual_adjustment entry per employee per type so the accrual log
-- shows where the opening numbers came from, not just that they changed.

insert into public.accrual_log (employee_id, type, hours_delta, reason, note)
select e.id, 'pto', e.pto_balance, 'manual_adjustment',
       'Opening balance — HR spreadsheet 2026-09-04'
from public.employees e
where lower(trim(e.name)) in (
  'crystal hill','kyle dickerson','eli kelly','chris miller','chris hill',
  'james pope','jeremy reis','devon morgan','tyler bell','robin lamb',
  'jo evans','bill jackson','chris green','jacob reagan','tommy hill',
  'jarrad ragan','austin fitts','anthony wyant'
)
and e.pto_balance > 0;

insert into public.accrual_log (employee_id, type, hours_delta, reason, note)
select e.id, 'sick', e.sick_balance, 'manual_adjustment',
       'Opening balance — HR spreadsheet 2026-09-04'
from public.employees e
where lower(trim(e.name)) in (
  'crystal hill','kyle dickerson','eli kelly','chris miller','chris hill',
  'james pope','jeremy reis','devon morgan','tyler bell','robin lamb',
  'jo evans','bill jackson','chris green','jacob reagan','tommy hill',
  'jarrad ragan','austin fitts','anthony wyant'
)
and e.sick_balance > 0;

-- ── HR role: Jo Evans, Crystal Hill, Kacy ─────────────────────────
-- Crystal Hill is already in the spreadsheet. Jo Evans likewise.
-- "Kacy" — only first name given; match the first word of name.

update public.profiles
set role = 'hr'
where id in (
  select id from public.employees
  where lower(trim(name)) in ('jo evans', 'crystal hill')
     or lower(trim(name)) like 'kacy %'
     or lower(trim(name)) = 'kacy'
);

-- ── Grant `reports` permission to the `hr` role ───────────────────
-- role_permissions is the live source of truth once seeded (see migration 045).
-- Lets HR users reach /admin/reports where the time-off report lives.

insert into role_permissions (role, perm)
values ('hr', 'reports')
on conflict (role, perm) do nothing;
