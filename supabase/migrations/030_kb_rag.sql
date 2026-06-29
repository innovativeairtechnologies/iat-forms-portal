-- ─────────────────────────────────────────────────────────────────────────────
-- 030_kb_rag.sql  — Knowledge-pool for the customer AI Assistant (RAG, FTS POC)
--
-- "Feed the machine": IAT's documentation PDFs are ingested into a searchable pool
-- so the existing customer-portal AI Assistant (app/api/customer/assistant) can
-- RETRIEVE the most relevant excerpts and answer GROUNDED in them, WITH CITATIONS
-- (document + page). If nothing relevant is found it says it's not in the docs.
--
--   • kb_documents — one row per ingested source PDF (title, filename, category)
--   • kb_chunks    — page-sized text chunks with a generated tsvector for FTS
--   • match_kb_chunks() — ranked retrieval (websearch_to_tsquery + ts_rank_cd)
--
-- LEAN BY DESIGN: Postgres full-text search only — NO new vendor, NO embeddings
-- key. Semantic vector search (pgvector + an embeddings key) is the later quality
-- upgrade; a column is left for it (commented) so adding it is non-breaking.
--
-- SECURITY: service-role only (RLS enabled, NO policies) — like `customers` /
-- `equipment` (migration 026). Retrieval runs server-side via the service role,
-- which bypasses RLS. The browser/anon key can never read chunk text directly, so
-- internal/company docs (is_internal=true) and copyrighted manual text never leak.
--
-- This is the REUSABLE retrieval layer: an INTERNAL assistant can later call
-- match_kb_chunks(..., include_internal => true) against the same pool.
--
-- Idempotent. Run by hand in the Supabase SQL editor BEFORE running
-- scripts/ingest-kb-docs.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── kb_documents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,                 -- human title used in citations
  source_filename text        NOT NULL UNIQUE,          -- original PDF name; ingest key
  category        text,                                 -- e.g. 'Controls', 'Drives / VFD'
  is_internal     boolean     NOT NULL DEFAULT false,   -- true = excluded from the customer pool
  page_count      integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── kb_chunks ────────────────────────────────────────────────────────────────
-- One page may yield several chunks (long pages are split with small overlap).
-- `tsv` is GENERATED from `content` so ingest only inserts text — Postgres keeps
-- the search vector in sync. The two-arg to_tsvector(regconfig, text) form is
-- IMMUTABLE, which is what makes a STORED generated column legal here.
CREATE TABLE IF NOT EXISTS kb_chunks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index   integer     NOT NULL,                   -- 0-based order within the document
  page_number   integer     NOT NULL,                   -- 1-based PDF page, for citations
  content       text        NOT NULL,
  tsv           tsvector    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
  -- embedding  vector(1024),   -- FUTURE: semantic upgrade (pgvector). Not used by the FTS POC.
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx      ON kb_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS kb_chunks_document_idx ON kb_chunks (document_id, chunk_index);

ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks    ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (retrieval runs server-side)

-- ── match_kb_chunks() — ranked FTS retrieval (TF-IDF-style) ───────────────────
-- Returns the top excerpts for a natural-language question, best-ranked first,
-- joined to their document so the caller can cite (title + page). Customer-facing
-- callers pass include_internal => false (the default) so internal docs are hidden.
--
-- Plain FTS struggles with whole questions: requiring ALL terms (AND) usually
-- matches nothing, while ANY-term (OR) lets a common word ("set", "alarm") drag in
-- an unrelated manual that merely repeats it. So we score each chunk by the sum of
-- the INVERSE-DOCUMENT-FREQUENCY weights of the distinct question terms it
-- contains: a rare, distinctive term ("humidistat", "e5cn", "overcurrent") is
-- worth far more than a common one, so the document that actually covers the
-- question wins. Postgres FTS has no native IDF, so we compute it from the small
-- pool at query time (a handful of GIN lookups). Empty/stopword-only queries
-- produce no terms → no rows → the assistant says it's not in the documentation.
-- (Semantic vector search is the planned upgrade when keyword matching feels too
-- literal; this keeps the POC lean — no new vendor.)
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_text       text,
  match_limit      integer DEFAULT 6,
  include_internal boolean DEFAULT false
)
RETURNS TABLE (
  chunk_id        uuid,
  document_id     uuid,
  document_title  text,
  source_filename text,
  category        text,
  page_number     integer,
  content         text,
  rank            real
)
LANGUAGE sql STABLE
SET search_path = public      -- explicit + schema-qualified: silences Supabase's function_search_path_mutable linter
AS $$
  WITH ql AS (                                   -- the question reduced to its english lexemes
    SELECT tsvector_to_array(to_tsvector('english', query_text)) AS lex
  ),
  ndocs AS (                                     -- size of the visible pool (for IDF)
    SELECT count(*)::numeric AS n
    FROM public.kb_documents
    WHERE include_internal OR NOT is_internal
  ),
  terms AS (                                     -- each query term + how many docs contain it
    SELECT lexeme,
           plainto_tsquery('english', lexeme) AS tq,
           (SELECT count(DISTINCT c2.document_id)
              FROM public.kb_chunks c2
              JOIN public.kb_documents d2 ON d2.id = c2.document_id
             WHERE c2.tsv @@ plainto_tsquery('english', lexeme)
               AND (include_internal OR NOT d2.is_internal)) AS df
    FROM ql, unnest(ql.lex) AS lexeme
  ),
  scored AS (                                    -- sum IDF weights of the distinct terms each chunk has
    SELECT c.id, c.document_id, c.page_number, c.content,
           sum( ln((n.n + 1.0) / (t.df + 1.0)) + 0.1 ) AS score
    FROM terms t
    CROSS JOIN ndocs n
    JOIN public.kb_chunks c ON c.tsv @@ t.tq
    WHERE t.df > 0
    GROUP BY c.id, c.document_id, c.page_number, c.content
  )
  SELECT
    s.id,
    s.document_id,
    d.title,
    d.source_filename,
    d.category,
    s.page_number,
    s.content,
    s.score::real AS rank
  FROM scored s
  JOIN public.kb_documents d ON d.id = s.document_id
  WHERE include_internal OR NOT d.is_internal
  ORDER BY s.score DESC, s.document_id, s.page_number
  LIMIT GREATEST(coalesce(match_limit, 6), 1);
$$;

-- Lock the function down to the service role (callers run server-side). Even if it
-- were exposed, RLS on the tables returns nothing to anon/authenticated anyway.
REVOKE ALL ON FUNCTION match_kb_chunks(text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_kb_chunks(text, integer, boolean) TO service_role;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public' AND tablename IN ('kb_documents','kb_chunks');
--   -- after ingest:
--   SELECT d.title, count(*) FROM kb_chunks c JOIN kb_documents d ON d.id=c.document_id
--    GROUP BY d.title ORDER BY 2 DESC;
--   SELECT document_title, page_number, left(content, 80), rank
--     FROM match_kb_chunks('reset the humidistat', 5);
