-- ─────────────────────────────────────────────────────────────────────────────
-- 088_rfq_assignee_and_notes.sql — an owner for each quote request, and an
-- internal note trail that cannot be rewritten.
--
-- ── Why notes become a table ─────────────────────────────────────────────────
-- 087 gave rfq_requests a single `internal_notes` text column. One editable
-- textarea is a whiteboard: the last person to type wins, and there is no way to
-- tell who said what or when. Sales notes are the record of what we promised a
-- customer and why we priced it the way we did, so they get the same treatment
-- as ticket_notes — one row per note, append-only, attributed and stamped.
--
-- There is deliberately NO update or delete path in the app. A correction is a
-- new note; that is what makes the trail worth reading.
--
-- `internal_notes` is NOT dropped. Any text already in it is migrated into a
-- note below, and the column is left behind as a tombstone rather than removed:
-- dropping a column is irreversible, and this table already holds real customer
-- submissions. Drop it in a later migration once nothing has read it for a while.
--
-- ── Why the reminder timestamps live on the row ──────────────────────────────
-- The nudge job is a cron that re-runs daily against the same rows, so "have we
-- already chased this one?" has to survive between invocations. A column per
-- reminder kind, set when the mail goes out, is the whole idempotency story —
-- the same reason digest_runs exists for the admin digest (038).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rfq_requests
  -- Who owns getting this quoted. NOT a foreign key to employees/profiles: an
  -- assignment is a historical fact, and deleting an account must not blank the
  -- record of who was working it. assignee_name is a snapshot for the same
  -- reason (identical reasoning to ticket_notes.author_name in 054).
  ADD COLUMN IF NOT EXISTS assignee_id            uuid,
  ADD COLUMN IF NOT EXISTS assignee_name          text,
  ADD COLUMN IF NOT EXISTS assigned_at            timestamptz,
  -- Set when the "you have not started this" nudge is sent to the assignee.
  ADD COLUMN IF NOT EXISTS assignee_nudged_at     timestamptz,
  -- Set when the "nobody has picked this up" reminder goes to the shared desk.
  ADD COLUMN IF NOT EXISTS unclaimed_reminded_at  timestamptz;

-- The queue view and both reminder sweeps all filter on status + assignee.
CREATE INDEX IF NOT EXISTS rfq_requests_assignee_idx
  ON public.rfq_requests (assignee_id, status);
CREATE INDEX IF NOT EXISTS rfq_requests_unclaimed_idx
  ON public.rfq_requests (status, created_at)
  WHERE assignee_id IS NULL;

CREATE TABLE IF NOT EXISTS public.rfq_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CASCADE, unlike proposals→deals: a note is a comment ON this survey and is
  -- meaningless without it. Deleting the survey should not strand orphans.
  rfq_id      uuid NOT NULL REFERENCES public.rfq_requests(id) ON DELETE CASCADE,

  body        text NOT NULL,

  -- Snapshot of the author. author_id is who wrote it; author_name is how it is
  -- displayed ("Jacob Y.") and is frozen at write time, so deleting the account
  -- later cannot erase who said what.
  author_id   uuid,
  author_name text NOT NULL DEFAULT '',

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfq_notes_rfq_idx ON public.rfq_notes (rfq_id, created_at);

-- Service-role only, same as rfq_requests: every read and write goes through a
-- perm-gated route, never the browser client.
ALTER TABLE public.rfq_notes ENABLE ROW LEVEL SECURITY;

-- Carry over anything already typed into the old single-textarea column so no
-- existing note is lost when the UI switches to the trail.
INSERT INTO public.rfq_notes (rfq_id, body, author_name, created_at)
SELECT id, internal_notes, 'Imported', COALESCE(updated_at, created_at)
FROM public.rfq_requests
WHERE COALESCE(TRIM(internal_notes), '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.rfq_notes n WHERE n.rfq_id = public.rfq_requests.id);

COMMENT ON COLUMN public.rfq_requests.internal_notes IS
  'DEPRECATED by migration 088 — superseded by the rfq_notes table. Contents were '
  'migrated to a note. Kept as a tombstone; safe to drop once nothing reads it.';
