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
Before the Claude call it retrieves the top ~10 chunks for the question (built from
the last few user turns, so follow-ups keep context; the wider window catches a
specific answer page that keyword/IDF ranks just outside the top few), injects them as a labeled
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
- `cleanText()` strips **NUL + other C0 control characters** before insert — some
  CID/Adobe-Japan1-font PDFs make `pdftotext` emit a NUL, which Postgres `text`
  rejects ("unsupported Unicode escape sequence") and would otherwise drop the
  whole document. (This is what was silently losing `PXR3.pdf`.)
- **Internal/company docs** (Core Values, Aptitude Test, Terms, Paint, MSDS, and
  the customer **References** list, which holds other customers' contact PII) are
  marked `is_internal=true` so they never surface in the customer pool, even under `--all`.
- **Titles for citations** come from `TITLE_MAP` (vendor-named, taken from each
  PDF's own header — Belimo / Vaisala / Watlow / Johnson Controls / GE / Fuji /
  Honeywell / Setra / TAMCO…); anything not in the map falls back to a tidied
  filename. True duplicates are given identical titles so the chips collapse.

## Pool status (all-80 ingest — 2026-06-29)
- Pool: **58 documents, ~3,164 chunks** (the full IAT documentation folder run with
  `--all`, after pruning 6 duplicate source files). 5 are `is_internal=true` (hidden
  from customers).
- **16 PDFs are image-only/scanned** (no extractable text — they WARN and skip on
  ingest; need OCR to include): `A1094 Manual`, `E5CN Temp Controller Manual (Omron)`
  *(a scanned dup of the text `E5CN Manual` that did ingest)*, `Actuator LF24-MFT-S`,
  `Actuator TF120`, `Fasco Model D215`, `Fasco PN 71625928`, `GEH Series Transmitter`,
  `HS-70-D`, `MMSQPL`, `Paint`, `SCR (EZ1) Phasetronics`, `Technical-Specification-EDC`,
  `Terms Certifigroup-MET Labs`, `ZWN030X6D Cond Unit Manual`,
  `iPak Humidity-Temp Transmitter GEH2-D-TT2`, `motors`. OCR is the future fix.
- **Duplicate source files were pruned** (6 of them) via the `SKIP_DOCS` set in the
  ingest script, so `--all` no longer re-adds them and a topic returns one chip, not
  several: the **Watlow DIN-A-MITE Style C** manual (kept `DC  SCR Manual.pdf`, dropped
  the two `SCR  DC20-60F0-0000…` copies); **GE HumiTrac XR** (kept `DP4A.pdf`); **GE
  Sensing HumiTrac** (kept `GEH2-D-TT2.pdf`); **KAS** actuator (kept `KAS-44-88-175-install.pdf`);
  and the **Fuji PXR4/5/9** manual (kept the full `PXR459_manual.pdf`, dropped the condensed).
- Proven end-to-end on new-doc topics: "Belimo actuator wiring" → Belimo LF guide,
  "Vaisala humidity transmitter output" → Vaisala HMD/HMW, "SCR power controller
  setup" → Watlow DIN-A-MITE, "Compact IOM startup" → IAT Compact IOM, "desiccant
  rotor maintenance" → Rotor Source manual. Internal/PII docs (incl. `References`)
  confirmed not retrievable on the default customer call.

## Scaling & upgrades
- **Re-ingest after changing the folder / maps:** `node scripts/ingest-kb-docs.mjs --all`.
- **Internal assistant:** point a new server-side caller at `retrieveChunks(q, { includeInternal: true })`.
- **OCR the 16 image-only PDFs** (e.g. `ocrmypdf`/Tesseract → searchable text layer,
  then re-ingest) to fold them into the pool.
- **Semantic search:** add the `embedding` column + an embeddings key and blend
  vector similarity with the FTS score — the quality upgrade when keyword search is too literal.

## Ops / deploy
- Apply `supabase/migrations/030_kb_rag.sql` by hand in the Supabase SQL editor
  (DDL — done 2026-06-29), then run the ingest script. No new env vars.
- Verify: `SELECT document_title, page_number FROM match_kb_chunks('reset the humidistat', 5);`
