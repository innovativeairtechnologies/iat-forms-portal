-- 033_form_drafts.sql
-- Server-side "save & resume" for in-progress form fills, tied to the logged-in
-- user so a draft started on one device can be resumed on another. MULTIPLE drafts
-- per (user, form) are allowed on purpose — e.g. a manager part-way through several
-- performance reviews at once. Service-role only: the /api/drafts route resolves the
-- user from the session and scopes every read/write to user_id (mirrors the other
-- server-only tables; the browser client never touches this table directly).

create table if not exists form_drafts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  form_id       uuid not null references forms(id) on delete cascade,
  label         text,                                    -- e.g. the "Employee Name" answer, for the Resume list
  data          jsonb not null default '{}'::jsonb,      -- the in-progress answers (keyed by field label)
  current_step  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_form_drafts_user on form_drafts (user_id, updated_at desc);
create index if not exists idx_form_drafts_form on form_drafts (form_id);

alter table form_drafts enable row level security;
-- No policies on purpose: service-role (the /api/drafts route) bypasses RLS, and the
-- anon/authenticated browser client gets no direct access. Same posture as kb_*,
-- customers, etc.
