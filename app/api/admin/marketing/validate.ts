// Field validation for the marketing-calendar API (migration 071). Same posture
// as ../territories/validate.ts: the route is the trust boundary
// (requireMarketingAuth admits marketing + admin sessions as a plain API), so
// shapes are enforced here with clean 400s instead of raw Postgres errors.
//
// It is also the ONLY enforcement of the channel/status/platform taxonomy — the
// table deliberately carries no CHECK constraint so the lists stay a one-line
// edit in lib/marketing.ts (see the migration's header for the reasoning).

import {
  isRealDate, isChannel, isStatus, isPlatform,
  DEFAULT_CHANNEL, DEFAULT_STATUS, LIMITS,
} from '@/lib/marketing'

export const MIGRATION_HINT =
  'The marketing calendar needs migration 071_marketing_calendar.sql — run it with `npx supabase db push`.'

/** Pre-migration the table is absent; callers turn this into a 503 with the
 *  hint above rather than leaking a raw Postgres 500. */
export const isMissingTable = (msg: string) =>
  /marketing_events/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg)

const TEXT_FIELDS = { owner: LIMITS.owner, notes: LIMITS.notes } as const

function parseText(field: keyof typeof TEXT_FIELDS, raw: unknown): { value?: string | null; error?: string } {
  if (raw === null || raw === '' || raw === undefined) return { value: null }
  if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
  const v = raw.trim()
  if (v.length > TEXT_FIELDS[field]) {
    return { error: `${field} is too long (${TEXT_FIELDS[field]} chars max)` }
  }
  return { value: v || null }
}

/**
 * A link is rendered as an `<a href>` in the side panel, so the scheme is a
 * security boundary, not a formatting nicety: `javascript:`/`data:` here would
 * be stored XSS the moment someone clicks it. Only http(s) is accepted, and a
 * bare "buffer.com/x" (what people actually paste) is promoted to https rather
 * than rejected — left alone it would resolve as a relative portal path.
 */
export function parseLink(raw: unknown): { value?: string | null; error?: string } {
  if (raw === null || raw === '' || raw === undefined) return { value: null }
  if (typeof raw !== 'string') return { error: 'link must be a string or null' }
  const v = raw.trim()
  if (!v) return { value: null }
  if (v.length > LIMITS.link) return { error: `link is too long (${LIMITS.link} chars max)` }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { error: 'That link is not a valid URL.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Links must start with http:// or https://' }
  }
  return { value: url.toString() }
}

type Values = Record<string, unknown>

/**
 * Build the insert payload for POST. Requires a real date and a title; every
 * other field falls back to its default.
 */
export function buildEventInsert(body: Values): { values?: Values; error?: string } {
  const event_date = typeof body.event_date === 'string' ? body.event_date : ''
  if (!isRealDate(event_date)) return { error: 'Pick a valid date.' }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return { error: 'Give it a title.' }
  if (title.length > LIMITS.title) return { error: `Title is too long (${LIMITS.title} chars max)` }

  const channel = isChannel(body.channel) ? body.channel : DEFAULT_CHANNEL
  const status = isStatus(body.status) ? body.status : DEFAULT_STATUS

  const owner = parseText('owner', body.owner)
  if (owner.error) return { error: owner.error }
  const notes = parseText('notes', body.notes)
  if (notes.error) return { error: notes.error }
  const link = parseLink(body.link)
  if (link.error) return { error: link.error }

  return {
    values: {
      event_date, title, channel, status,
      platform: platformFor(channel, body.platform),
      owner: owner.value, notes: notes.value, link: link.value,
    },
  }
}

/**
 * Build the update payload for PATCH — only the keys actually present in the
 * body are touched, so the panel's one-click status change doesn't have to
 * round-trip the whole record.
 *
 * `platform` is only meaningful on a social post, so it is always written
 * TOGETHER with `channel`: changing an event from Social to Email must clear a
 * stale "LinkedIn" in the same statement. A patch carrying `platform` without
 * `channel` is therefore rejected rather than silently storing a platform the
 * channel can't have — the edit form always sends both.
 */
export function buildEventPatch(body: Values): { values?: Values; error?: string } {
  const values: Values = {}

  if ('event_date' in body) {
    const d = typeof body.event_date === 'string' ? body.event_date : ''
    if (!isRealDate(d)) return { error: 'Pick a valid date.' }
    values.event_date = d
  }

  if ('title' in body) {
    const t = typeof body.title === 'string' ? body.title.trim() : ''
    if (!t) return { error: 'Give it a title.' }
    if (t.length > LIMITS.title) return { error: `Title is too long (${LIMITS.title} chars max)` }
    values.title = t
  }

  if ('channel' in body) {
    if (!isChannel(body.channel)) return { error: 'Unknown channel.' }
    values.channel = body.channel
    values.platform = platformFor(body.channel, body.platform)
  } else if ('platform' in body) {
    return { error: 'Send channel alongside platform.' }
  }

  if ('status' in body) {
    if (!isStatus(body.status)) return { error: 'Unknown status.' }
    values.status = body.status
  }

  for (const field of ['owner', 'notes'] as const) {
    if (field in body) {
      const parsed = parseText(field, body[field])
      if (parsed.error) return { error: parsed.error }
      values[field] = parsed.value
    }
  }

  if ('link' in body) {
    const parsed = parseLink(body.link)
    if (parsed.error) return { error: parsed.error }
    values.link = parsed.value
  }

  if (Object.keys(values).length === 0) return { error: 'Nothing to update.' }
  // The table has no updated_at trigger — the writers stamp it.
  values.updated_at = new Date().toISOString()
  return { values }
}

/** Platform is dropped for every channel but social. */
function platformFor(channel: string, raw: unknown): string | null {
  return channel === 'social' && isPlatform(raw) ? raw : null
}
