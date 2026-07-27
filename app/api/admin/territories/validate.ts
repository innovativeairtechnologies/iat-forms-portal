// Field validation for the territory-map API (migration 068). Same posture as
// ../deals/companies/validate.ts: the routes are the trust boundary
// (requireTerritoryAuth admits admin + sales sessions as a plain API), so
// shapes are enforced here with clean 400s instead of raw Postgres errors.

import { TERRITORY_LEVELS, isValidTerritoryCode, type TerritoryLevel } from '@/lib/territories'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseUuid(field: string, raw: unknown): { value?: string; error?: string } {
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: `${field} must be a uuid` }
  return { value: raw }
}

/** { level, code } — the geography half of an assignment triple. */
export function parseTerritory(raw: { level?: unknown; code?: unknown }): {
  value?: { level: TerritoryLevel; code: string }
  error?: string
} {
  const level = raw.level
  if (typeof level !== 'string' || !(TERRITORY_LEVELS as readonly string[]).includes(level)) {
    return { error: `level must be one of ${TERRITORY_LEVELS.join(', ')}` }
  }
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : ''
  // County FIPS are digits — toUpperCase is a no-op there; state/province codes
  // normalize to the canonical uppercase the geo files and tables use.
  if (!code || !isValidTerritoryCode(level as TerritoryLevel, code)) {
    return { error: `code "${String(raw.code)}" is not a valid ${level} code` }
  }
  return { value: { level: level as TerritoryLevel, code } }
}

export function parseExclusivity(raw: unknown): { value?: string | null; error?: string } {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  if (typeof raw !== 'string') return { error: 'exclusivity must be a string or null' }
  const v = raw.trim()
  if (v.length > 300) return { error: 'exclusivity is too long (300 chars max)' }
  return { value: v || null }
}

// ── Locations ─────────────────────────────────────────────────────────────────

const LOCATION_TEXT_FIELDS: Record<string, number> = {
  label: 120, address: 300, city: 120, region: 120, postal: 20, notes: 2000,
}

export function sanitizeLocationField(field: string, raw: unknown): { value?: unknown; error?: string } {
  switch (field) {
    case 'contact_id': {
      if (raw === null || raw === '') return { value: null }
      return parseUuid('contact_id', raw)
    }
    case 'country': {
      if (raw !== 'US' && raw !== 'CA') return { error: "country must be 'US' or 'CA'" }
      return { value: raw }
    }
    case 'lat': {
      if (raw === null) return { value: null }
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < -90 || raw > 90) {
        return { error: 'lat must be a number between -90 and 90, or null' }
      }
      return { value: raw }
    }
    case 'lng': {
      if (raw === null) return { value: null }
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < -180 || raw > 180) {
        return { error: 'lng must be a number between -180 and 180, or null' }
      }
      return { value: raw }
    }
    case 'is_primary': {
      if (typeof raw !== 'boolean') return { error: 'is_primary must be a boolean' }
      return { value: raw }
    }
    default: {
      if (field in LOCATION_TEXT_FIELDS) {
        if (raw === null || raw === '') return { value: null }
        if (typeof raw !== 'string') return { error: `${field} must be a string or null` }
        const v = raw.trim()
        if (v.length > LOCATION_TEXT_FIELDS[field]) {
          return { error: `${field} is too long (${LOCATION_TEXT_FIELDS[field]} chars max)` }
        }
        return { value: v || null }
      }
      return { error: `unknown field ${field}` }
    }
  }
}
