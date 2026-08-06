import { extractText, getDocumentProxy } from 'unpdf'

// ─────────────────────────────────────────────────────────────────────────────
// Read a PDF's own text layer, before spending anything on AI.
//
// WHY THIS EXISTS: transcription by vision has a hard ceiling — one pass returns
// at most 16k tokens, roughly 40-60 pages. The 122-page ASPYRE manual is ~69k
// tokens of text, so vision cannot read it at all; it truncates, and truncation
// is (correctly) treated as failure. The same manual's embedded text layer
// extracts completely in about 600ms, for nothing, with every voltage spec,
// alarm code and torque figure intact.
//
// Most technical documentation — manuals, spec sheets, submittals produced by a
// CAD or publishing tool — is born-digital and carries that layer. Scanned paper
// does not, and genuinely needs vision. So this runs first and vision becomes
// the fallback for the documents that actually require it, rather than the
// default for everything.
//
// Fidelity matters more than brevity here: this is what Jerry quotes from, so
// the goal is the document's own words, complete — never a summary. A condensed
// version reads well and answers nothing, because the specifics are the point.
// ─────────────────────────────────────────────────────────────────────────────

/** Below this, a "text layer" is really scattered labels on scanned images or a
 *  graphics-led brochure — thin enough that vision will read it better. Chosen
 *  against the real library: a born-digital manual runs ~280 words/page, a
 *  graphics brochure ~52, a scanned document 0. */
const MIN_WORDS_PER_PAGE = 90

export type ExtractResult =
  | { ok: true; text: string; pageCount: number; wordsPerPage: number }
  | { ok: false; reason: 'no-text-layer' | 'error'; pageCount: number; wordsPerPage: number; message: string }

/**
 * Pull the text layer out of a PDF. Page markers match the transcription format
 * exactly (`===== PAGE n =====`) so downstream chunking, page counting and
 * citation are identical whichever way the text was produced — nothing further
 * along needs to know or care.
 */
export async function extractPdfText(bytes: Buffer): Promise<ExtractResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    // Per page, not merged: the page boundaries are what let Jerry cite "page 47"
    // instead of gesturing at the document as a whole.
    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    const pages: string[] = Array.isArray(text) ? text : [String(text ?? '')]

    const words = pages.join(' ').trim().split(/\s+/).filter(Boolean).length
    const perPage = words / Math.max(1, totalPages)

    if (perPage < MIN_WORDS_PER_PAGE) {
      return {
        ok: false,
        reason: 'no-text-layer',
        pageCount: totalPages,
        wordsPerPage: Math.round(perPage),
        message: `Only ${Math.round(perPage)} words per page in the text layer — this looks scanned or image-led.`,
      }
    }

    const assembled = pages
      .map((p, i) => `===== PAGE ${i + 1} =====\n${(p || '').trim() || '(no text)'}`)
      .join('\n\n')

    return { ok: true, text: assembled, pageCount: totalPages, wordsPerPage: Math.round(perPage) }
  } catch (e) {
    // A malformed or encrypted PDF is not fatal — vision may still manage it.
    return {
      ok: false,
      reason: 'error',
      pageCount: 0,
      wordsPerPage: 0,
      message: e instanceof Error ? e.message : 'Could not read the PDF structure.',
    }
  }
}
