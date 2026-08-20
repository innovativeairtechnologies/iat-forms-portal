/**
 * Single rule for every human name the portal PUTS ON SCREEN.
 *
 * Names reach us from three places that don't agree with each other:
 * `profiles.display_name` (typed by whoever sent the invite), `employees.name`,
 * and — when both are blank — the email address itself. The invite form has
 * historically been filled in with the email local-part, so rows like
 * `lee.childers` and `crystal` sit in the DB today and render verbatim.
 *
 * A dotted local-part must never appear as a person's name in the UI, so this
 * normalizes at render time rather than trusting the stored value:
 *
 *   'lee.childers'                    -> 'Lee Childers'
 *   'crystal'                         -> 'Crystal'
 *   'lee.childers@dehumidifiers.com'  -> 'Lee Childers'
 *   'Jacob Younker'                   -> 'Jacob Younker'   (untouched)
 *
 * The dot-splitting is deliberately gated on the string containing NO
 * whitespace — that's what distinguishes an email local-part from a real name
 * someone typed. A properly typed name keeping its own punctuation ('Robert
 * A. Smith', 'St. John') passes through unchanged, because it has spaces.
 *
 * Capitalization is likewise only applied to tokens that are entirely
 * lowercase, so 'McDonald' and 'DeAngelo' survive intact.
 */
export function prettyName(raw: string | null | undefined, fallback = ''): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return fallback

  // An email may arrive as the whole fallback value — keep only the local part.
  const local = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed

  // Whitespace means a human typed this; leave their punctuation alone.
  const tokens = /\s/.test(local) ? local.split(/\s+/) : local.split(/[._-]+/)

  const out = tokens
    .filter(Boolean)
    .map(t => (t === t.toLowerCase() ? t.charAt(0).toUpperCase() + t.slice(1) : t))
    .join(' ')

  return out || fallback
}

/** First name only — what the home/Learn greetings show. */
export function firstNameOf(raw: string | null | undefined, fallback = ''): string {
  return prettyName(raw, fallback).split(' ')[0] || fallback
}
