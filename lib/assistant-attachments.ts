import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Attachment support for the INTERNAL Jerry assistants (admin ticket + standalone
// /admin/jerry). A staff member can attach photos of a unit or PDFs (submittal,
// PO, wiring diagram) for Jerry to look at and help diagnose. This turns those
// attachments into Anthropic vision content blocks and validates them server-side
// (the client already downscales images and caps sizes — this is defense in depth).
//
// The customer assistant does NOT use this — its route ignores any attachments,
// so uploads are internal-only by construction.
// ─────────────────────────────────────────────────────────────────────────────

// What the client sends per attachment: base64 (no data-URL prefix) + its media type.
export type IncomingAttachment = { kind?: string; mediaType?: string; data?: string; name?: string }

// Anthropic accepts these image media types for base64 image blocks.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// Server-side caps (generous — the browser already enforces tighter limits).
const MAX_ATTACHMENTS = 6
const MAX_ONE_BYTES = 8 * 1024 * 1024 // per file (decoded)
const MAX_TOTAL_BYTES = 12 * 1024 * 1024 // across a whole request

const b64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4)

/** Drop anything malformed / oversize / wrong-typed; enforce count + total caps. */
export function sanitizeAttachments(raw: unknown): IncomingAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: IncomingAttachment[] = []
  let total = 0
  for (const a of raw) {
    if (out.length >= MAX_ATTACHMENTS) break
    if (!a || typeof a !== 'object') continue
    const { mediaType, data, kind, name } = a as IncomingAttachment
    if (typeof data !== 'string' || !data) continue
    if (typeof mediaType !== 'string') continue
    const isImage = IMAGE_TYPES.has(mediaType)
    const isPdf = mediaType === 'application/pdf'
    if (!isImage && !isPdf) continue
    const bytes = b64Bytes(data)
    if (bytes <= 0 || bytes > MAX_ONE_BYTES) continue
    if (total + bytes > MAX_TOTAL_BYTES) continue
    total += bytes
    out.push({ kind: isPdf ? 'pdf' : 'image', mediaType, data, name: typeof name === 'string' ? name : undefined })
  }
  return out
}

/**
 * Build the Anthropic message `content` for a user turn: attachments first
 * (documents/images before text, per the vision guidance), then the text. Returns
 * a plain string when there are no attachments (cheaper, unchanged behavior).
 * A text block is always included — if the turn is attachment-only, a short
 * default prompt stands in so the model has an instruction to act on.
 */
export function buildUserContent(text: string, attachments: IncomingAttachment[]): string | Anthropic.ContentBlockParam[] {
  const clean = (text || '').trim()
  if (!attachments.length) return clean

  const blocks: Anthropic.ContentBlockParam[] = []
  for (const a of attachments) {
    if (a.kind === 'pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: a.data as string },
      })
    } else {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: a.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: a.data as string,
        },
      })
    }
  }
  blocks.push({
    type: 'text',
    text: clean || 'Please take a look at the attached file(s) and help me diagnose the issue.',
  })
  return blocks
}

/** A concise, model-facing note describing what the staffer attached this turn. */
export function attachmentSummary(attachments: IncomingAttachment[]): string {
  if (!attachments.length) return ''
  const imgs = attachments.filter((a) => a.kind === 'image').length
  const pdfs = attachments.filter((a) => a.kind === 'pdf').length
  const parts: string[] = []
  if (imgs) parts.push(`${imgs} photo${imgs > 1 ? 's' : ''}`)
  if (pdfs) parts.push(`${pdfs} PDF${pdfs > 1 ? 's' : ''}`)
  return parts.join(' and ')
}
