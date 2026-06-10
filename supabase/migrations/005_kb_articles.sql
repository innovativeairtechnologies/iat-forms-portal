-- ─────────────────────────────────────────────────────────────────────────────
-- 005_kb_articles.sql
-- Knowledge Base articles — backend for the customer ticket status page and the
-- (future) public Knowledge Base section on /support.
--
-- The ticket status page matches published articles to a customer's ticket using
-- the article's `category` and `tags` (see lib/kb.ts). Front-end display of the
-- KB is intentionally deferred until real article content exists; this table and
-- the matching API are ready so it can be switched on by simply adding rows.
--
-- To add starter content, see scripts/sql/kb_articles_seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  excerpt       TEXT,                      -- short one-line summary, shown in lists
  body          TEXT,                      -- full article (markdown/html)
  category      TEXT,                      -- e.g. 'Cooling', 'Airflow', 'Temperature'
  tags          TEXT[]      NOT NULL DEFAULT '{}',  -- keywords used to match tickets
  is_published  BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes for matching/listing
CREATE INDEX IF NOT EXISTS kb_articles_category_idx ON kb_articles (category);
CREATE INDEX IF NOT EXISTS kb_articles_tags_idx     ON kb_articles USING GIN (tags);

ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous customers) may read PUBLISHED articles.
-- The status API uses the service-role key (bypasses RLS) but this policy lets
-- the front-end read articles directly once the KB section ships.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kb_articles' AND policyname = 'kb_articles_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY kb_articles_public_read ON kb_articles FOR SELECT USING (is_published = true)';
  END IF;
END $$;

-- Service role retains full access for admin management (implicit; service role
-- bypasses RLS). No additional policy required.
