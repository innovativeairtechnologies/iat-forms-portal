// Field validation for the CRM companies/contacts API (migration 062). Same
// posture as ../validate.ts: the routes are the trust boundary (requireCrmAuth
// admits every sales-role session as a plain API), so shapes are enforced here
// with clean 400s instead of raw Postgres errors.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const COMPANY_KINDS = ['prospect', 'customer', 'rep_firm', 'other'] as const

const COMPANY_TEXT_FIELDS: Record<string, number> = {
  domain: 200, website: 300, phone: 50, location: 200, notes: 5000,
}
const CONTACT_TEXT_FIELDS: Record<string, number> = {
  title: 120, email: 200, phone: 50, notes: 2000,
}

function textOrNull(field: string, raw: unknown, max: number): { value?: unknown; error?: string } {
  if (raw === null || raw === '') return { value: null }
  if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
  const v = raw.trim()
  if (v.length > max) return { error: `${field} is too long (${max} chars max)` }
  return { value: v }
}

export function sanitizeCompanyField(field: string, raw: unknown): { value?: unknown; error?: string } {
  switch (field) {
    case 'name': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'name must be a non-empty string' }
      if (raw.trim().length > 200) return { error: 'name is too long (200 chars max)' }
      return { value: raw.trim() }
    }
    case 'kind': {
      if (typeof raw !== 'string' || !(COMPANY_KINDS as readonly string[]).includes(raw)) {
        return { error: `kind must be one of ${COMPANY_KINDS.join(', ')}` }
      }
      return { value: raw }
    }
    case 'customer_id': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: 'customer_id must be a uuid or null' }
      return { value: raw }
    }
    default: {
      if (field in COMPANY_TEXT_FIELDS) return textOrNull(field, raw, COMPANY_TEXT_FIELDS[field])
      return { error: `unknown field ${field}` }
    }
  }
}

export function sanitizeContactField(field: string, raw: unknown): { value?: unknown; error?: string } {
  switch (field) {
    case 'company_id': {
      if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: 'company_id must be a uuid' }
      return { value: raw }
    }
    case 'name': {
      if (typeof raw !== 'string' || !raw.trim()) return { error: 'name must be a non-empty string' }
      if (raw.trim().length > 200) return { error: 'name is too long (200 chars max)' }
      return { value: raw.trim() }
    }
    case 'is_primary': {
      if (typeof raw !== 'boolean') return { error: 'is_primary must be a boolean' }
      return { value: raw }
    }
    default: {
      if (field in CONTACT_TEXT_FIELDS) return textOrNull(field, raw, CONTACT_TEXT_FIELDS[field])
      return { error: `unknown field ${field}` }
    }
  }
}
