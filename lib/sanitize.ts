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
