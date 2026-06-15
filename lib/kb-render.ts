import sanitizeHtml from 'sanitize-html'

// Knowledge Base article bodies are authored as a small markdown subset (see
// scripts/sql/kb_articles_seed.sql): `##`/`###` headings, `-`/`*` bullet lists,
// blank-line paragraphs, and inline **bold**, _italic_, `code`. There is no
// markdown dependency in the project, so we render that subset ourselves and run
// the result through sanitize-html as the XSS boundary (same posture as ticket
// notes, see lib/sanitize.ts).

const KB_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li',
    'a', 'h2', 'h3', 'h4', 'code', 'pre', 'blockquote',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
  disallowedTagsMode: 'discard',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Apply inline formatting to already-HTML-escaped text.
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w_])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

/** Render a KB article markdown body to a safe HTML string. */
export function renderKbBody(md: string | null | undefined): string {
  if (!md) return ''

  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listOpen = false
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listOpen) {
      out.push('</ul>')
      listOpen = false
    }
  }

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) {
      flushPara()
      closeList()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(t)
    if (heading) {
      flushPara()
      closeList()
      // Cap headings to h2..h4 — the page itself owns the h1.
      const level = Math.min(Math.max(heading[1].length, 2), 4)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(t)
    if (bullet) {
      flushPara()
      if (!listOpen) {
        out.push('<ul>')
        listOpen = true
      }
      out.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    para.push(t)
  }

  flushPara()
  closeList()

  return sanitizeHtml(out.join('\n'), KB_OPTIONS)
}
