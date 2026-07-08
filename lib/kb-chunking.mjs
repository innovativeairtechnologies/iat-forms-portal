// Shared KB chunking helpers — the page-sized chunking used to load documents into
// the RAG pool (kb_documents / kb_chunks, migration 030). Kept as a plain `.mjs`
// so both the Node ingest script (scripts/ingest-kb-docs.mjs) and the serverless
// upload route (app/api/admin/kb/ingest) can import identical logic. Competitor
// scrubbing runs here so a competitor name can never even be indexed, wherever a
// document enters the pool from.

import { scrubCompetitors } from './competitors.mjs'

// Chunking: ~page-sized. Most datasheet pages fall under one chunk; dense pages
// split with a small overlap so a fact straddling the split is still retrievable.
export const MAX_WORDS = 320
export const OVERLAP_WORDS = 40

// Control chars Postgres `text` can't store (NUL + other C0, keeping \t and \n),
// plus the U+FFFD replacement char. Kept as a RegExp built from escapes so the
// source file stays plain ASCII.
const STRIP_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFD]', 'g')

/** Tidy extracted page text without destroying it: drop CRs, strip un-storable
 *  control chars, trim trailing spaces, collapse 3+ blank lines. */
export function cleanText(s) {
  return String(s ?? '')
    .replace(/\r/g, '')
    .replace(STRIP_CHARS, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Split one page's words into ~maxWords chunks with `overlap` words of overlap. */
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

/** Turn an array of per-page strings into chunk rows (page numbers preserved for
 *  citations, running chunk_index). Each page is cleaned + competitor-scrubbed;
 *  blank / image-only pages yield no chunks. */
export function buildChunks(pages) {
  const rows = []
  let idx = 0
  pages.forEach((raw, p) => {
    const clean = scrubCompetitors(cleanText(raw))
    if (!clean) return
    for (const content of chunkPageWords(clean)) {
      if (!content.trim()) continue
      rows.push({ chunk_index: idx++, page_number: p + 1, content })
    }
  })
  return rows
}

/** Split a Claude transcription (page-delimited by "===== PAGE N =====" markers)
 *  into per-page strings, dropping "(no text)" pages. Falls back to a single page
 *  when no markers are present. Mirrors the OCR-sidecar format the CLI already uses. */
export function pagesFromTranscript(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return []
  const parts = raw
    .split(/^=+ ?PAGE \d+ ?=+$/im)
    .map((s) => s.trim())
    .filter((s) => s && !/^\(no text\)$/i.test(s))
  return parts.length ? parts : [raw.trim()]
}

/** Human title from an uploaded filename (strip extension, tidy separators). */
export function titleFromFilename(filename) {
  return String(filename || 'Document')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Document'
}
