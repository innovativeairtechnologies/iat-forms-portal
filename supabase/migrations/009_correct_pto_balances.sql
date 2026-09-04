-- Migration 009: Correct PTO/sick balances to Rem. Bal from "Employee Time 2026.xlsx"
-- Migration 008 loaded opening balances (column 3). This replaces them with the
-- current remaining balances (column 60, "Rem. Bal") as of the 2026-08-31→09-06 export.
-- Kacy Orr is the owner and carries no AT balance by policy (0.00 is correct).
-- Employees not yet in the portal (no account) are not listed here; they will be
-- updated on first sign-in or via a future migration once their accounts exist.

update public.employees set pto_balance=318.88, sick_balance=215.44 where lower(trim(name))='crystal hill';
update public.employees set pto_balance=117.18, sick_balance=108.68 where lower(trim(name))='devon morgan';
update public.employees set pto_balance=46.24,  sick_balance=108.14 where lower(trim(name))='jacob reagan';
update public.employees set pto_balance=25.12,  sick_balance=29.28  where lower(trim(name))='jacob younker';
update public.employees set pto_balance=122.68, sick_balance=215.44 where lower(trim(name))='james pope';
update public.employees set pto_balance=13.80,  sick_balance=47.86  where lower(trim(name))='jo evans';
update public.employees set pto_balance=12.88,  sick_balance=27.72  where lower(trim(name))='lee childers';
update public.employees set pto_balance=24.36,  sick_balance=32.34  where lower(trim(name))='mike payton';
update public.employees set pto_balance=12.47,  sick_balance=18.18  where lower(trim(name))='tyler bell';
