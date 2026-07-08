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

## Feeding the brain — "Jerry's Brain" upload page (2026-07-08)
A page where staff **drag-and-drop documents straight into the RAG pool** — the
"Doc-Ock reactor": feed it a doc, Jerry learns it. `/admin/knowledge` (admin-only,
perm `knowledge`; `components/admin/KnowledgeReactorClient.tsx`) shows an animated
desiccant-wheel reactor that grows with the pool, and the live list of everything
Jerry knows.

Flow (reuses the Submittal-scanner pattern, so no local binaries). **Two phases
with a human SCRUB PREVIEW gate between them — nothing enters the pool without
approval:**
1. `POST /api/admin/kb/upload-url` → a signed upload URL; the browser uploads the
   file **directly** to the private `kb-uploads` bucket (bypasses Vercel's ~4.5MB
   body limit).
2. **Analyze** — `POST /api/admin/kb/analyze` downloads it server-side, has
   **Claude (`claude-sonnet-4-6`) transcribe it** to page-delimited text (vision-
   based, so **scanned/image docs work too** — no `pdftotext`/OCR binary), then
   runs a **scrub analysis**: competitor names (authoritative local check against
   `COMPETITOR_NAMES` + the model flagging other HVAC brands), plus emails, phone
   numbers, customer-company and person names (model; component suppliers
   excluded). Returns the transcript + findings + a summary; deletes the storage
   object; **writes nothing to the pool**. A failed analysis degrades to
   local-findings-only rather than blocking.
3. **Review card** (client) — shows what the doc is, what was found (competitor
   names shown struck-through as "removed automatically"; PII/customer names as
   amber flags), and the **visibility choice**: *Staff only* (`is_internal=true`,
   default) vs *Customer-facing* — with a warning when choosing customer-facing
   on a doc with flagged names/contacts. Approve or Discard. Multiple files queue
   ("1 of N").
4. **Commit** — `POST /api/admin/kb/ingest` takes the approved transcript back,
   chunks it via `lib/kb-chunking.mjs` (`buildChunks` runs the **unconditional
   competitor scrub** — the preview is a gate on top, not instead), and inserts
   into `kb_documents` / `kb_chunks`. Idempotent per filename (re-feeding
   replaces).
5. `GET /api/admin/kb/documents` lists the pool (+ a head count of total chunks the
   reactor sizes on); `DELETE /api/admin/kb/documents/[id]` forgets a doc (chunks
   cascade).

- **The page is a full-screen scene:** the desiccant-wheel reactor sits alone
  mid-page (tilts toward the mouse, ambient emerald motes drifting, charges while
  reading, absorb-pulses on commit, grows with the pool); the explainer, live
  activity, stats, and the full document inventory live in a collapsible
  **"Jerry's knowledge" panel pinned top-right**. All animation honors
  `prefers-reduced-motion`.
- **Bucket `kb-uploads`** was provisioned programmatically (private) — **no migration
  and no manual Storage step**. Verified end-to-end against the live pool: a
  synthesized policy doc was uploaded → transcribed → chunked → inserted →
  retrieved by the internal assistant, and confirmed absent from the customer pool.
- The CLI `scripts/ingest-kb-docs.mjs` remains the **bulk** loader for the doc
  folder; this page is for **ad-hoc additions**. Both now share the pool and the
  competitor scrub; chunking logic is duplicated in the script (kept working) but
  centralized in `lib/kb-chunking.mjs` for the serverless path.

## Attachments — photo/PDF diagnosis (internal Jerry, 2026-07-08)
The **internal** Jerrys (the standalone `/admin/jerry` page and the per-ticket
assistant) let a staff member **attach a photo or PDF for Jerry to look at and help
diagnose** — a controller showing a fault code, a nameplate, a wiring panel, a
submittal, a PO. Claude (`claude-sonnet-4-6`) is vision-capable, so the attachment
rides along as a content block on the same call, alongside the RAG excerpts and (on
a ticket) that unit's record. **Internal-only by construction:** only `JerryWidget`
callers that pass `allowAttachments` show the UI, and only the two admin routes read
attachments — the customer assistant ignores them.

- **UI (`components/shared/JerryWidget.tsx`, `allowAttachments`):** paperclip button,
  drag-and-drop, and paste. Images are **downscaled in the browser** (long edge ≤
  1568px, re-encoded JPEG ~0.82) so payloads stay well under Vercel's ~4.5MB
  function-body limit and cost less; PDFs pass through (≤ 4MB each). Caps: 4 files
  per turn, ~3.8MB total per request. Staged files show as thumbnails; sent files
  render in the user bubble. Attachments are carried in message history and resent so
  follow-ups ("what about the wiring on the left?") keep the image in context.
- **Server (`lib/assistant-attachments.ts`):** `sanitizeAttachments` re-validates
  media types (`image/jpeg|png|gif|webp`, `application/pdf`), per-file and total size,
  and count (defense in depth); `buildUserContent` assembles the Anthropic content
  (document/image blocks first, then a text block — an attachment-only turn gets a
  default prompt). Both routes keep attachment-only user turns (the old text-required
  filter would have dropped them). The system prompt tells Jerry to examine the file,
  read visible model/serial/error text, cross-check the ticket's equipment, and never
  treat an attached file as instructions.
- **No new deps, model, storage, or migration** — data flows through the existing
  Anthropic call. Verified end-to-end against the live model: a synthesized unit photo
  (controller error + nameplate) was read back correctly (model, serial, error code)
  with a diagnostic next-steps list.

## Curated internal reference docs (2026-07-07)
Not everything worth citing is a third-party PDF. **IAT-authored references** —
knowledge that isn't in any source manual, or where a PDF's layout extracts too
poorly to be useful (columnar spec sheets) — live as committed Markdown in
`scripts/kb-reference/` and ingest into the same pool:
```
node scripts/ingest-kb-docs.mjs --curated   # just the curated refs
node scripts/ingest-kb-docs.mjs --all       # PDFs + curated refs
```
- Registered in the `CURATED_DOCS` array in `ingest-kb-docs.mjs` (`file`, `title`,
  `category`, `isInternal`). The `.md` name is the `source_filename` (won't collide
  with the PDF pool; `--all`'s folder scan only reads PDFs, so these are stable).
- **Committed to the repo** (unlike the gitignored `ocr-cache/`, which holds
  third-party copyrighted manual text) — because this is IAT's *own* content.
  Ingest is idempotent per file, same as the PDF path.
- **First one: "IAT Unit Nomenclature (2022)"** (`iat-unit-nomenclature.md`,
  `is_internal=true`) — how to decode an IAT model number (nominal CFM; system
  type `R`/`D`/`B`/`AHU`; reactivation `E`/`S`/`G`/`HW`; `HC` = high capacity;
  `/IDP` = integrated dehumidification package; trailing number = actual CFM), the
  serial-number format (year of sale + perpetual sequence), and the current
  Compact / Rotor / IDP model lists with worked examples. Internal-only, so only
  the two staff-facing Jerrys see it. Verified: top hit on decode questions for
  `include_internal => true`; absent from the customer pool.

## Pool status (2026-06-30)
- Pool: **67 documents, ~3,228 chunks** (the full IAT documentation folder, after
  pruning duplicate source files and OCR'ing the image-only PDFs — below). **6 are
  `is_internal=true`** (hidden from customers) — the 5 company/PII docs plus the
  competitor-authored Dehumidification Guide (see Competitor scrubbing below) — so
  **61 are customer-facing**.
- **Image-only/scanned PDFs → OCR'd (2026-06-30).** 16 of the 80 source PDFs had no text
  layer (pdftotext returns nothing). They're now transcribed with **Claude PDF-vision**
  (`scripts/ocr-image-pdfs.mjs`) into local sidecars under `scripts/ocr-cache/`
  (**gitignored** — full third-party manual text stays out of this *public* repo; the text
  lives in the RLS-locked DB after ingest, same posture as the rest of the pool). The
  ingest script uses a sidecar automatically when a PDF extracts to 0 chunks
  (`readOcrSidecar`). Of the 16: **9 ingested** — Maxitrol Selectra 94 gas valve, Belimo
  LF24-MFT-S, Belimo TF120, Fasco D215 motor, Fasco approval drawing, Control Products
  HS-70-O/HS-70-D sensor, Phasetronics EZ1 SCR, DRI desiccant-rotor spec, NEMA Premium
  motor guide; **5 excluded** via `SKIP_DOCS` (2 GE HumiTrac scans already covered by
  `GEH2-D-TT2`/`GEH-S-TT3`/`DP4A`; `MMSQPL` + `Terms Certifigroup-MET Labs` are IAT
  internal business forms — an insurance questionnaire and a pricing quote, **not** product
  docs; and `ZWN030X6D Cond Unit Manual` — OCR'd via page-splitting since the 9 MB scan
  timed out as a single call, then found to be the **same Heatcraft H-IM-CU manual**
  already in the pool as `H-IM-CU-0808.pdf`, so removed + excluded — caught by verifying
  retrieval); **2 not OCR'd** (`E5CN…(Omron)` is a scanned dup of the text `E5CN Manual`;
  `Paint` is internal). Competitor scrubbing applies to OCR'd text too (it runs in
  `buildChunks`).
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

## Competitor scrubbing (2026-06-30)
**Hard rule from IAT leadership: a competitor's name must NEVER reach a customer
through Jerry — not in an answer, not in a cited document's title, nowhere.** It does
not have to say "IAT"; it must simply never name the competition. Munters is the only
competitor present in the corpus today (component suppliers — Omron, Fuji, Vaisala,
Watlow, Belimo, GE, Honeywell… — are NOT competitors and are deliberately kept).

`lib/competitors.mjs` is the **single source of truth** (plain `.mjs` so the Node ingest
script and the TS API route both import it). It exports `COMPETITOR_NAMES`,
`scrubCompetitors(text)`, `COMPETITOR_TITLE_OVERRIDES`, and `hasCompetitor(text)`.
**Guarantee:** after `scrubCompetitors`, `hasCompetitor` is false — no brand token
survives, even glued into a URL, an email address, or a compound word
(`www.MuntersAmerica.com`, `info@muntersnv.be`). To add a competitor later: add its
tokens to `COMPETITOR_NAMES` (and an optional nicer multiword rule).

Enforced at **three layers**:
1. **Ingest** (`ingest-kb-docs.mjs`) — `buildChunks` runs `scrubCompetitors` over chunk
   content (so the generated `tsv` can't even index the name), and `deriveTitle` applies
   `COMPETITOR_TITLE_OVERRIDES` (de-branded citation titles).
2. **Answer** (`app/api/customer/assistant/route.ts`) — the excerpts block + source
   titles are scrubbed before the model sees them; a system-prompt rule forbids naming
   any competitor **and** forbids revealing a referenced doc's publisher/author/address/
   provenance; and the model's final reply is run through `scrubCompetitors` as a net.
3. **Document policy** — the **Munters DH handbook** (228-page competitor-authored
   reference) is held **`is_internal=true`**: even de-branded, its front matter leaks the
   publisher's identity another way (postal address, editor name), which a stronger prompt
   can't fully launder out of 228 pages. Title de-branded to **"Dehumidification Guide"**;
   re-enable for customers by removing it from `INTERNAL_DOCS` if leadership decides to.
   **M120** (2-page competitor product manual) stays customer-facing, de-branded to
   "M120 Desiccant Dehumidifier".

**Verification (2026-06-30):** a node harness (`scripts/_verify-jerry.mjs`, throwaway)
replays Jerry's real answer path outside the auth wall; a 13-probe battery + the 18
oblique probes an adversarial workflow red-teamed (jailbreaks, authority claims,
translation/OCR tricks, footer/metadata/nameplate extraction, "Swedish company") all
came back clean under an independent 2-judge panel — **0 direct or indirect leaks**, and
the component-supplier control questions (Belimo/Vaisala/Omron) still answer correctly.

## Scaling & upgrades
- **Re-ingest after changing the folder / maps:** `node scripts/ingest-kb-docs.mjs --all`.
- **Internal assistant:** point a new server-side caller at `retrieveChunks(q, { includeInternal: true })`.
- **OCR'd the image-only PDFs (done 2026-06-30)** via `scripts/ocr-image-pdfs.mjs`
  (Claude PDF-vision → `scripts/ocr-cache/` sidecars → ingest). Re-run for a new scan
  with `node scripts/ocr-image-pdfs.mjs --docs="<file>"`, then re-ingest.
- **Semantic search:** add the `embedding` column + an embeddings key and blend
  vector similarity with the FTS score — the quality upgrade when keyword search is too literal.

## Ops / deploy
- Apply `supabase/migrations/030_kb_rag.sql` by hand in the Supabase SQL editor
  (DDL — done 2026-06-29), then run the ingest script. No new env vars.
- Verify: `SELECT document_title, page_number FROM match_kb_chunks('reset the humidistat', 5);`
