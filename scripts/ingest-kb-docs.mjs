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
 *   Run all:  node scripts/ingest-kb-docs.mjs --all      # every PDF in the folder
 *   Subset :  node scripts/ingest-kb-docs.mjs --docs="A1094 Manual.pdf,gs1m.pdf"
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

const __dirname = dirname(fileURLToPath(import.meta.url))

// Source folder (OneDrive Files-On-Demand; first access downloads each PDF).
// Override with KB_DOCS_DIR if the docs live elsewhere.
const DOCS_DIR =
  process.env.KB_DOCS_DIR ||
  'C:\\Users\\JacobY\\Innovative Air\\IAT Documentation - Documents'

// ── The starter docs Jacob chose for the POC (exact filenames) ───────────────
// 'A1094 Manual.pdf' was in the original 11 but is an image-only/scanned PDF
// (0 extractable text — needs OCR), so it's excluded from the POC pool. Add it
// back here once it's OCR'd. `--all` would still attempt it and skip it cleanly.
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
])

// Nicer human titles for citations (fallback derives one from the filename).
const TITLE_MAP = {
  'ASPYRE-60-210A-manual.pdf': 'ASPYRE 60-210A Manual',
  'Compact Brochure_rev2025.pdf': 'IAT Compact Brochure (2025)',
  'Munters DH handbook.pdf': 'Munters Dehumidification Handbook',
  '3045 Remote Box Humidistat Guide.pdf': '3045 Remote Box Humidistat Guide',
  'A1094 Manual.pdf': 'A1094 Manual',
  'CDI DH 148 CTR Preliminary Submittal 5 19 25.pdf': 'CDI DH-148 CTR Preliminary Submittal',
  'E5CN Manual.pdf': 'Omron E5CN Temperature Controller Manual',
  'Fuji VFD.pdf': 'Fuji VFD Manual',
  'gs1m.pdf': 'GS1 Series Drive User Manual',
  'gs2m.pdf': 'GS2 Series Drive User Manual',
  'gs3m.pdf': 'GS3 Series Drive User Manual',
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
    .replace(/�/g, '')
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
    const clean = cleanText(raw)
    if (!clean) return
    for (const content of chunkPageWords(clean)) {
      if (!content.trim()) continue
      rows.push({ chunk_index: idx++, page_number: p + 1, content })
    }
  })
  return rows
}

/** Human title for citations: from the map, else a tidy version of the filename. */
export function deriveTitle(filename) {
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

  const chunks = buildChunks(pages)
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

  let docs
  const docsArg = args.find((a) => a.startsWith('--docs='))
  if (args.includes('--all')) {
    docs = readdirSync(DOCS_DIR).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
  } else if (docsArg) {
    docs = docsArg.slice('--docs='.length).split(',').map((s) => s.trim()).filter(Boolean)
  } else {
    docs = POC_DOCS
  }

  console.log(`Ingesting ${docs.length} document(s) from:\n  ${DOCS_DIR}\n`)
  let okCount = 0
  let totalChunks = 0
  for (const f of docs) {
    const r = await ingestDoc(sb, f)
    if (r.ok) { okCount++; totalChunks += r.chunks }
  }
  console.log(`\nDone. ${okCount}/${docs.length} documents ingested, ${totalChunks} chunks total.`)
  console.log('Verify in Supabase:  SELECT * FROM match_kb_chunks(\'reset the humidistat\', 5);')
}

// Only run when invoked directly (not when imported by the dry-run harness).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
