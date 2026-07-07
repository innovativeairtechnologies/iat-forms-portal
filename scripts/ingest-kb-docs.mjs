/**
 * IAT Forms Portal — ingest documentation PDFs into the KB RAG pool.
 *
 * "Feed the machine": each PDF is extracted PER PAGE with `pdftotext` (so page
 * numbers survive for citations), chunked into ~page-sized pieces, and stored in
 * kb_documents + kb_chunks (migration 030). The customer AI Assistant then
 * retrieves the most relevant chunks (lib/kb-rag.ts) and answers grounded + cited.
 *
 * LEAN POC: full-text search only (the tsvector is a generated column, computed in
 * Postgres) — no embeddings, no new vendor. Semantic search is a later upgrade.
 *
 *   Prereqs:  migration 030 applied in the Supabase SQL editor; `pdftotext` on PATH
 *             (ships with Git for Windows: C:\Program Files\Git\mingw64\bin).
 *   Run POC:  node scripts/ingest-kb-docs.mjs            # the chosen starter docs
 *   Run all:  node scripts/ingest-kb-docs.mjs --all      # every PDF + curated refs
 *   Subset :  node scripts/ingest-kb-docs.mjs --docs="A1094 Manual.pdf,gs1m.pdf"
 *   Curated:  node scripts/ingest-kb-docs.mjs --curated  # just the IAT-authored refs
 *
 * Idempotent per file: an existing kb_documents row for the same source_filename
 * (and its chunks, via ON DELETE CASCADE) is deleted and re-inserted. Re-runnable.
 *
 * Internal/company docs (Core Values, Aptitude Test, Terms, Paint, MSDS) are marked
 * is_internal=true so they NEVER surface in the customer pool, even under --all.
 */
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { scrubCompetitors, COMPETITOR_TITLE_OVERRIDES } from '../lib/competitors.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Source folder (OneDrive Files-On-Demand; first access downloads each PDF).
// Override with KB_DOCS_DIR if the docs live elsewhere.
const DOCS_DIR =
  process.env.KB_DOCS_DIR ||
  'C:\\Users\\JacobY\\Innovative Air\\IAT Documentation - Documents'

// Committed OCR transcriptions for image-only/scanned PDFs (see scripts/ocr-image-pdfs.mjs).
// Used as a fallback when pdftotext extracts no text, so `--all` folds those docs in.
const OCR_CACHE_DIR = join(__dirname, 'ocr-cache')

// ── Curated internal reference docs (IAT-authored, not third-party PDFs) ──────
// Hand-written Markdown/text references that live IN THE REPO (scripts/kb-reference,
// committed — unlike the gitignored ocr-cache, since this is IAT's OWN content) and
// get ingested into the same pool so the internal Jerry can cite them. Use this for
// knowledge that isn't in a source PDF, or where a PDF's layout extracts too poorly
// to be useful (columnar spec sheets). `source_filename` is the .md name (won't
// collide with the PDF pool, and `--all` never touches these — it only reads PDFs
// from DOCS_DIR). Ingest with `--curated` (also included under `--all`).
const KB_REFERENCE_DIR = join(__dirname, 'kb-reference')
const CURATED_DOCS = [
  {
    file: 'iat-unit-nomenclature.md',
    title: 'IAT Unit Nomenclature (2022)',
    category: 'Reference',
    // Internal decode reference for staff — kept out of the customer-facing pool.
    isInternal: true,
  },
]

// ── The starter docs Jacob chose for the POC (exact filenames) ───────────────
// 'A1094 Manual.pdf' (Maxitrol Selectra Series 94) was image-only and excluded from
// the POC pool; it's now OCR'd (scripts/ocr-cache sidecar) and folds in under --all.
const POC_DOCS = [
  'ASPYRE-60-210A-manual.pdf',
  'Compact Brochure_rev2025.pdf',
  'Munters DH handbook.pdf',
  '3045 Remote Box Humidistat Guide.pdf',
  'CDI DH 148 CTR Preliminary Submittal 5 19 25.pdf',
  'E5CN Manual.pdf',
  'Fuji VFD.pdf',
  'gs1m.pdf',
  'gs2m.pdf',
  'gs3m.pdf',
]

// Internal/company docs — excluded from the customer pool (marked is_internal).
const INTERNAL_DOCS = new Set([
  'Core Values Handout_rev5.2025.pdf',
  'Mechanical Aptitude Test_rev8.2025.pdf',
  'IAT Terms & Conditions_rev8.20.2025.pdf',
  'Paint.pdf',
  'MSDSArmaflex520AUS.pdf',
  // IAT customer reference list — holds OTHER customers' names, phone numbers and
  // emails (PII). Must never surface in the customer-facing pool.
  'References.pdf',
  // Competitor-authored 228-page reference. De-branded (name/URL/email scrubbed,
  // title → "Dehumidification Guide"), but its front matter still carries the
  // publisher's address/editor — identifying details that point to the competitor.
  // Per IAT's "no competitor reference anywhere" rule it's held internal-only for
  // now (still de-branded, available to a future employee assistant). Re-enable by
  // removing this line if leadership decides to keep it customer-facing.
  'Munters DH handbook.pdf',
])

// Duplicate source files — exact copies (or strict subsets) of another doc already
// in the pool. Excluded under --all so a topic doesn't return the same content under
// two citation chips. (`--docs="<name>"` can still force one in if ever needed.)
// Kept copy is noted in the comment.
const SKIP_DOCS = new Set([
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR.pdf',  // dup of "DC  SCR Manual.pdf" (Watlow DIN-A-MITE C)
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR1.pdf', // dup of "DC  SCR Manual.pdf"
  'DP4A EN4A WB4A GE Installation Guide[1].pdf',       // dup of "DP4A.pdf" (GE HumiTrac XR)
  'GEH-HumiTrac Installation Guide[1].pdf',            // dup of "GEH2-D-TT2.pdf" (GE Sensing HumiTrac)
  'KAS-44-M.pdf',                                      // dup of "KAS-44-88-175-install.pdf" (KAS actuators)
  'PXR459_manual (shortened).pdf',                     // condensed subset of "PXR459_manual.pdf" (Fuji PXR4/5/9)
  // OCR'd (sidecars exist) but deliberately NOT ingested — they'd join the pool via
  // --all otherwise:
  'GEH Series Transmitter.pdf',                        // dup of GE HumiTrac (covered by GEH2-D-TT2/GEH-S-TT3/DP4A)
  'iPak Humidity - Temp Transmitter GEH2-D-TT2.pdf',   // dup of "GEH2-D-TT2.pdf" (GE HumiTrac install guide)
  'MMSQPL.pdf',                                         // IAT insurance products-liability questionnaire — internal business form, not product doc
  'Terms Certifigroup-MET Labs.pdf',                   // IAT MET Labs field-labeling quote (pricing terms) — internal business, not product doc
  'ZWN030X6D Cond Unit Manual.pdf',                    // dup of "H-IM-CU-0808.pdf" (same Heatcraft H-IM-CU condensing-unit manual; the filename is just an order/model number)
])

// Nicer human titles for citations (fallback derives one from the filename).
// Titles are taken from each PDF's own header text, in the existing vendor-named
// style (Omron, Fuji, Munters…). Several source files are duplicates of the same
// manual; they're given identical titles so the citation chips collapse cleanly.
const TITLE_MAP = {
  // ── original POC set ───────────────────────────────────────────────────────
  'ASPYRE-60-210A-manual.pdf': 'ASPYRE 60-210A Manual',
  'Compact Brochure_rev2025.pdf': 'IAT Compact Brochure (2025)',
  // 'Munters DH handbook.pdf' / 'M120.pdf' → de-branded titles live in
  // lib/competitors.mjs (COMPETITOR_TITLE_OVERRIDES), applied by deriveTitle().
  '3045 Remote Box Humidistat Guide.pdf': '3045 Remote Box Humidistat Guide',
  'A1094 Manual.pdf': 'Maxitrol Selectra Series 94 Modulating Gas Valve',
  'CDI DH 148 CTR Preliminary Submittal 5 19 25.pdf': 'CDI DH-148 CTR Preliminary Submittal',
  'E5CN Manual.pdf': 'Omron E5CN Temperature Controller Manual',
  'Fuji VFD.pdf': 'Fuji VFD Manual',
  'gs1m.pdf': 'GS1 Series Drive User Manual',
  'gs2m.pdf': 'GS2 Series Drive User Manual',
  'gs3m.pdf': 'GS3 Series Drive User Manual',

  // ── OCR'd image-only PDFs (text via scripts/ocr-cache sidecars) ────────────
  'Actuator LF24-MFT-S Kele.pdf': 'Belimo LF24-MFT-S Multi-Function Spring-Return Actuator',
  'Actuator TF120 Kele.pdf': 'Belimo TF120 Spring-Return Actuator',
  'Fasco Model D215.pdf': 'Fasco Model D215 Shaded-Pole Motor',
  'Fasco PN 71625928 Approval Drawing.pdf': 'Fasco Motor Approval Drawing (PN 71625928)',
  'HS-70-D.pdf': 'Control Products HS-70-O / HS-70-D Humidity Sensor',
  'SCR (EZ1) Phasetronics.pdf': 'Phasetronics EZ1 Series SCR Power Controller Manual',
  'Technical-Specification-EDC.pdf': 'DRI Desiccant Rotor Technical Specification',
  'motors.pdf': 'NEMA Premium 3-Phase Motor Information Guide',

  // ── IAT / dehumidifier ─────────────────────────────────────────────────────
  'Compact IOM_rev08.2025.pdf': 'IAT Compact Rotor Series IOM Manual',
  'Compact Performance Curves.pdf': 'IAT Compact Performance Curves',
  'rotor-source-desiccant-and-passive-manual.pdf': 'Rotor Source Desiccant Rotor & Cassette Manual',

  // ── temperature controllers (Fuji / Honeywell) ────────────────────────────
  'PXR3.pdf': 'Fuji PXR3 Temperature Controller Manual',
  'PXR459_manual.pdf': 'Fuji PXR4/5/9 Temperature Controller Manual',
  'PXR459_manual (shortened).pdf': 'Fuji PXR4/5/9 Temperature Controller Manual (Condensed)',
  'PXF4-manual.pdf': 'Fuji PXF4 Temperature Controller Manual',
  'RM7890.pdf': 'Honeywell RM7890/EC7890 Relay Module Instructions',

  // ── SCR / power controllers (Watlow) ───────────────────────────────────────
  'powerController_UM.pdf': 'Watlow Power Series SCR Power Controller Manual',
  'DA SCR-Manual.pdf': 'Watlow DIN-A-MITE Style A SCR Power Controller Manual',
  'DB SCR Manual.pdf': 'Watlow DIN-A-MITE Style B SCR Power Controller Manual',
  'DC  SCR Manual.pdf': 'Watlow DIN-A-MITE Style C SCR Power Controller Manual',
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR.pdf': 'Watlow DIN-A-MITE Style C SCR Power Controller Manual',
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR1.pdf': 'Watlow DIN-A-MITE Style C SCR Power Controller Manual',

  // ── humidity / dewpoint transmitters & sensors (Vaisala / GE / others) ─────
  'DMT143-Users-Guide-in-English-M211435EN.pdf': 'Vaisala DMT143 Dewpoint Transmitter User Guide',
  'DMT142 Vaisala.pdf': 'Vaisala DMT142 Dewpoint Transmitter Guide',
  'DMT142 Brochure Vaisala.pdf': 'Vaisala DMT142 Dewpoint Transmitter Brochure',
  'HMD82TD Manual.pdf': 'Vaisala INTERCAP HMDW80 Series Transmitter User Guide',
  'HMW80 datasheet B211060EN-A.pdf': 'Vaisala INTERCAP HMW80 Series Transmitter Datasheet',
  'HMW80 Quick Guide - M211328EN-B.pdf': 'Vaisala INTERCAP HMW80 Series Transmitter Quick Guide',
  'HMW40Y Transmitter.pdf': 'Vaisala HMW40U/Y Humidity Transmitter',
  'HMD40Y Transmitter Kele.pdf': 'Vaisala HMD40U/Y Humidity Transmitter',
  'DP4A.pdf': 'GE HumiTrac XR Transmitter Installation Guide',
  'DP4A EN4A WB4A GE Installation Guide[1].pdf': 'GE HumiTrac XR Transmitter Installation Guide',
  'GEH-HumiTrac Installation Guide[1].pdf': 'GE Sensing HumiTrac Transmitter Installation Guide',
  'GEH2-D-TT2.pdf': 'GE Sensing HumiTrac Transmitter Installation Guide',
  'GEH-S-TT3.pdf': 'GE HumiTrac GEH Series Humidity Transmitter',
  'M264 Installation Guide and Manual.pdf': 'Setra Model 264 Differential Pressure Transducer Guide',
  'DPA-5-20  Series Installation Instructions.pdf': 'DPA Series Differential Pressure Transmitter Guide',
  'SC10C.pdf': 'SC10C Signal Conditioner',

  // ── controls (Control Products / Johnson Controls) ─────────────────────────
  'Control Products HC110S24.pdf': 'Control Products HC-110 Panel-Mount Humidity Controller',
  'Control Products HS50S.pdf': 'Control Products HS-50-S Humidity Sensor',
  'TC-110 Control Products Temp Controller.pdf': 'Control Products TC-110 Panel-Mount Temperature Controller',
  'PN 1299 Humidistat.pdf': 'Johnson Controls W43A Humidistat',
  'T26 INSTL[1].pdf': 'Johnson Controls T26 Line-Voltage Thermostat',

  // ── actuators & valves (Belimo / Johnson Controls / TAC / KAS) ─────────────
  'LF_Installation.pdf': 'Belimo LF Series Actuator Installation Instructions',
  'LF120.pdf': 'Belimo LF120/LF230 Spring-Return Actuator',
  'AF-24-SR.pdf': 'Belimo AF24-SR Proportional Damper Actuator',
  'NFB24-SR-S.pdf': 'Belimo NFB24-SR Spring-Return Damper Actuator',
  'TF24-SR_1_1_en.pdf': 'Belimo TF24-SR Spring-Return Actuator',
  'M9206 Actuator (Kele).pdf': 'Johnson Controls M9206 Electric Spring-Return Actuator',
  'AP13A000 Actuator.pdf': 'TAC VM Series PopTop Modulating Valve Actuator',
  'VG1000_Series_2010_Catalog[1].pdf': 'Johnson Controls VG1000 Series Ball Valves Catalog',
  'KAS-44-88-175-install.pdf': 'KAS Series Spring-Return Actuator Installation',
  'KAS-44-M.pdf': 'KAS Series Spring-Return Actuator Installation',

  // ── dampers & HVAC ─────────────────────────────────────────────────────────
  'TAMCO Dampers TA-1000-TECH-24.pdf': 'TAMCO Series 1000 Low-Leakage Control Dampers',
  'H-IM-CU-0808.pdf': 'Condensing Units Installation & Operations Manual (H-IM-CU)',
  'CC-HADTB-0407-000.pdf': 'Outdoor Discus Condensing Unit Technical Guide',
}

const CATEGORY_MAP = {
  'ASPYRE-60-210A-manual.pdf': 'Dehumidifier',
  'Compact Brochure_rev2025.pdf': 'Dehumidifier',
  'Munters DH handbook.pdf': 'Reference',
  '3045 Remote Box Humidistat Guide.pdf': 'Controls',
  'A1094 Manual.pdf': 'Controls',
  'CDI DH 148 CTR Preliminary Submittal 5 19 25.pdf': 'Submittal',
  'E5CN Manual.pdf': 'Controls',
  'Fuji VFD.pdf': 'Drives / VFD',
  'gs1m.pdf': 'Drives / VFD',
  'gs2m.pdf': 'Drives / VFD',
  'gs3m.pdf': 'Drives / VFD',

  // IAT / dehumidifier
  'Compact IOM_rev08.2025.pdf': 'Dehumidifier',
  'Compact Performance Curves.pdf': 'Dehumidifier',
  'M120.pdf': 'Dehumidifier',
  'rotor-source-desiccant-and-passive-manual.pdf': 'Reference',

  // temperature controllers
  'PXR3.pdf': 'Controls',
  'PXR459_manual.pdf': 'Controls',
  'PXR459_manual (shortened).pdf': 'Controls',
  'PXF4-manual.pdf': 'Controls',
  'RM7890.pdf': 'Controls',
  'PN 1299 Humidistat.pdf': 'Controls',
  'T26 INSTL[1].pdf': 'Controls',
  'Control Products HC110S24.pdf': 'Controls',
  'Control Products HS50S.pdf': 'Controls',
  'TC-110 Control Products Temp Controller.pdf': 'Controls',
  'SC10C.pdf': 'Controls',

  // SCR / power controllers
  'powerController_UM.pdf': 'Power Controls',
  'DA SCR-Manual.pdf': 'Power Controls',
  'DB SCR Manual.pdf': 'Power Controls',
  'DC  SCR Manual.pdf': 'Power Controls',
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR.pdf': 'Power Controls',
  'SCR  DC20-60F0-0000 Din-A-Mite C manual SCR1.pdf': 'Power Controls',

  // sensors / transmitters
  'DMT143-Users-Guide-in-English-M211435EN.pdf': 'Sensors / Transmitters',
  'DMT142 Vaisala.pdf': 'Sensors / Transmitters',
  'DMT142 Brochure Vaisala.pdf': 'Sensors / Transmitters',
  'HMD82TD Manual.pdf': 'Sensors / Transmitters',
  'HMW80 datasheet B211060EN-A.pdf': 'Sensors / Transmitters',
  'HMW80 Quick Guide - M211328EN-B.pdf': 'Sensors / Transmitters',
  'HMW40Y Transmitter.pdf': 'Sensors / Transmitters',
  'HMD40Y Transmitter Kele.pdf': 'Sensors / Transmitters',
  'DP4A.pdf': 'Sensors / Transmitters',
  'DP4A EN4A WB4A GE Installation Guide[1].pdf': 'Sensors / Transmitters',
  'GEH-HumiTrac Installation Guide[1].pdf': 'Sensors / Transmitters',
  'GEH2-D-TT2.pdf': 'Sensors / Transmitters',
  'GEH-S-TT3.pdf': 'Sensors / Transmitters',
  'M264 Installation Guide and Manual.pdf': 'Sensors / Transmitters',
  'DPA-5-20  Series Installation Instructions.pdf': 'Sensors / Transmitters',

  // actuators & valves
  'LF_Installation.pdf': 'Actuators / Valves',
  'LF120.pdf': 'Actuators / Valves',
  'AF-24-SR.pdf': 'Actuators / Valves',
  'NFB24-SR-S.pdf': 'Actuators / Valves',
  'TF24-SR_1_1_en.pdf': 'Actuators / Valves',
  'M9206 Actuator (Kele).pdf': 'Actuators / Valves',
  'AP13A000 Actuator.pdf': 'Actuators / Valves',
  'VG1000_Series_2010_Catalog[1].pdf': 'Actuators / Valves',
  'KAS-44-88-175-install.pdf': 'Actuators / Valves',
  'KAS-44-M.pdf': 'Actuators / Valves',

  // dampers & HVAC
  'TAMCO Dampers TA-1000-TECH-24.pdf': 'Dampers / HVAC',
  'H-IM-CU-0808.pdf': 'Dampers / HVAC',
  'CC-HADTB-0407-000.pdf': 'Dampers / HVAC',

  // OCR'd image-only PDFs
  'Actuator LF24-MFT-S Kele.pdf': 'Actuators / Valves',
  'Actuator TF120 Kele.pdf': 'Actuators / Valves',
  'Fasco Model D215.pdf': 'Motors',
  'Fasco PN 71625928 Approval Drawing.pdf': 'Motors',
  'HS-70-D.pdf': 'Sensors / Transmitters',
  'SCR (EZ1) Phasetronics.pdf': 'Power Controls',
  'Technical-Specification-EDC.pdf': 'Reference',
  'motors.pdf': 'Motors',
}

// Chunking: ~page-sized. Most datasheet pages fall under one chunk; dense pages
// split with a small overlap so a fact straddling the split is still retrievable.
const MAX_WORDS = 320
const OVERLAP_WORDS = 40
const INSERT_BATCH = 500

// ── pure helpers (exported so the dry-run harness can reuse them) ─────────────

/** Tidy extracted page text without destroying it: drop CRs, trim trailing spaces,
 *  collapse 3+ blank lines to one, strip the U+FFFD replacement char. */
export function cleanText(s) {
  return String(s ?? '')
    .replace(/\r/g, '')
    // Postgres `text` cannot store a NUL (0x00) — CID/Adobe-Japan1 font glyphs that
    // pdftotext can't map sometimes emit one, which fails the chunk insert with
    // "unsupported Unicode escape sequence". Strip NUL + other C0 control chars
    // (keep \t and \n) so those pages ingest cleanly instead of dropping the doc.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\uFFFD/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Extract a PDF to an array of per-page strings (index 0 = page 1). Uses a single
 *  pdftotext call; pages are separated by form-feed (\f). */
export function extractPages(absPath) {
  const out = execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', absPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  const pages = out.split('\f')
  // pdftotext emits a trailing \f after the last page → drop the empty tail.
  if (pages.length && pages[pages.length - 1].trim() === '') pages.pop()
  return pages
}

/** Split one page's words into ~MAX_WORDS chunks with OVERLAP_WORDS overlap. */
export function chunkPageWords(text, maxWords = MAX_WORDS, overlap = OVERLAP_WORDS) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  if (words.length <= maxWords) return [text.trim()]
  const chunks = []
  const step = Math.max(1, maxWords - overlap)
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
    if (i + maxWords >= words.length) break
  }
  return chunks
}

/** Turn extracted pages into chunk rows with page numbers + a running chunk_index.
 *  Blank/image-only pages yield no chunks. */
export function buildChunks(pages) {
  const rows = []
  let idx = 0
  pages.forEach((raw, p) => {
    // Scrub competitor names out of the stored text (also keeps the generated tsv
    // from indexing them, so a competitor name can't even be searched for).
    const clean = scrubCompetitors(cleanText(raw))
    if (!clean) return
    for (const content of chunkPageWords(clean)) {
      if (!content.trim()) continue
      rows.push({ chunk_index: idx++, page_number: p + 1, content })
    }
  })
  return rows
}

/** Human title for citations: a de-branded competitor override wins, then the map,
 *  else a tidy version of the filename. */
export function deriveTitle(filename) {
  if (COMPETITOR_TITLE_OVERRIDES[filename]) return COMPETITOR_TITLE_OVERRIDES[filename]
  if (TITLE_MAP[filename]) return TITLE_MAP[filename]
  return basename(filename, '.pdf')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(rev|manual|guide)\b/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .trim()
}

export function deriveCategory(filename) {
  return CATEGORY_MAP[filename] ?? null
}

/** Image-only PDFs have no text layer; their text comes from a committed OCR sidecar
 *  (scripts/ocr-cache/<filename>.txt, page-delimited by "===== PAGE N =====" markers).
 *  Returns an array of per-page strings (dropping blank / "(no text)" pages), or null. */
export function readOcrSidecar(filename) {
  const p = join(OCR_CACHE_DIR, `${filename}.txt`)
  if (!existsSync(p)) return null
  const raw = readFileSync(p, 'utf8')
  const pages = raw
    .split(/^=+ ?PAGE \d+ ?=+$/im)        // segments between page markers (parts[0] = preamble)
    .map((s) => s.trim())
    .filter((s) => s && !/^\(no text\)$/i.test(s))
  return pages.length ? pages : null
}

// ── ingest one document ──────────────────────────────────────────────────────
async function ingestDoc(sb, filename) {
  const absPath = join(DOCS_DIR, filename)
  if (!existsSync(absPath)) {
    console.log(`  SKIP  ${filename} — not found in ${DOCS_DIR}`)
    return { ok: false }
  }

  let pages
  try {
    pages = extractPages(absPath)
  } catch (e) {
    console.log(`  ERR   ${filename} — pdftotext failed: ${e.message}`)
    return { ok: false }
  }

  let chunks = buildChunks(pages)
  if (chunks.length === 0) {
    // Image-only/scanned PDF (no text layer) — fall back to its OCR sidecar, if present.
    const ocrPages = readOcrSidecar(filename)
    if (ocrPages) {
      pages = ocrPages
      chunks = buildChunks(pages)
      if (chunks.length) console.log(`  OCR   ${filename} — used OCR sidecar (${pages.length} pages)`)
    }
  }
  if (chunks.length === 0) {
    console.log(`  WARN  ${filename} — 0 text chunks (image-only/scanned?), skipped`)
    return { ok: false }
  }

  const isInternal = INTERNAL_DOCS.has(filename)

  // Idempotent: drop any prior rows for this filename (chunks cascade), re-insert.
  const { error: delErr } = await sb.from('kb_documents').delete().eq('source_filename', filename)
  if (delErr) {
    // Surface the real cause here rather than a confusing UNIQUE violation on the insert below.
    console.log(`  ERR   ${filename} — pre-delete failed: ${delErr.message}`)
    return { ok: false }
  }

  const { data: doc, error: docErr } = await sb
    .from('kb_documents')
    .insert({
      title: deriveTitle(filename),
      source_filename: filename,
      category: deriveCategory(filename),
      is_internal: isInternal,
      page_count: pages.length,
    })
    .select('id')
    .single()
  if (docErr || !doc) {
    console.log(`  ERR   ${filename} — document insert failed: ${docErr?.message}`)
    return { ok: false }
  }

  const rows = chunks.map((c) => ({ ...c, document_id: doc.id }))
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH)
    const { error: chErr } = await sb.from('kb_chunks').insert(batch)
    if (chErr) {
      console.log(`  ERR   ${filename} — chunk insert failed @${i}: ${chErr.message}`)
      return { ok: false }
    }
  }

  console.log(
    `  OK    ${filename} — ${pages.length} pages, ${chunks.length} chunks` +
      (isInternal ? '  [internal: hidden from customers]' : ''),
  )
  return { ok: true, pages: pages.length, chunks: chunks.length }
}

// ── ingest one curated internal reference doc (a committed .md, not a PDF) ─────
async function ingestCuratedDoc(sb, entry) {
  const absPath = join(KB_REFERENCE_DIR, entry.file)
  if (!existsSync(absPath)) {
    console.log(`  SKIP  ${entry.file} — not found in ${KB_REFERENCE_DIR}`)
    return { ok: false }
  }

  // Curated references are short; treat the whole file as a single "page" (page 1)
  // and let chunkPageWords split it if it's long. buildChunks also scrubs competitor
  // names (a no-op for IAT-authored text, but keeps the guarantee uniform).
  const text = readFileSync(absPath, 'utf8')
  const chunks = buildChunks([text])
  if (chunks.length === 0) {
    console.log(`  WARN  ${entry.file} — 0 text chunks, skipped`)
    return { ok: false }
  }

  // Idempotent: drop any prior rows for this source_filename (chunks cascade), re-insert.
  const { error: delErr } = await sb.from('kb_documents').delete().eq('source_filename', entry.file)
  if (delErr) {
    console.log(`  ERR   ${entry.file} — pre-delete failed: ${delErr.message}`)
    return { ok: false }
  }

  const { data: doc, error: docErr } = await sb
    .from('kb_documents')
    .insert({
      title: entry.title,
      source_filename: entry.file,
      category: entry.category ?? 'Reference',
      is_internal: entry.isInternal ?? true,
      page_count: 1,
    })
    .select('id')
    .single()
  if (docErr || !doc) {
    console.log(`  ERR   ${entry.file} — document insert failed: ${docErr?.message}`)
    return { ok: false }
  }

  const rows = chunks.map((c) => ({ ...c, document_id: doc.id }))
  const { error: chErr } = await sb.from('kb_chunks').insert(rows)
  if (chErr) {
    console.log(`  ERR   ${entry.file} — chunk insert failed: ${chErr.message}`)
    return { ok: false }
  }

  console.log(
    `  OK    ${entry.file} — curated reference, ${chunks.length} chunks` +
      ((entry.isInternal ?? true) ? '  [internal: hidden from customers]' : ''),
  )
  return { ok: true, chunks: chunks.length }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const env = Object.fromEntries(
    readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        // Strip optional surrounding quotes (dotenv-style KEY="value").
        const v = l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
        return [l.slice(0, i).trim(), v]
      }),
  )
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const all = args.includes('--all')
  const curatedOnly = args.includes('--curated')

  let docs
  const docsArg = args.find((a) => a.startsWith('--docs='))
  if (curatedOnly) {
    docs = [] // curated-only run: skip the PDF pool entirely
  } else if (all) {
    docs = readdirSync(DOCS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .filter((f) => !SKIP_DOCS.has(f)) // drop known duplicate source files
      .sort()
  } else if (docsArg) {
    docs = docsArg.slice('--docs='.length).split(',').map((s) => s.trim()).filter(Boolean)
  } else {
    docs = POC_DOCS
  }

  // Curated internal reference docs come in on --curated (only these) or --all (alongside PDFs).
  const curated = curatedOnly || all ? CURATED_DOCS : []

  let okCount = 0
  let totalChunks = 0

  if (docs.length) {
    console.log(`Ingesting ${docs.length} document(s) from:\n  ${DOCS_DIR}\n`)
    for (const f of docs) {
      const r = await ingestDoc(sb, f)
      if (r.ok) { okCount++; totalChunks += r.chunks }
    }
  }

  if (curated.length) {
    console.log(`\nIngesting ${curated.length} curated reference doc(s) from:\n  ${KB_REFERENCE_DIR}\n`)
    for (const entry of curated) {
      const r = await ingestCuratedDoc(sb, entry)
      if (r.ok) { okCount++; totalChunks += r.chunks }
    }
  }

  const attempted = docs.length + curated.length
  console.log(`\nDone. ${okCount}/${attempted} documents ingested, ${totalChunks} chunks total.`)
  console.log('Verify in Supabase:  SELECT * FROM match_kb_chunks(\'reset the humidistat\', 5);')
}

// Only run when invoked directly (not when imported by the dry-run harness).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
