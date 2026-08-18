-- 092_ticket_number_serial.sql
-- Ticket-number format changes from IAT-YYYY-NNNN to IAT-SSSS-NNNN, where SSSS is
-- the last four characters of the unit's serial number and NNNN is a running count.
-- Customers quote the serial on every ticket now, so putting it in the number lets
-- staff see which unit a ticket is about without opening it.
--
-- WHY THE COUNTER IS GLOBAL RATHER THAN PER-YEAR (this is the load-bearing part):
--
-- 029 used a per-year counter, which was safe only because the YEAR was in the
-- number. The year is gone now, so a counter that resets every January would
-- reissue IAT-4821-0007 in 2027 after issuing it in 2026. tickets.ticket_number is
-- UNIQUE, so the second one would not create a duplicate — it would FAIL TO INSERT,
-- and a customer filing a support request would get an error and lose it.
--
-- So: uniqueness comes ENTIRELY from NNNN, which never resets. SSSS is human
-- context, not a key. It cannot be one — two units can share their last four
-- digits, and one unit can file many tickets. Anything that treats SSSS as
-- identifying is wrong.

-- A sequence rather than a counter table: nextval is atomic without an explicit
-- lock, and it cannot be accidentally reset by an UPDATE the way a row can.
create sequence if not exists public.ticket_number_seq as integer start with 1;

-- Seed above every number already issued. Without this, a unit whose serial ends
-- "2026" could be handed IAT-2026-0003 and collide with a legacy IAT-2026-0003.
-- Matching on the trailing group only, so legacy rows and the 5-digit timestamp
-- fallback numbers are both accounted for.
do $$
declare
  v_max int;
begin
  select coalesce(max((regexp_replace(ticket_number, '^.*-', ''))::int), 0)
    into v_max
    from public.tickets
   where ticket_number ~ '^IAT-[0-9]+-[0-9]+$';

  -- is_called = false so the very next nextval() returns v_max + 1 itself.
  perform setval('public.ticket_number_seq', v_max + 1, false);
end $$;

-- Returns int, not bigint: PostgREST renders int8 in a way the client would have to
-- narrow, and the app checks `typeof seq === 'number'`. We will not issue two
-- billion tickets.
create or replace function public.next_ticket_seq()
returns int
language sql
security definer
set search_path = public
as $$
  select nextval('public.ticket_number_seq')::int;
$$;

-- next_ticket_number(p_year) from 029 is deliberately left in place. Dropping it in
-- the same deploy as the code change would break ticket creation for the seconds
-- between the migration landing and the new build going live.
