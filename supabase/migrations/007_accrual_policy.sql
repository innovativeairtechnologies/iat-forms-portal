-- ═══════════════════════════════════════════════════════════════════
-- Migration 007: Accrual policy — tenure tiers + global config
-- Run once in the Supabase SQL editor (after migrations 001–006)
-- ═══════════════════════════════════════════════════════════════════

-- ── accrual_tiers ─────────────────────────────────────────────────
-- PTO tenure bands. Boundaries are in completed years (min inclusive,
-- max exclusive; null max = no upper bound).
create table public.accrual_tiers (
  id                int  primary key generated always as identity,
  label             text not null,
  min_tenure_years  int  not null check (min_tenure_years >= 0),
  max_tenure_years  int,                    -- null = 10+ (no ceiling)
  pto_weekly_rate   numeric(6,4) not null,  -- hours accrued per week
  sort_order        int  not null default 0
);

-- ── accrual_config ────────────────────────────────────────────────
-- Single-row global settings (sick rate is flat across all tenures).
create table public.accrual_config (
  id               int          primary key default 1,
  sick_weekly_rate numeric(6,4) not null default 1.54,
  pto_cap_hours    numeric(8,2) not null default 240,
  sick_cap_hours   numeric(8,2) not null default 160,
  constraint accrual_config_single_row check (id = 1)
);

-- ── Seed: PTO tiers from HR spreadsheet ───────────────────────────
insert into public.accrual_tiers
  (label, min_tenure_years, max_tenure_years, pto_weekly_rate, sort_order)
values
  ('< 1 yr',   0,  1,    1.16, 1),
  ('1–4 yrs',  1,  5,    1.54, 2),
  ('5–9 yrs',  5,  10,   2.31, 3),
  ('10+ yrs',  10, null, 3.08, 4);

-- ── Seed: global config ───────────────────────────────────────────
-- Sick time is flat 1.54 hrs/wk for all tenures; caps from HR sheet
insert into public.accrual_config (id, sick_weekly_rate, pto_cap_hours, sick_cap_hours)
values (1, 1.54, 240, 160)
on conflict (id) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────
alter table public.accrual_tiers  enable row level security;
alter table public.accrual_config enable row level security;

create policy "accrual_tiers_select_admin"
  on public.accrual_tiers for select
  using (
    exists (select 1 from public.employees e where e.id = auth.uid() and e.is_admin = true)
  );

create policy "accrual_config_select_admin"
  on public.accrual_config for select
  using (
    exists (select 1 from public.employees e where e.id = auth.uid() and e.is_admin = true)
  );

-- ── Test data: Jacob Y (younk.jacob@gmail.com) ────────────────────
-- Hire date derived from Excel serial 46048 → 2026-01-26
-- PTO balance set to 10 hrs for testing; runs 0 rows if user not yet created
update public.employees
set hire_date    = '2026-01-26',
    pto_balance  = 10,
    sick_balance = 0
where email = 'younk.jacob@gmail.com';
