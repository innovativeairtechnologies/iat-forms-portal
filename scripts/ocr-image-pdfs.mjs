/**
 * IAT Forms Portal — OCR the image-only / scanned PDFs so they can join the KB pool.
 *
 * 16 of the 80 source PDFs have no extractable text layer (pdftotext yields nothing),
 * so `ingest-kb-docs.mjs` WARNs and skips them. This tool transcribes each with
 * **Claude PDF-vision** (no local OCR install needed — reuses ANTHROPIC_API_KEY) and
 * writes the text to a committed cache file under scripts/ocr-cache/<filename>.txt,
 * page-delimited by "===== PAGE N =====" markers.
 *
 * The ingest script then picks up that sidecar automatically (readOcrSidecar) when a
 * PDF extracts to 0 chunks — so `node scripts/ingest-kb-docs.mjs --all` folds the OCR'd
 * docs into the pool. Competitor scrubbing (lib/competitors.mjs) applies to OCR'd text
 * too, since it runs in buildChunks.
 *
 *   Run:        node scripts/ocr-image-pdfs.mjs            # OCR the list below (cache-skips done ones)
 *   Re-OCR one: node scripts/ocr-image-pdfs.mjs --force --docs="motors.pdf"
 *
 * Cache files are committed so re-ingest never needs to re-OCR (or even reach OneDrive).
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, 'ocr-cache')
const DOCS_DIR =
  process.env.KB_DOCS_DIR ||
  'C:\\Users\\JacobY\\Innovative Air\\IAT Documentation - Documents'

// The image-only PDFs worth OCR'ing. Excludes:
//  - 'E5CN Temp Controller Manual (Omron).pdf' — scanned dup of the text 'E5CN Manual.pdf'
//  - 'Paint.pdf' — internal doc, low value
const OCR_DOCS = [
  'A1094 Manual.pdf',
  'Actuator LF24-MFT-S Kele.pdf',
  'Actuator TF120 Kele.pdf',
  'Fasco Model D215.pdf',
  'Fasco PN 71625928 Approval Drawing.pdf',
  'GEH Series Transmitter.pdf',
  'HS-70-D.pdf',
  'MMSQPL.pdf',
  'SCR (EZ1) Phasetronics.pdf',
  'Technical-Specification-EDC.pdf',
  'Terms Certifigroup-MET Labs.pdf',
  'ZWN030X6D Cond Unit Manual.pdf',
  'iPak Humidity - Temp Transmitter GEH2-D-TT2.pdf',
  'motors.pdf',
]

/** Cache file path for a source PDF's OCR text. */
export function ocrCachePath(filename) {
  return join(CACHE_DIR, `${filename}.txt`)
}

const PROMPT =
  'Transcribe ALL text from this document verbatim, page by page. Start each page with a ' +
  'line exactly "===== PAGE N =====" (N = the page number). Preserve tables as best you ' +
  'can in plain text and keep part numbers, model numbers, and specs exact. Do NOT ' +
  'summarize, comment, or add anything — output only the transcription. If a page is a ' +
  'pure image/diagram with no text, write "(no text)" for that page.'

async function ocrOne(anthropic, filename, force) {
  const cache = ocrCachePath(filename)
  if (existsSync(cache) && !force) {
    console.log(`  SKIP  ${filename} — cache exists`)
    return { ok: true, cached: true }
  }
  const abs = join(DOCS_DIR, filename)
  if (!existsSync(abs)) {
    console.log(`  MISS  ${filename} — not found in ${DOCS_DIR}`)
    return { ok: false }
  }
  const b64 = readFileSync(abs).toString('base64')
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    const stop = msg.stop_reason
    writeFileSync(cache, text, 'utf8')
    const pages = (text.match(/^=+ ?PAGE \d+ ?=+$/gim) || []).length
    console.log(
      `  OK    ${filename} — ${text.length} chars, ~${pages} page-markers` +
        `, in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}` +
        (stop !== 'end_turn' ? `  ⚠ stop_reason=${stop} (may be truncated — re-run with higher max_tokens)` : ''),
    )
    return { ok: true, truncated: stop === 'max_tokens' }
  } catch (e) {
    console.log(`  ERR   ${filename} — ${e?.message || e}`)
    return { ok: false }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const docsArg = args.find((a) => a.startsWith('--docs='))
  const docs = docsArg ? docsArg.slice('--docs='.length).split(',').map((s) => s.trim()).filter(Boolean) : OCR_DOCS

  const env = Object.fromEntries(
    readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
      .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')] }),
  )
  // Large scanned PDFs (multi-MB, high-res) can take a while — give them headroom.
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 600000, maxRetries: 2 })

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  console.log(`OCR ${docs.length} document(s) -> ${CACHE_DIR}\n`)
  let ok = 0, truncated = []
  for (const f of docs) {
    const r = await ocrOne(anthropic, f, force)
    if (r.ok) ok++
    if (r.truncated) truncated.push(f)
  }
  console.log(`\nDone. ${ok}/${docs.length} OK.` + (truncated.length ? `  ⚠ truncated: ${truncated.join(', ')}` : ''))
}

import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
