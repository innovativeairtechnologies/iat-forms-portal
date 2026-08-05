// Field validation for the compensation-review API (migration 078). Same posture
// as the rep-scorecard/deals/territories validators: the routes ARE the trust
// boundary (requireCompReviewAuth admits every HR-role session as a plain API),
// so shapes are enforced here and return clean 400s instead of raw Postgres
// CHECK violations or numeric-overflow 500s.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Checked = { value?: unknown; error?: string }

export function parseUuid(field: string, raw: unknown): { value?: string; error?: string } {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: `${field} must be a uuid` }
  return { value: raw }
}

/** Ceilings track the column widths in 078 exactly, so a fat-fingered paste is a
 *  400 rather than a numeric-overflow 500. */
const MONEY_MAX = 999_999_999_999 // gross_annual / bonus — numeric(14,2)
const RATE_MAX = 999_999          // per_hour — numeric(10,4)
const SCORE_MAX = 99_999          // score — numeric(8,3)

function parseNumber(
  field: string,
  raw: unknown,
  opts: { min: number; max: number; exclusiveMin?: boolean },
): Checked {
  if (raw === null || raw === '' || raw === undefined) return { value: null }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return { error: `${field} must be a number` }
  if (opts.exclusiveMin ? n <= opts.min : n < opts.min) return { error: `${field} is out of range` }
  if (n > opts.max) return { error: `${field} is out of range` }
  return { value: n }
}

function parseText(field: string, raw: unknown, max: number): Checked {
  if (raw === null || raw === '' || raw === undefined) return { value: null }
  if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
  const v = raw.trim()
  if (v.length > max) return { error: `${field} is too long (${max} chars max)` }
  return { value: v || null }
}

// ── Review lines ─────────────────────────────────────────────────────────────

/**
 * One line field.
 *
 * `per_hour` and `gross_annual` are both nullable and neither is required —
 * employees are hourly OR salaried, and forcing a fake rate onto salaried staff
 * would corrupt the payroll total. `score` has NO upper bound beyond the column
 * width: the model divides by the mean of this same column, so it is
 * scale-agnostic (1–5, 1–10 and 0–100 all behave identically) and a ceiling here
 * would break a reviewer scoring out of 100 for no gain.
 */
export function sanitizeLineField(field: string, raw: unknown): Checked {
  switch (field) {
    case 'person_name': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'person_name must be a non-empty string' }
      if (raw.trim().length > 200) return { error: 'person_name is too long (200 chars max)' }
      return { value: raw.trim() }
    }
    case 'employee_id': {
      if (raw === null || raw === '' || raw === undefined) return { value: null }
      const check = parseUuid('employee_id', raw)
      return check.error ? { error: check.error } : { value: check.value }
    }
    case 'tenure_override': return parseText(field, raw, 60)
    case 'per_hour':        return parseNumber(field, raw, { min: 0, max: RATE_MAX })
    case 'gross_annual':    return parseNumber(field, raw, { min: 0, max: MONEY_MAX })
    case 'bonus':           return parseNumber(field, raw, { min: 0, max: MONEY_MAX })
    case 'score':           return parseNumber(field, raw, { min: 0, max: SCORE_MAX })
    case 'notes':           return parseText(field, raw, 4000)
    default:                return { error: `unknown field ${field}` }
  }
}

export const LINE_FIELDS = [
  'person_name', 'employee_id', 'tenure_override',
  'per_hour', 'gross_annual', 'bonus', 'score', 'notes',
] as const

// ── Cycles ───────────────────────────────────────────────────────────────────

/**
 * One cycle field. The four constants reproduce the workbook's literals by
 * default; changing any of them re-prices every unfinalized row at once, which
 * is why the routes gate these behind `adminOnly`.
 */
export function sanitizeCycleField(field: string, raw: unknown): Checked {
  switch (field) {
    case 'year': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isInteger(n) || n < 2000 || n > 2100) return { error: 'year must be between 2000 and 2100' }
      return { value: n }
    }
    case 'label': return parseText(field, raw, 120)
    // Workbook O's multiplier (4.1). numeric(6,3).
    case 'raise_pool': return parseNumber(field, raw, { min: 0, max: 999 })
    // Workbook H's divisor (48). Must be > 0 — a zero divisor is the one input
    // that would turn every raise into a division by zero.
    case 'divisor': return parseNumber(field, raw, { min: 0, max: 99_999, exclusiveMin: true })
    case 'hours_per_week': return parseNumber(field, raw, { min: 0, max: 168, exclusiveMin: true })
    case 'weeks_per_year': return parseNumber(field, raw, { min: 0, max: 53, exclusiveMin: true })
    default: return { error: `unknown field ${field}` }
  }
}

/** Constants only — `status` is NOT here on purpose: finalizing has to write the
 *  frozen average in the same statement (078's comp_cycles_final_has_avg CHECK),
 *  so it is handled explicitly by the route rather than as a generic field. */
export const CYCLE_FIELDS = ['label', 'raise_pool', 'divisor', 'hours_per_week', 'weeks_per_year'] as const
