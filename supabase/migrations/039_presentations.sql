-- ─────────────────────────────────────────────────────────────────────────────
-- 039_presentations.sql — the internal "Presentations" tool (admin-only)
--
-- A library of reusable *blocks* (Loom video clips + static slides) that an admin
-- assembles into a *presentation* (a build/deck) by drag-and-drop, then presents
-- live. See docs/presentations-tool-spec.md. Clips are hosted on Loom — the portal
-- stores only the share URL and embeds Loom's player; it hosts/streams no video.
--
-- Model: everything is a "block" (type = 'clip' | 'slide'); a slide is a block
-- with no video. Blocks are SHARED BY REFERENCE — a presentation's items point at
-- blocks rather than copying them, so fixing a clip updates every deck that uses
-- it. Ordering lives in presentation_items.position.
--
-- SECURITY: admin-only. All three tables have RLS enabled with NO policies — every
-- read/write goes through the service-role client (supabaseAdmin) behind an
-- admin-gated route/action, exactly like digest_runs (038) and other internal
-- tables. The slide-assets bucket is public-read (company logos on internal
-- slides — non-sensitive, and stable URLs keep present-mode rendering simple),
-- writes gated through admin routes.
--
-- Idempotent. Run by hand in the Supabase SQL editor before deploying the feature.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The library: one row per clip or slide ────────────────────────────────────
CREATE TABLE IF NOT EXISTS presentation_blocks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text        NOT NULL CHECK (type IN ('clip', 'slide')),
  title            text        NOT NULL,
  category         text,                              -- e.g. 'Fundamentals', 'Formulas', 'Products', 'Case studies', 'Other'
  tags             text[]      NOT NULL DEFAULT '{}',
  visibility       text        NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'client_safe')),

  -- clip-only (type = 'clip')
  loom_url         text,                              -- the Loom share URL as pasted
  thumbnail_url    text,
  duration_seconds integer,

  -- slide-only (type = 'slide')
  slide_template   text        CHECK (slide_template IN ('welcome', 'contact', 'divider', 'quote', 'blank')),
  slide_data       jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- { heading, subtext, background, logo_url, ... }

  created_by       uuid,                              -- auth user id of the admin who created it
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz,                       -- soft-delete: NULL = active in the library

  -- a clip must carry a Loom URL; a slide must carry a template (app enforces too)
  CONSTRAINT presentation_blocks_shape CHECK (
    (type = 'clip'  AND loom_url IS NOT NULL) OR
    (type = 'slide' AND slide_template IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS presentation_blocks_type_idx     ON presentation_blocks (type);
CREATE INDEX IF NOT EXISTS presentation_blocks_active_idx   ON presentation_blocks (archived_at);
CREATE INDEX IF NOT EXISTS presentation_blocks_tags_idx     ON presentation_blocks USING gin (tags);

-- ── The builds/decks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presentations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL DEFAULT 'Untitled presentation',
  status      text        NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'saved', 'archived')),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presentations_status_idx ON presentations (status);

-- ── Ordering: which blocks are in a deck, and in what order ────────────────────
CREATE TABLE IF NOT EXISTS presentation_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid        NOT NULL REFERENCES presentations (id)        ON DELETE CASCADE,
  block_id        uuid        NOT NULL REFERENCES presentation_blocks (id)  ON DELETE CASCADE,
  position        integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presentation_items_deck_idx ON presentation_items (presentation_id, position);

-- ── RLS: service-role only (no policies) ──────────────────────────────────────
ALTER TABLE presentation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_items  ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — all access via supabaseAdmin behind admin-gated code

-- ── Storage: small images for slides (logos), public-read ─────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('presentation-assets', 'presentation-assets', true, 5242880)  -- 5MB
on conflict (id) do update set public = true, file_size_limit = 5242880;

-- ── verify (run after applying) ───────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename LIKE 'presentation%';
--   SELECT id, public FROM storage.buckets WHERE id = 'presentation-assets';
