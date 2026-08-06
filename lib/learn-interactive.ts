/* Interactive blocks inside lesson bodies.

   A lesson body is a single HTML string rendered with `dangerouslySetInnerHTML`
   (see `components/learn/LessonContent.tsx`). To let a lesson host something
   the learner can actually operate — the control panel simulator, a point
   explorer — the body carries a self-closing marker:

       <div data-interactive="cpco-sim" data-scenario="bacnet-instance"></div>

   This module splits a body into HTML runs and markers. It is deliberately pure
   string work rather than DOM parsing, because `LessonContent` is a Server
   Component and there is no `document` there.

   A regex over HTML is normally a bad idea. It is safe here for one specific
   reason: the marker is only ever produced by our own TipTap node's
   `renderHTML` (`components/learn/admin/InteractiveBlock.tsx`), so its shape is
   fixed and self-closing. Anything that doesn't match that shape is left alone
   inside an HTML run, where it renders exactly as it does today.

   ⚠️ The single most important property of this file: a body with NO marker
   must come back as one untouched run, so the 357 existing lessons keep taking
   the identical render path they take now. `splitLessonHtml` short-circuits on
   a substring test before the regex ever runs. */

export const INTERACTIVE_ATTR = 'data-interactive'

export type LessonSegment =
  | { kind: 'html'; html: string }
  | { kind: 'interactive'; name: string; params: Record<string, string> }

/* Matches only a self-closing marker div: an opening tag carrying
   data-interactive, optional whitespace, then its closing tag. A div with real
   children is not a marker and is left in the HTML run. */
const MARKER =
  /<div\b(?=[^>]*\bdata-interactive\s*=)([^>]*)>\s*<\/div>/gi

const ATTR = /([a-z-]+)\s*=\s*"([^"]*)"|([a-z-]+)\s*=\s*'([^']*)'/gi

function readAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  ATTR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR.exec(raw))) {
    const key = (m[1] ?? m[3] ?? '').toLowerCase()
    const value = m[2] ?? m[4] ?? ''
    if (key) out[key] = value
  }
  return out
}

/** Cheap enough to call on every lesson render. */
export function hasInteractive(html: string | null | undefined): boolean {
  return !!html && html.includes(INTERACTIVE_ATTR)
}

export function splitLessonHtml(html: string): LessonSegment[] {
  // The fast path that protects every existing lesson.
  if (!hasInteractive(html)) return [{ kind: 'html', html }]

  const segments: LessonSegment[] = []
  let cursor = 0
  MARKER.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = MARKER.exec(html))) {
    const attrs = readAttrs(match[1] ?? '')
    const name = attrs[INTERACTIVE_ATTR]
    if (!name) continue // not a marker after all — leave it in the HTML run

    if (match.index > cursor) {
      segments.push({ kind: 'html', html: html.slice(cursor, match.index) })
    }

    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(attrs)) {
      if (key === INTERACTIVE_ATTR) continue
      if (key.startsWith('data-')) params[key.slice(5)] = value
    }

    segments.push({ kind: 'interactive', name, params })
    cursor = match.index + match[0].length
  }

  if (cursor < html.length) segments.push({ kind: 'html', html: html.slice(cursor) })
  return segments
}

/** Builds a marker. Used by the TipTap node and by the course seed, so both
    sides can never disagree about the shape. */
export function interactiveMarker(name: string, params: Record<string, string> = {}): string {
  const extra = Object.entries(params)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ` data-${k}="${v}"`)
    .join('')
  return `<div ${INTERACTIVE_ATTR}="${name}"${extra}></div>`
}
