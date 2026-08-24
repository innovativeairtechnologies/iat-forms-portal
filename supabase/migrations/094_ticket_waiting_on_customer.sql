-- ─── "Waiting on Customer" ticket status ─────────────────────────────────────
--
-- Adds a fifth ticket status for work that is genuinely parked on the customer:
-- we have asked them something and cannot proceed until they answer.
--
-- Why a real status rather than a flag: it has to be visible in the queue and it
-- has to STOP the existing chase. lib/ticket-reminders.ts nudges the owner of any
-- ticket in LIVE_STATUSES that has been quiet for 24h — a ticket parked on the
-- customer would otherwise nag its owner every day for something they cannot do
-- anything about, which is how people learn to ignore the nudge entirely.
--
-- ⚠️ `tickets.status` is guarded by a CHECK constraint, not a Postgres enum, and
-- the tickets table predates this migration folder — so the original constraint
-- body is not in the repo. Confirmed empirically on 2026-08-24 by PATCHing a
-- throwaway row, which returned:
--
--   23514 — new row for relation "tickets" violates check constraint
--           "tickets_status_check"
--
-- The constraint is therefore dropped by name and rebuilt with the full set. The
-- four existing values are listed verbatim; anything writing a value outside this
-- list was already failing before this migration.
--
-- No new column is needed. "How long has it been waiting?" is derived from
-- audit_log in lib/ticket-history.ts, exactly as close times already are — see
-- the note there about that being a DERIVED, not guaranteed, source.

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'));

-- The waiting sweep scans for one status and orders by nothing else, so the
-- existing (owner_id, status) index from migration 090 already covers it. No new
-- index.

COMMENT ON CONSTRAINT tickets_status_check ON public.tickets IS
  'Staff-owned ticket lifecycle. waiting_on_customer added 2026-08-24 (094): parked on the customer, excluded from the owner-nudge sweep, auto-resolved after 14 days by lib/ticket-waiting.ts.';
