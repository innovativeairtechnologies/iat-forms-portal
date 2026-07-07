// Shared field validation for the deals API (POST + PATCH). The React client
// is well-behaved, but requireDealsAuth deliberately opens these routes to
// every sales-role session as a plain API — so the routes, not the UI, are the
// trust boundary. Returns clean 400 messages instead of letting bad values
// surface as raw Postgres constraint errors (500s).

const TEXT_FIELDS = ['assigned_to', 'unit_model', 'job_name', 'projected', 'rep', 'rep_contact', 'notes'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate + coerce one whitelisted field value. Returns { value } with the
 * sanitized value to write, or { error } with a client-safe message.
 */
export function sanitizeDealField(field: string, raw: unknown): { value?: unknown; error?: string } {
  switch (field) {
    case 'customer': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'customer must be a non-empty string' }
      return { value: raw.trim() }
    }
    case 'group_name': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'group_name must be a non-empty string' }
      return { value: raw.trim() }
    }
    case 'status': {
      if (raw !== null && raw !== 'Won' && raw !== 'Lost') return { error: 'status must be Won, Lost, or null' }
      return { value: raw }
    }
    case 'confidence': {
      const n = Number(raw)
      if (typeof raw === 'object' || !Number.isFinite(n) || n < 0 || n > 100) {
        return { error: 'confidence must be a number between 0 and 100' }
      }
      return { value: Math.round(n) } // integer column — round rather than 500 on 55.5
    }
    case 'total_cost': {
      const n = Number(raw)
      if (typeof raw === 'object' || !Number.isFinite(n) || n < 0 || n > 1e12) {
        return { error: 'total_cost must be a number between 0 and 1,000,000,000,000' }
      }
      return { value: n }
    }
    case 'date_quoted': {
      if (raw === null || raw === '') return { value: null } // '' from a cleared <input type="date">
      if (typeof raw !== 'string' || !DATE_RE.test(raw)) return { error: 'date_quoted must be a YYYY-MM-DD date or null' }
      return { value: raw }
    }
    default: {
      // free-text nullables
      if ((TEXT_FIELDS as readonly string[]).includes(field)) {
        if (raw === null || raw === '') return { value: null }
        if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
        return { value: raw }
      }
      return { error: `unknown field ${field}` }
    }
  }
}
