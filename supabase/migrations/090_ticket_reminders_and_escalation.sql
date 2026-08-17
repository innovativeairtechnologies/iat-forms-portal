-- ─────────────────────────────────────────────────────────────────────────────
-- 090_ticket_reminders_and_escalation.sql — stop a support ticket going quiet,
-- and tell leadership when one has.
--
-- Quote requests got chased from 088; support tickets never were. A ticket could
-- sit unassigned indefinitely, or sit assigned to someone who had forgotten it,
-- and nothing in the system noticed. The sweeps that fix that are the same shape
-- as the RFQ ones, so the columns are too — deliberately, because a second
-- differently-named idiom for the same idea is how the next person gets it wrong.
--
-- ── Why timestamps rather than a flag ───────────────────────────────────────
-- These sweeps are crons: they re-run daily against the same rows, so "have we
-- already chased this one?" has to survive between invocations. A column per
-- reminder kind, stamped when mail goes out and checked before the next send, is
-- the whole idempotency story. An in-memory flag does not outlive a serverless
-- invocation. Identical reasoning to 088 and to digest_runs (038).
--
-- ── Why assigned_at is separate from an audit trail ─────────────────────────
-- The assignee nudge asks "has this been touched since it became theirs?", which
-- needs the moment of assignment as a value on the row. It is reconstructible
-- from the audit log, but a reminder sweep that has to reduce an event stream to
-- answer a yes/no question is a sweep that will be slow and then wrong.
-- Backfilled below for rows that already have an owner; see the note on that
-- statement for what the first sweep will do with them.
--
-- ── escalated_at is on BOTH tables ──────────────────────────────────────────
-- The leadership escalation covers tickets and quote requests together — one
-- message about everything nobody has picked up, rather than two lists that have
-- to be mentally merged. Each table therefore needs its own stamp.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tickets
  -- When the current owner got it. NOT a foreign key and NOT nulled on reassign:
  -- it answers "how long has this been someone's problem", which is a fact about
  -- this assignment, not about the person.
  ADD COLUMN IF NOT EXISTS assigned_at            timestamptz,
  -- Stamped when the "you own this and nothing has happened" nudge is sent.
  ADD COLUMN IF NOT EXISTS assignee_nudged_at     timestamptz,
  -- Stamped when the "nobody has picked this up" reminder goes to the desk.
  ADD COLUMN IF NOT EXISTS unclaimed_reminded_at  timestamptz,
  -- Stamped when leadership is told this is 24h old and still unassigned.
  ADD COLUMN IF NOT EXISTS escalated_at           timestamptz;

ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS escalated_at           timestamptz;

-- Every sweep filters on status + owner, and the unassigned ones scan by age.
CREATE INDEX IF NOT EXISTS tickets_owner_status_idx
  ON public.tickets (owner_id, status);
CREATE INDEX IF NOT EXISTS tickets_unclaimed_idx
  ON public.tickets (status, created_at)
  WHERE owner_id IS NULL;

-- Backfill: an existing assigned ticket has no assignment moment recorded, and a
-- NULL would either fire the nudge for every one of them on the first run or
-- never fire at all, depending on how the comparison is written.
--
-- `tickets` has no updated_at column — unlike rfq_requests — so created_at is the
-- only timestamp available. That means every already-assigned ticket is treated
-- as having been assigned when it was raised, and the ones genuinely sitting
-- untouched will fire on the first sweep. That is the correct outcome: those are
-- exactly the tickets this feature exists to surface. It is a one-time burst, and
-- the nudge groups by owner so nobody receives more than one email from it.
UPDATE public.tickets
SET assigned_at = created_at
WHERE owner_id IS NOT NULL AND assigned_at IS NULL;

COMMENT ON COLUMN public.tickets.assigned_at IS
  'When the current owner_id was set. Read by lib/ticket-reminders.ts to decide whether an '
  'assigned ticket has gone untouched. Backfilled by migration 090 for pre-existing rows.';
COMMENT ON COLUMN public.tickets.escalated_at IS
  'When leadership was told this ticket was 24h old and unassigned. Re-escalates after '
  'ESCALATE_REPEAT_HOURS; see lib/ticket-reminders.ts.';
