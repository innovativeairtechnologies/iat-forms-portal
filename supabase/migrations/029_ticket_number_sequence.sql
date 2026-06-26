-- 029_ticket_number_sequence.sql
-- New ticket-number format: IAT-YYYY-NNNN (e.g. IAT-2026-0042).
-- Replaces the old TKT-<timestamp>-<random> scheme with a clean, sequential,
-- per-year number generated atomically so two tickets created at the same instant
-- can never collide.
--
-- The generator lives in the DB (not app code) so the increment is a single locked
-- statement. The app calls it via rpc('next_ticket_number', { p_year }).

-- Per-year counter. One row per calendar year; last_seq is the highest number issued.
create table if not exists public.ticket_counters (
  year     int  primary key,
  last_seq int  not null default 0
);

-- Counters are server-only — the app reaches them through the SECURITY DEFINER
-- function below using the service role. Lock the table to authenticated/anon.
alter table public.ticket_counters enable row level security;

-- Atomically reserve and return the next sequence number for the given year.
-- The first call of a new year seeds last_seq from any existing IAT-YYYY-#### rows
-- (e.g. tickets from the legacy standalone app), so new numbers always continue
-- ABOVE whatever is already in the table — no collisions with historical data.
create or replace function public.next_ticket_number(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.ticket_counters (year, last_seq)
  values (
    p_year,
    coalesce(
      (
        select max((regexp_replace(ticket_number, '^IAT-' || p_year || '-', ''))::int)
        from public.tickets
        where ticket_number ~ ('^IAT-' || p_year || '-[0-9]+$')
      ),
      0
    ) + 1
  )
  on conflict (year) do update
    set last_seq = public.ticket_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_seq;
end;
$$;
