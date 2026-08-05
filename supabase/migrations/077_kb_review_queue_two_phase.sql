-- ─────────────────────────────────────────────────────────────────────────────
-- 077_kb_review_queue_two_phase.sql — split DISCOVERY from READING in the
-- SharePoint pull.
--
-- WHY: the first live pull timed out (Vercel 504 after 300s). One request was
-- downloading AND Claude-transcribing up to 12 PDFs; the library averages 2.2MB
-- per PDF with several 10-24MB manuals, so a single request could not finish —
-- and because each queue insert happens after its own transcription, NOT ONE
-- document was saved. Five minutes of work, nothing to show.
--
-- The fix is architectural, not a smaller batch: a big manual can exceed the
-- limit on its own, so the unit of work has to be ONE document per request.
--   • discovery  — delta + metadata only, no AI. Fast, handles the whole library.
--   • reading    — one document per request: download, transcribe, scrub.
--
-- So a queue row now exists BEFORE it has a transcript:
--   transcript IS NULL + analyzed_at IS NULL  → discovered, not yet read
--   transcript present + analyzed_at set      → read, awaiting human review
--   analyze_error set                         → we tried and it failed (visible,
--                                               retryable, and never blocks the rest)
--
-- Idempotent. Additive. The existing unique index (source, external_id) WHERE
-- status='pending' still prevents duplicates across both phases.
-- ─────────────────────────────────────────────────────────────────────────────

-- A discovered row has no transcript yet.
ALTER TABLE kb_review_queue ALTER COLUMN transcript DROP NOT NULL;

-- When the document was actually read (NULL = discovered but unread).
ALTER TABLE kb_review_queue ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

-- Why a read failed (too many pages, unreadable scan, download error…). Kept on
-- the row so a bad document is visible and retryable instead of silently absent.
ALTER TABLE kb_review_queue ADD COLUMN IF NOT EXISTS analyze_error text;

-- Captured at discovery so the UI can warn about big files before spending AI
-- budget, and so the reader knows what it's fetching.
ALTER TABLE kb_review_queue ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE kb_review_queue ADD COLUMN IF NOT EXISTS mime_type text;

-- Unread-first ordering for the "read the next one" loop.
CREATE INDEX IF NOT EXISTS kb_review_queue_unread_idx
  ON kb_review_queue (created_at) WHERE status = 'pending' AND analyzed_at IS NULL;
