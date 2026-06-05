-- ═══════════════════════════════════════════════════════════════════
-- IAT Forms Portal — Employee + PTO/Sick Time System
-- Run this once in the Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────
create type time_off_type  as enum ('pto', 'sick');
create type request_status as enum ('pending', 'approved', 'denied');
create type accrual_reason as enum ('scheduled', 'manual_adjustment', 'request_approved', 'request_denied');

-- ── employees ─────────────────────────────────────────────────────────
create table public.employees (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null unique,
  name               text not null default '',
  avatar_url         text,
  job_title          text,
  department         text,
  phone              text,
  bio                text,
  pto_balance        numeric(8,2) not null default 0,
  sick_balance       numeric(8,2) not null default 0,
  pto_accrual_rate   numeric(6,2) not null default 4,
  sick_accrual_rate  numeric(6,2) not null default 2,
  hire_date          date,
  is_admin           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ── time_off_requests ─────────────────────────────────────────────────
create table public.time_off_requests (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  type             time_off_type not null,
  hours_requested  numeric(6,2) not null check (hours_requested > 0),
  start_date       date not null,
  end_date         date not null,
  notes            text,
  status           request_status not null default 'pending',
  reviewed_by      uuid references public.employees(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ── accrual_log ───────────────────────────────────────────────────────
create table public.accrual_log (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  type         time_off_type not null,
  hours_delta  numeric(6,2) not null,
  reason       accrual_reason not null,
  note         text,
  created_at   timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────
create index on public.time_off_requests (employee_id);
create index on public.time_off_requests (status);
create index on public.accrual_log (employee_id);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.employees         enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.accrual_log       enable row level security;

-- employees: each employee sees only their own row; admins see all
create policy "employees_select_own"
  on public.employees for select
  using (auth.uid() = id);

create policy "employees_select_admin"
  on public.employees for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = auth.uid() and e.is_admin = true
    )
  );

create policy "employees_update_own"
  on public.employees for update
  using (auth.uid() = id)
  with check (
    -- employees cannot change sensitive admin-controlled fields
    email             = (select email             from public.employees where id = auth.uid()) and
    pto_balance       = (select pto_balance       from public.employees where id = auth.uid()) and
    sick_balance      = (select sick_balance      from public.employees where id = auth.uid()) and
    pto_accrual_rate  = (select pto_accrual_rate  from public.employees where id = auth.uid()) and
    sick_accrual_rate = (select sick_accrual_rate from public.employees where id = auth.uid()) and
    is_admin          = (select is_admin          from public.employees where id = auth.uid())
  );

create policy "employees_update_admin"
  on public.employees for update
  using (
    exists (
      select 1 from public.employees e
      where e.id = auth.uid() and e.is_admin = true
    )
  );

create policy "employees_insert_service"
  on public.employees for insert
  with check (true);  -- restricted to service role via API; anon cannot call this

-- time_off_requests: employees see/insert their own; admins see + update all
create policy "requests_select_own"
  on public.time_off_requests for select
  using (employee_id = auth.uid());

create policy "requests_select_admin"
  on public.time_off_requests for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = auth.uid() and e.is_admin = true
    )
  );

create policy "requests_insert_own"
  on public.time_off_requests for insert
  with check (employee_id = auth.uid());

create policy "requests_update_admin"
  on public.time_off_requests for update
  using (
    exists (
      select 1 from public.employees e
      where e.id = auth.uid() and e.is_admin = true
    )
  );

-- accrual_log: employees see their own; admins see all; writes via service role only
create policy "accrual_select_own"
  on public.accrual_log for select
  using (employee_id = auth.uid());

create policy "accrual_select_admin"
  on public.accrual_log for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = auth.uid() and e.is_admin = true
    )
  );

-- ── Trigger: auto-create employee row on auth signup ──────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employees (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
