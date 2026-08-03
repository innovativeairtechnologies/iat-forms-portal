// Field validation for the rep-scorecard API (migration 075). Same posture as
// the deals/territories validators: the routes ARE the trust boundary
// (requireRepScorecardAuth admits every sales-role session as a plain API), so
// shapes are enforced here and return clean 400s instead of raw Postgres CHECK
// violations.

import { SIGNAL_KEYS, REP_STATUSES, isPeriod } from '@/lib/rep-scorecard'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Checked = { value?: unknown; error?: string }

export function parseUuid(field: string, raw: unknown): { value?: string; error?: string } {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: `${field} must be a uuid` }
  return { value: raw }
}

export function parsePeriod(raw: unknown): { value?: string; error?: string } {
  if (!isPeriod(raw)) return { error: 'period must look like 2026-Q3' }
  return { value: raw }
}

const SIGNAL_SET = new Set<string>(SIGNAL_KEYS)

// Hard-number ceilings. Generous but finite — they exist so a fat-fingered
// paste lands as a 400 rather than a numeric-overflow 500 (annual_goal is
// numeric(14,2), so 10^12 is the real wall).
const MONEY_MAX = 999_999_999_999

/** Money / count / rate fields. Empty string and null both clear the cell. */
function parseNumber(field: string, raw: unknown, opts: { min: number; max: number; integer?: boolean }): Checked {
  if (raw === null || raw === '' || raw === undefined) return { value: null }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return { error: `${field} must be a number` }
  if (opts.integer && !Number.isInteger(n)) return { error: `${field} must be a whole number` }
  if (n < opts.min || n > opts.max) return { error: `${field} is out of range` }
  return { value: n }
}

/**
 * One scorecard field. Signals accept 0/1/2 or null (null = "not scored yet",
 * which is genuinely different from 0 — see migration 075).
 */
export function sanitizeScorecardField(field: string, raw: unknown): Checked {
  if (SIGNAL_SET.has(field)) {
    if (raw === null || raw === '' || raw === undefined) return { value: null }
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isInteger(n) || n < 0 || n > 2) return { error: `${field} must be 0, 1, 2 or null` }
    return { value: n }
  }
  switch (field) {
    case 'annual_goal':
    case 'booked_ytd':
    case 'open_pipeline':
      return parseNumber(field, raw, { min: 0, max: MONEY_MAX })
    case 'rfqs_60d':
      return parseNumber(field, raw, { min: 0, max: 100_000, integer: true })
    case 'hit_rate':
      // Stored as a fraction (0.40 = 40%), matching the workbook's cell format.
      return parseNumber(field, raw, { min: 0, max: 1 })
    case 'notes': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string') return { error: 'notes must be a string or null' }
      const v = raw.trim()
      if (v.length > 4000) return { error: 'notes is too long (4000 chars max)' }
      return { value: v || null }
    }
    default:
      return { error: `unknown field ${field}` }
  }
}

export const SCORECARD_FIELDS = [
  ...SIGNAL_KEYS,
  'annual_goal', 'booked_ytd', 'open_pipeline', 'rfqs_60d', 'hit_rate', 'notes',
] as const

// ── Rep (contacts) fields this API owns ──────────────────────────────────────
// `territory` and `rep_status` are the two columns 075 added to the shared CRM
// contacts table; name/title/email/phone are 062's and validated the same way.

const REP_TEXT_MAX: Record<string, number> = {
  title: 120, territory: 120, email: 200, phone: 50,
}

export function sanitizeRepField(field: string, raw: unknown): Checked {
  switch (field) {
    case 'name': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'name must be a non-empty string' }
      if (raw.trim().length > 200) return { error: 'name is too long (200 chars max)' }
      return { value: raw.trim() }
    }
    case 'rep_status': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string' || !(REP_STATUSES as readonly string[]).includes(raw)) {
        return { error: `rep_status must be one of ${REP_STATUSES.join(', ')}` }
      }
      return { value: raw }
    }
    default: {
      if (!(field in REP_TEXT_MAX)) return { error: `unknown field ${field}` }
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
      const v = raw.trim()
      if (v.length > REP_TEXT_MAX[field]) return { error: `${field} is too long (${REP_TEXT_MAX[field]} chars max)` }
      return { value: v || null }
    }
  }
}

export const REP_FIELDS = ['name', 'title', 'territory', 'rep_status', 'email', 'phone'] as const
