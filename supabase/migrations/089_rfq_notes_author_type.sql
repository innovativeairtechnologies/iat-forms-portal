-- ─────────────────────────────────────────────────────────────────────────────
-- 089_rfq_notes_author_type.sql — tell a customer's message apart from a sales
-- note, now that both land in the same trail.
--
-- 088 created rfq_notes as a purely INTERNAL trail: every row was written by a
-- signed-in staff member through a perm-gated route, so "who wrote this" only
-- ever needed a name. The card above it still says "Not visible to the customer",
-- which was true of every row in the table.
--
-- It is no longer true. /support/status now lets a customer add a message to
-- their own quote request — the same write-back tickets have had since the
-- confirmation emails started saying "do not reply" — and that message belongs on
-- the trail rather than in a second list nobody reconciles.
--
-- Without this column the two are indistinguishable. A sales note and a customer
-- message would render identically, differing only by a name the reader has to
-- recognise, and the "internal" label would quietly become a lie about half the
-- rows. Worse in the direction that matters: someone skims the trail, mistakes a
-- customer's words for a colleague's, and replies as if the customer cannot see
-- what was said around it.
--
-- DEFAULT 'staff' is what makes this safe to apply ahead of the code: every
-- existing row, and every row the admin route writes, is correctly labelled
-- without touching either. Only the new public endpoint passes 'customer'.
--
-- No index. The trail is fetched whole, one survey at a time, and these lists are
-- a handful of rows — a second index would cost writes and buy nothing.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rfq_notes
  ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'staff';

-- Idempotent: ADD CONSTRAINT has no IF NOT EXISTS, so guard on the catalogue.
-- Constrained rather than left free text because the UI branches on this value —
-- an unexpected third value would silently render as a staff note, which is the
-- exact confusion the column exists to prevent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfq_notes_author_type_check'
  ) THEN
    ALTER TABLE public.rfq_notes
      ADD CONSTRAINT rfq_notes_author_type_check
      CHECK (author_type IN ('staff', 'customer'));
  END IF;
END $$;

COMMENT ON COLUMN public.rfq_notes.author_type IS
  'Who wrote the note: staff (default, written via the perm-gated admin route) or '
  'customer (written via the public /api/rfq/status/message endpoint, which proves '
  'ownership with reference + email). Hardcoded per route, never read from a request body.';
