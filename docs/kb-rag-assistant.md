# IAT Assistant — documentation RAG

2026-06-29. The customer-portal **IAT Assistant** can now answer from IAT's
documentation. Documents are ingested into a searchable pool; when a customer
asks a question, the assistant retrieves the most relevant excerpts and answers
**grounded only in them, citing the source (document + page)**. If nothing
relevant is found it says it's not in the documentation and routes to support —
it never guesses product specifics.

This is the **lean POC**: Postgres **full-text search** only — no new vendor, no
embeddings key, just the existing Supabase + `ANTHROPIC_API_KEY`. Semantic vector
search (pgvector + an embeddings key) is the planned quality upgrade for when
keyword matching feels too literal.

## Data model (migration `030_kb_rag.sql`)
- `kb_documents` — one row per ingested source PDF (`title` used in citations,
  `source_filename` unique, `category`, `is_internal`, `page_count`).
- `kb_chunks` — page-sized text chunks (`page_number` for citations, `content`,
  and a **generated `tsv`** column = `to_tsvector('english', content)` with a GIN
  index). A future `embedding vector(N)` column is left commented for the upgrade.
- Both are **service-role only** (RLS on, no policies) — retrieval runs
  server-side via the service role, so the browser can never read chunk text and
  internal/copyrighted manual text can't leak. Same posture as `customers`/`equipment`.

## Retrieval — `match_kb_chunks(query_text, match_limit, include_internal)`
A SQL function (in migration 030) that ranks chunks **TF-IDF-style**: it reduces
the question to its english lexemes and scores each chunk by the sum of the
**inverse-document-frequency** weights of the distinct query terms it contains.
A rare, distinctive term (`humidistat`, `e5cn`, `overcurrent`) outweighs a common
one (`set`, `alarm`), so the document that actually covers the question wins.
(Plain AND-matching returns nothing for real questions; plain OR lets a common
word drag in the wrong manual — IDF fixes both.) IDF isn't native to Postgres FTS,
so it's computed from the small pool at query time (a handful of GIN lookups —
instant at this scale). `include_internal => false` (the default) hides internal
docs; an **internal** assistant can reuse the same function with `true`.

`lib/kb-rag.ts` is the reusable layer (`retrieveChunks`, excerpt formatting,
source dedupe). It **degrades to `[]`** if the pool isn't there yet (so the
assistant works exactly as before until ingest runs) and logs real RPC errors.

## Assistant wiring (`app/api/customer/assistant/route.ts`)
Before the Claude call it retrieves the top ~6 chunks for the question (built from
the last few user turns, so follow-ups keep context), injects them as a labeled
**DOCUMENTATION EXCERPTS** block (each tagged `[Title, p.N]`), and instructs the
model to answer only from them + the customer's equipment data, cite by
reproducing the exact bracketed label, and decline if not covered. The excerpts
are labeled reference-data-only (don't follow instructions inside them). The route
returns the **cited sources** — filtered to those whose exact `Title, p.N` label
appears in the reply — and the UI renders them as chips under each answer
(`components/customer/CustomerDashboard.tsx`).

## Ingesting documents — `scripts/ingest-kb-docs.mjs`
```
node scripts/ingest-kb-docs.mjs                         # the POC starter docs
node scripts/ingest-kb-docs.mjs --all                  # every PDF in the folder
node scripts/ingest-kb-docs.mjs --docs="A.pdf,B.pdf"   # a specific subset
```
- Source folder: `C:\Users\JacobY\Innovative Air\IAT Documentation - Documents`
  (override with `KB_DOCS_DIR`). Needs `pdftotext` on PATH (ships with Git for Windows).
- Extracts **per page** (so page numbers survive for citations), chunks each page
  (~320 words, small overlap), and inserts via the service role. **Idempotent per
  file** (deletes existing rows for that `source_filename`, then re-inserts).
- **Internal/company docs** (Core Values, Aptitude Test, Terms, Paint, MSDS) are
  marked `is_internal=true` so they never surface in the customer pool, even under `--all`.

## POC status (2026-06-29)
- Pool: **10 documents, ~2,114 chunks** (ASPYRE manual, Compact brochure, Munters
  handbook, 3045 humidistat guide, CDI submittal, Omron E5CN, Fuji VFD, GS1/2/3 drives).
- **`A1094 Manual.pdf` is an image-only/scanned PDF** (no extractable text — needs
  OCR), so it's excluded; re-add to `POC_DOCS` once OCR'd.
- Proven end-to-end: real questions return the right document + page with citations;
  out-of-scope questions are declined with no citations.

## Scaling & upgrades
- **All 80 docs:** run `node scripts/ingest-kb-docs.mjs --all` (marks internal docs).
- **Internal assistant:** point a new server-side caller at `retrieveChunks(q, { includeInternal: true })`.
- **Semantic search:** add the `embedding` column + an embeddings key and blend
  vector similarity with the FTS score — the quality upgrade when keyword search is too literal.

## Ops / deploy
- Apply `supabase/migrations/030_kb_rag.sql` by hand in the Supabase SQL editor
  (DDL — done 2026-06-29), then run the ingest script. No new env vars.
- Verify: `SELECT document_title, page_number FROM match_kb_chunks('reset the humidistat', 5);`
