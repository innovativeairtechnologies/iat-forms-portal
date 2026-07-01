-- ─────────────────────────────────────────────────────────────────────────────
-- 037_ticket_notes_visibility.sql — shared customer/admin reply thread on tickets
--
-- Lets a logged-in customer open one of their own tickets at
-- /customer/tickets/[id] and see a reply thread shared with IAT staff — but
-- ONLY notes an admin has explicitly opted into showing the customer (or notes
-- the customer themselves wrote). Every note written before this migration
-- must stay invisible to customers: no retroactive exposure of historical
-- internal admin notes.
--
--   • ticket_notes.visibility   — 'internal' | 'public'
--       DEFAULT 'internal' so every existing row (and any future row inserted
--       by code that doesn't know about this column yet) stays admin-only
--       unless an admin explicitly flips a NEW note to 'public' ("Reply to
--       customer" toggle in TicketDetailClient). This is the sole visibility
--       gate enforced server-side in GET /api/tickets/[id]/notes and in the
--       customer ticket-detail page query — never trust client input for it.
--   • ticket_notes.author_type  — 'admin' | 'customer'
--       DEFAULT 'admin' (matches all pre-existing rows, which were only ever
--       written by the admin-only notes route). A customer-authored note is
--       forced to author_type='customer' + visibility='public' server-side in
--       POST /api/tickets/[id]/notes — the client can never set either field
--       when posting as a customer.
--
-- Also adds tickets.preferred_contact_method so a customer can tell IAT how
-- they'd like to be reached (their existing customer_phone is editable from
-- the same "Contact" card via a dedicated customer-only PATCH route).
--
-- SECURITY: no RLS policy changes here — ticket_notes/tickets access continues
-- to run exclusively through service-role API routes (lib/ticket-access.ts
-- resolves admin-vs-owning-customer and the routes apply the visibility
-- filter explicitly). This migration only adds columns/index, it does not
-- grant any new table-level access.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ticket_notes
  ADD COLUMN IF NOT EXISTS visibility  text NOT NULL DEFAULT 'internal',  -- internal | public
  ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'admin';     -- admin | customer

-- Belt-and-suspenders: guarantee no legacy row can slip through with a NULL in
-- either column even if the ADD COLUMN default didn't backfill in some edge
-- case (e.g. a column that already existed without a default).
UPDATE ticket_notes SET visibility  = 'internal' WHERE visibility  IS NULL;
UPDATE ticket_notes SET author_type = 'admin'    WHERE author_type IS NULL;

-- Speeds up the customer-facing query (GET notes filtered to
-- ticket_id + visibility='public').
CREATE INDEX IF NOT EXISTS ticket_notes_visibility_idx ON ticket_notes (ticket_id, visibility);

-- Customer-editable contact preference, shown/edited on the ticket detail page.
-- tickets.customer_phone already exists on the base tickets table.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS preferred_contact_method text; -- 'email' | 'phone'

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--    WHERE table_name='ticket_notes' AND column_name IN ('visibility','author_type');
--   SELECT indexname FROM pg_indexes WHERE tablename='ticket_notes';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='tickets' AND column_name='preferred_contact_method';
--   SELECT visibility, author_type, count(*) FROM ticket_notes GROUP BY 1, 2; -- expect all pre-existing rows internal/admin
