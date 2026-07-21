-- ─────────────────────────────────────────────────────────────────────────────
-- 060_kb_sharepoint_sync.sql — SharePoint ⇄ Jerry's Brain two-way sync (Pull half)
--
-- Adds the plumbing for pulling new documents from a SharePoint library into
-- Jerry's Brain, gated by the same human review as a manual upload:
--   • kb_sync_state    — the delta cursor per source ("what changed since last time")
--   • kb_review_queue  — documents read + scrubbed by the scheduled pull, waiting
--                        for a human to approve (never auto-published)
--   • kb_documents     — provenance columns so a published doc can be de-duped
--                        against future pulls (and so the anti-loop rule works)
--
-- SECURITY: service-role only (RLS enabled, NO policies) — same posture as
-- kb_documents / kb_chunks (migration 030). The pull runs server-side via the
-- service role; the browser/anon key can never read this.
--
-- Idempotent. Additive only — existing behavior is unchanged until the pull is
-- wired live. Nothing here publishes to Jerry; approval still goes through the
-- existing kb_documents / kb_chunks path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── provenance on published docs ─────────────────────────────────────────────
-- 'portal' = uploaded in Jerry's Brain, 'sharepoint' = pulled + approved,
-- 'cli' = the bulk loader, NULL = legacy/unknown (all existing rows).
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS source            text;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS sharepoint_item_id text;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS sharepoint_etag    text;

CREATE INDEX IF NOT EXISTS kb_documents_sp_item_idx
  ON kb_documents (sharepoint_item_id) WHERE sharepoint_item_id IS NOT NULL;

-- ── delta cursor ("what changed since last time") ────────────────────────────
CREATE TABLE IF NOT EXISTS kb_sync_state (
  source          text        PRIMARY KEY,       -- 'sharepoint'
  delta_link      text,                          -- opaque Graph deltaLink, resumed each run
  last_synced_at  timestamptz,
  last_result     text,                          -- short human note from the last run
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── review queue: read + scrubbed, awaiting a human OK ────────────────────────
CREATE TABLE IF NOT EXISTS kb_review_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL DEFAULT 'sharepoint',
  external_id   text,                            -- SharePoint driveItem id
  external_etag text,                            -- to detect a genuine change vs. a re-list
  filename      text        NOT NULL,
  title         text        NOT NULL,
  web_url       text,                            -- link back to the file in SharePoint
  detected_by   text,                            -- who added it in SharePoint (display name)
  transcript    text        NOT NULL,            -- Claude transcription, held until approval
  findings      jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- scrub report for the review card
  page_count    integer,
  chunk_estimate integer,
  status        text        NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   text
);

CREATE INDEX IF NOT EXISTS kb_review_queue_pending_idx
  ON kb_review_queue (created_at DESC) WHERE status = 'pending';

-- One pending row per SharePoint item (a re-poll updates, never duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS kb_review_queue_pending_uniq
  ON kb_review_queue (source, external_id) WHERE status = 'pending';

ALTER TABLE kb_sync_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_review_queue  ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (the pull + approval run server-side)
