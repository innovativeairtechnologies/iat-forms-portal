// Shared field validation for the deals API (POST + PATCH). The React client
// is well-behaved, but requireDealsAuth deliberately opens these routes to
// every sales-role session as a plain API — so the routes, not the UI, are the
// trust boundary. Returns clean 400 messages instead of letting bad values
// surface as raw Postgres constraint errors (500s).

import { CHECKLIST_STEPS, STAGE_KEYS, isRealDate } from '@/lib/deals'

const TEXT_FIELDS = ['assigned_to', 'unit_model', 'job_name', 'projected', 'rep', 'rep_contact', 'notes'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Nullable date columns (migration 061) — real-date checked so Postgres never
 *  sees 2026-02-31 (which the shape regex alone would let through as a 500). */
const NULLABLE_DATE_FIELDS = ['expected_close', 'next_step_due'] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Nullable uuid FK columns (migration 062). Shape-checked here; the routes
 *  verify the row actually EXISTS before writing (a dangling uuid would
 *  surface as a raw FK-violation 500 otherwise). */
const NULLABLE_UUID_FIELDS = ['company_id', 'primary_contact_id'] as const

const CHECKLIST_KEYS = new Set<string>(CHECKLIST_STEPS.map((s) => s.key))

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
    case 'focused': {
      if (typeof raw !== 'boolean') return { error: 'focused must be a boolean' }
      return { value: raw }
    }
    case 'project_type': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string') return { error: 'project_type must be a string or null' }
      const v = raw.trim()
      if (v.length > 100) return { error: 'project_type is too long' }
      return { value: v }
    }
    case 'stage': {
      if (typeof raw !== 'string' || !(STAGE_KEYS as readonly string[]).includes(raw)) {
        return { error: `stage must be one of ${STAGE_KEYS.join(', ')}` }
      }
      return { value: raw }
    }
    case 'closed_reason': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string') return { error: 'closed_reason must be a string or null' }
      const v = raw.trim()
      if (v.length > 300) return { error: 'closed_reason is too long (300 chars max)' }
      return { value: v }
    }
    case 'next_step': {
      if (raw === null || raw === '') return { value: null }
      if (typeof raw !== 'string') return { error: 'next_step must be a string or null' }
      const v = raw.trim()
      if (v.length > 500) return { error: 'next_step is too long (500 chars max)' }
      return { value: v }
    }
    case 'checklist': {
      // Full-replace semantics: the modal sends the complete map on each
      // toggle. Only known step keys, only booleans — jsonb would happily
      // store anything, so the shape is enforced here.
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { error: 'checklist must be an object of step → boolean' }
      }
      const clean: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!CHECKLIST_KEYS.has(k)) return { error: `checklist has unknown step "${k}"` }
        if (typeof v !== 'boolean') return { error: `checklist.${k} must be a boolean` }
        clean[k] = v
      }
      return { value: clean }
    }
    default: {
      // nullable uuid FKs (062)
      if ((NULLABLE_UUID_FIELDS as readonly string[]).includes(field)) {
        if (raw === null || raw === '') return { value: null }
        if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: `${field} must be a uuid or null` }
        return { value: raw }
      }
      // nullable dates (061) — full calendar validation, not just shape
      if ((NULLABLE_DATE_FIELDS as readonly string[]).includes(field)) {
        if (raw === null || raw === '') return { value: null }
        if (typeof raw !== 'string' || !isRealDate(raw)) return { error: `${field} must be a real YYYY-MM-DD date or null` }
        return { value: raw }
      }
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
