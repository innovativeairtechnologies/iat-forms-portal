import sanitizeHtml from 'sanitize-html'

// Allowlist matching what the ticket-note RichTextEditor (TipTap StarterKit +
// Link + Image) can legitimately produce. Everything else — <script>, inline
// event handlers, javascript:/data: URLs, style, iframe, etc. — is stripped.
// This is the authoritative XSS boundary for ticket notes: applied on write
// (POST /api/tickets/[id]/notes) AND on read (the ticket detail page sanitizes
// existing rows server-side before they reach the client), so stored HTML can
// never execute in an admin's session.
const NOTE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike', 'u',
    'ul', 'ol', 'li', 'a', 'img', 'h1', 'h2', 'h3', 'h4',
    'code', 'pre', 'blockquote', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
  },
  // Only safe URL schemes. Drops javascript:, data:, vbscript:, etc.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Force external links to be safe.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
  disallowedTagsMode: 'discard',
}

/** Sanitize a rich-text ticket note to a safe HTML subset. */
export function sanitizeNoteHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, NOTE_OPTIONS)
}

/** True if the note has real content (text or an image) after sanitizing. */
export function noteHasContent(cleanHtml: string): boolean {
  const text = cleanHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length > 0 || /<img\b/i.test(cleanHtml)
}

/**
 * Flatten a sanitized note to plain text for a notification email.
 *
 * Alert bodies escape whatever they are given and render it in a
 * white-space:pre-wrap block, so handing them HTML would show the reader literal
 * <p> tags. Block boundaries become newlines first so sentences don't run
 * together, then tags are dropped and the handful of entities sanitize-html
 * produces are decoded. Bounded because an alert is a nudge to go read the
 * ticket, not a copy of it.
 */
export function noteHtmlToText(cleanHtml: string, maxLength = 2000): string {
  const text = cleanHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<img\b[^>]*>/gi, '[image]')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&') // last, so "&amp;lt;" does not decode twice into "<"
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() + '…' : text
}

export type NoteAttachment = { path: string; name: string; type: string; size: number }

/**
 * Validate/normalize note attachment metadata coming from the client. The only
 * security-relevant field is `path`: it must live under THIS ticket's storage
 * prefix (and contain no traversal), so a note can never reference another
 * ticket's files. Everything else is cosmetic and just length-bounded. Returns
 * at most 20 attachments. Applied on write and on read.
 */
export function sanitizeAttachments(input: unknown, ticketId: string): NoteAttachment[] {
  if (!Array.isArray(input)) return []
  const out: NoteAttachment[] = []
  for (const a of input.slice(0, 20)) {
    if (!a || typeof a !== 'object') continue
    const rec = a as Record<string, unknown>
    const path = typeof rec.path === 'string' ? rec.path : ''
    if (!path.startsWith(`${ticketId}/`) || path.includes('..')) continue
    const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim().slice(0, 255) : 'attachment'
    const type = typeof rec.type === 'string' ? rec.type.slice(0, 100) : ''
    const size = typeof rec.size === 'number' && Number.isFinite(rec.size) ? Math.max(0, Math.floor(rec.size)) : 0
    out.push({ path, name, type, size })
  }
  return out
}
