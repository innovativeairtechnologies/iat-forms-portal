-- ─────────────────────────────────────────────────────────────────────────────
-- 078_kb_push_to_sharepoint.sql — Phase 2 groundwork: Jerry → SharePoint (Push)
--
-- Phase 1 pulls SharePoint → Jerry. This is the other direction: a document
-- uploaded and approved in Jerry's Brain is filed back into the SharePoint
-- library, so the two sides hold the same set of documents whichever door a
-- file came in through.
--
-- THE BLOCKER THIS FIXES: pushing means uploading the ORIGINAL file — SharePoint
-- should hold the real PDF, not Jerry's AI transcript. The bytes were already
-- being kept (nothing deletes from the kb-uploads bucket), but the storage path
-- was generated, used once, and thrown away: an opaque `<timestamp>-<random>.pdf`
-- with no column linking a kb_documents row back to it. So the originals exist
-- and are unreachable. `storage_path` closes that gap going forward.
--
-- Applies to NEW uploads only. The 68 legacy documents predate this and their
-- originals cannot be reliably matched (random names, no filename in the path);
-- the 2 sharepoint-sourced documents must never be pushed back at all.
--
-- Push state lives here too, so a failed upload is visible and retryable rather
-- than silently absent — the lesson from the pull half, applied up front.
--
-- Idempotent. Additive. Nothing here grants write access or pushes anything;
-- it only records where a document came from and where it went.
-- ─────────────────────────────────────────────────────────────────────────────

-- Where the original bytes live in the kb-uploads bucket. NULL for legacy rows
-- and for sharepoint-sourced rows (whose original is already in SharePoint).
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS storage_path text;

-- The MIME type the file was uploaded as — needed to upload it back correctly.
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS storage_mime text;

-- Push outcome. pushed_at set on success; push_error records why it failed so a
-- document can be retried instead of quietly never arriving.
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS pushed_at    timestamptz;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS push_error   text;

-- The folder the admin chose at approval time (a Graph folder id, plus its name
-- for display). NULL means the library root. Stored per document so the choice
-- survives a retry and is auditable after the fact.
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS push_folder_id   text;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS push_folder_name text;

-- Find what still needs pushing: portal-sourced, has an original, not yet sent.
-- Deliberately excludes sharepoint-sourced rows — pushing one back is the echo
-- loop the whole design exists to prevent.
CREATE INDEX IF NOT EXISTS kb_documents_pending_push_idx
  ON kb_documents (created_at)
  WHERE pushed_at IS NULL AND storage_path IS NOT NULL AND source IS DISTINCT FROM 'sharepoint';
