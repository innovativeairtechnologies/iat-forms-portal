-- ─────────────────────────────────────────────────────────────────────────────
-- 058_company_home.sql — the shared company intranet home page (/home)
--
-- WHY: the SharePoint intranet home (company news, birthdays, calendar, new hires,
-- open roles, suggestions) is being rebuilt inside the portal so every internal
-- user lands on it first after login. This migration adds the ONE new employees
-- column the home needs (birthday) plus the editorial content tables the home
-- cards read from. People-derived cards (anniversaries, newest hire, who's-out)
-- come from existing tables (employees.hire_date, time_off_requests) — nothing new.
--
-- READ PATH: the /home server component reads every table below through the
-- service-role client (lib/supabase-admin), which BYPASSES RLS. When a table is
-- empty (or this migration hasn't run yet) the page falls back to the seeded
-- defaults in lib/home-content.ts, so /home is never blank. Authoring a row here
-- OVERRIDES the code default for that card — this is the "CMS with defaults" seam.
--
-- Run by hand in the Supabase SQL editor. Idempotent — safe to re-run.
-- Does NOT touch role_permissions, so it does not affect scripts/check-perm-seed.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── employees.birthday ───────────────────────────────────────────────────────
-- Powers the "Birthdays" half of the Birthdays & Anniversaries card. Only the
-- month/day are ever read (the year is ignored), but a full `date` is the natural
-- type and lets HR paste real DOBs. Nullable — most rows will stay null and simply
-- not appear in the card.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birthday date;

-- ── announcements — the "Company News" feed ──────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text,
  category     text,                                  -- free-form label: 'news' | 'safety' | 'event' | 'it' …
  pinned       boolean NOT NULL DEFAULT false,        -- one featured item floats to the top
  published_at timestamptz NOT NULL DEFAULT now(),    -- the date shown on the card
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_published_idx ON announcements (pinned DESC, published_at DESC);

-- ── company_events — the "Company Calendar" list ─────────────────────────────
-- Company-specific dated items only (visits, all-hands, trainings, closures).
-- Federal holidays are computed in code (lib/home-data.ts) — no need to seed them.
CREATE TABLE IF NOT EXISTS company_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  starts_on   date NOT NULL,
  ends_on     date,                                   -- null = single-day
  kind        text NOT NULL DEFAULT 'event',          -- 'event' | 'holiday' | 'training' | 'visit' | 'closure'
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_events_starts_idx ON company_events (starts_on);

-- ── job_openings — the "Open Positions" list ─────────────────────────────────
CREATE TABLE IF NOT EXISTS job_openings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  department      text,
  location        text,
  employment_type text,                               -- 'Full-time' | 'Part-time' | 'Contract'
  description     text,
  apply_url       text,                               -- external link OR a mailto: — null = no apply link
  is_open         boolean NOT NULL DEFAULT true,
  sort            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_openings_open_idx ON job_openings (is_open, sort);

-- ── employee_spotlights — "Employee Spotlight" + "New Employee" welcome ───────
-- A curated pointer at an employees row plus editorial copy. kind='spotlight' is
-- the highlighted colleague; kind='welcome' overrides the auto-derived newest-hire
-- card when HR wants to write a real welcome. active=false retires one without
-- deleting it. When no active row exists the home derives both cards from
-- employees (newest hire_date) / falls back to the code default.
CREATE TABLE IF NOT EXISTS employee_spotlights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'spotlight',      -- 'spotlight' | 'welcome'
  headline    text,                                   -- e.g. "Fabrication Team Lead" or "Welcome, Marcus!"
  blurb       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_spotlights_active_idx ON employee_spotlights (kind, active, created_at DESC);

-- ── company_suggestions — the "Submit a Suggestion" inbox ────────────────────
-- Insert path is a server action (lib service role). A private inbox: only admins
-- read it (via the service role); there is deliberately no authenticated SELECT.
CREATE TABLE IF NOT EXISTS company_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- null once the account is deleted
  name         text,                                 -- display name captured at submit; blank = anonymous
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'new',          -- 'new' | 'reviewed' | 'archived'
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_suggestions_created_idx ON company_suggestions (created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- The home page and the admin editor read/write through the SERVICE ROLE
-- (supabaseAdmin), which bypasses RLS — so these tables need NO permissive
-- anon/authenticated SELECT policy, and granting one would LEAK internal content.
-- Every customer invite creates an authenticated Supabase session (see
-- lib/staff.ts), so a "TO authenticated USING (true)" SELECT would let a logged-in
-- CUSTOMER read internal company news / calendar / openings / spotlights straight
-- from PostgREST — the exact internal content /home is meant to keep from them.
-- So: enable RLS with NO SELECT policy (same lock-down as company_suggestions),
-- and only allow an authenticated user to INSERT a suggestion.
ALTER TABLE announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_openings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop the permissive SELECT policies an earlier draft of this migration created.
-- Idempotent: no-ops on a fresh run; on a DB where the earlier draft already ran,
-- this REMOVES the customer-readable exposure. (See the deploy note in
-- docs/company-home.md — run these DROPs by hand if 058 was already applied.)
DROP POLICY IF EXISTS announcements_read       ON announcements;
DROP POLICY IF EXISTS company_events_read      ON company_events;
DROP POLICY IF EXISTS job_openings_read        ON job_openings;
DROP POLICY IF EXISTS employee_spotlights_read ON employee_spotlights;

-- Suggestions: authenticated may INSERT their own (or an anonymous) suggestion.
-- No SELECT policy → the inbox is invisible to everyone except the service role.
DROP POLICY IF EXISTS company_suggestions_insert ON company_suggestions;
CREATE POLICY company_suggestions_insert ON company_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() OR submitted_by IS NULL);
