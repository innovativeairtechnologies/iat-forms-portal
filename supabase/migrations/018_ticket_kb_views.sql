-- ─────────────────────────────────────────────────────────────────────────────
-- 018_ticket_kb_views.sql
-- Track which Knowledge Base articles a customer viewed before submitting a
-- support ticket, so the support team can see what documentation the customer
-- already tried before the call.
--
-- The customer is anonymous on /support, so views are recorded client-side
-- (browser localStorage, see lib/kb-views.ts) and attached to the ticket payload
-- on submit. The API (app/api/tickets/route.ts) validates the slugs against
-- published kb_articles and stores the authoritative records here.
--
-- Shape: JSONB array of
--   { slug, title, first_viewed_at, last_viewed_at, count }
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS viewed_kb_articles JSONB;

COMMENT ON COLUMN tickets.viewed_kb_articles IS
  'KB articles the customer viewed before submitting (array of {slug,title,first_viewed_at,last_viewed_at,count}). Recorded client-side, validated against kb_articles on insert.';
