-- 091_close_submissions_anon_insert.sql
--
-- Close the last unauthenticated write path into the main database.
--
-- `submissions` carried TWO permissive INSERT policies, both `WITH CHECK (true)`:
--
--   * "Public insert submissions"  roles={public}
--   * "anon_insert_submissions"    roles={anon}
--
-- Either one let anybody holding the anon key write rows straight into the table
-- over the REST API. The anon key is not a secret -- it ships in the browser bundle
-- of every public page -- so this was effectively an open, unauthenticated,
-- unrate-limited insert endpoint. The {public} one was the wider of the two:
-- in Postgres `public` includes *authenticated* roles, so any logged-in account
-- (customers included, since they are still auth users in this project until the
-- Phase 2 split lands) could also write arbitrary submission rows.
--
-- These policies existed because the legacy standalone ticketing app needed anon
-- insert. That app was deleted 2026-08-03, so nothing needs them any more.
--
-- Nothing in the application is affected: every write path goes through
-- /api/submit and /api/tickets, which use the SERVICE ROLE client
-- (lib/supabase-admin.ts) and therefore bypass RLS entirely. The anon client
-- (lib/supabase.ts) is value-imported in exactly three places -- StepFormModal,
-- the /forms/[slug]/embed page and the /forms/[slug]/success page -- and all
-- three only READ `forms` / `form_fields`. The externally embeddable form posts
-- to /api/submit like every other form.
--
-- Dropping these forces all public writes through /api/submit, which is where
-- rate limiting (30 per 10 min), server-side field validation, and the
-- reject-draft-forms check actually live.
--
-- NOTE: `submissions` has no SELECT policy, so this was a write-only exposure --
-- an attacker could inject rows but never read them back. That stays true.

DROP POLICY IF EXISTS "Public insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "anon_insert_submissions"   ON public.submissions;

-- Belt and braces: RLS is already enabled, but assert it so a future restore
-- can't quietly bring the table back without row security.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
