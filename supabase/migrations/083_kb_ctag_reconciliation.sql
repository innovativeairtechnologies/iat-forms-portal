-- ─────────────────────────────────────────────────────────────────────────────
-- 081_kb_ctag_reconciliation.sql — detect SharePoint edits, and make a duplicate
-- identity impossible rather than merely unlikely.
--
-- TWO GAPS, both raised in IT's Phase 2 review and both real:
--
-- 1. AN EDIT IN SHAREPOINT NEVER REACHED JERRY. Discovery treated "already
--    known" as "nothing to do" (`files.filter(f => !seen.has(f.id))`), so a
--    document was ingested once and then frozen: correct a figure in the manual
--    upstream and Jerry would keep answering from the old text indefinitely,
--    with nothing to indicate it was stale. Reconciliation is now three-way —
--    new, content-changed, unchanged — keyed on the content tag.
--
--    cTag rather than eTag, deliberately: SharePoint bumps eTag on metadata
--    edits too (a renamed file, an updated column), so keying on it would
--    re-transcribe documents whose text never changed — real AI spend for no
--    new knowledge. cTag moves only when the content does.
--
-- 2. A DUPLICATE IDENTITY COULD PASS SILENTLY. The index on sharepoint_item_id
--    was not unique, so two rows claiming the same SharePoint item — the
--    signature of a push that got stamped twice, or a crash between upload and
--    stamp — would simply coexist and Jerry would cite one document twice. A
--    unique index turns that into a loud, catchable failure.
--
-- Idempotent. Additive.
-- ─────────────────────────────────────────────────────────────────────────────

-- Content tag of the version currently published to Jerry.
ALTER TABLE kb_documents   ADD COLUMN IF NOT EXISTS sharepoint_ctag text;
-- Content tag observed at discovery, carried through review to the published row.
ALTER TABLE kb_review_queue ADD COLUMN IF NOT EXISTS external_ctag  text;

-- One published document per SharePoint item. Partial, so the many portal-only
-- documents (NULL item id) are unaffected.
--
-- Created only when the data already satisfies it: if duplicates somehow exist,
-- a failed migration would be a worse outcome than the duplicates themselves —
-- it would block every later migration. Instead the constraint is skipped and
-- the condition reported, so it can be cleaned up deliberately.
DO $$
DECLARE dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT sharepoint_item_id FROM kb_documents
    WHERE sharepoint_item_id IS NOT NULL
    GROUP BY sharepoint_item_id HAVING count(*) > 1
  ) d;

  IF dupes = 0 THEN
    DROP INDEX IF EXISTS kb_documents_sp_item_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS kb_documents_sp_item_uniq
      ON kb_documents (sharepoint_item_id) WHERE sharepoint_item_id IS NOT NULL;
  ELSE
    RAISE WARNING 'Skipped the unique index: % SharePoint item id(s) are claimed by more than one document. Resolve those rows, then re-run this migration.', dupes;
  END IF;
END $$;
