// ─────────────────────────────────────────────────────────────────────────────
// lib/dryware.ts — client for the external Dryware "projected sales by project"
// reporting API (a first-party IAT system at dryware.dehumidifiers.com).
//
// Read-only: we GET a JSON snapshot, de-duplicate it, derive per-project totals,
// and mirror it into the projected_sales table (see the sync route). The secret
// lives ONLY in the DRYWARE_AUTH_HEADER env var (server-side; .env.local + Vercel)
// — never in code, never client-exposed.
//
// The endpoint currently returns every project row TWICE (a JOIN fan-out on the
// Dryware side — flagged to their dev). We collapse byte-identical rows here so
// the portal shows each project once; if the upstream bug is fixed, dedupe is a
// no-op, and if two rows ever legitimately differ, both survive.
// ─────────────────────────────────────────────────────────────────────────────

const DRYWARE_URL =
  'https://dryware.dehumidifiers.com/api/Reporting/getProjectedSalesByProjectForExternalSystem'

const TIMEOUT_MS = 60_000

/** A unit line as returned by Dryware. */
export type DrywareUnit = {
  unitName: string | null
  modelNumber: string | null
  quoteTotal: number | null
}

/** A raw project row as returned by Dryware (one per project — but duplicated). */
export type DrywareProject = {
  user: string | null
  company: string | null
  projectCustomer: string | null
  projectName: string | null
  dateCreated: string | null // "M/D/YYYY"
  contact: string | null
  projectTypes: string | null
  confidenceLevel: number | null
  estimatedClosingDate: string | null // ISO-ish "YYYY-MM-DDT00:00:00"
  units: DrywareUnit[] | null
}

/** A de-duplicated, derived row shaped for the projected_sales table. */
export type ProjectedSalesRow = {
  user_name: string | null
  company: string | null
  project_customer: string | null
  project_name: string | null
  date_created: string | null // "YYYY-MM-DD" or null
  contact: string | null
  project_types: string | null
  confidence_level: number | null
  estimated_closing_date: string | null // "YYYY-MM-DD" or null
  units: DrywareUnit[]
  unit_count: number
  quote_total: number
  weighted_total: number
}

export type ProjectedSalesSummary = {
  sourceCount: number
  uniqueCount: number
  totalQuote: number
  weightedTotal: number
}

/**
 * GET the raw (still-duplicated) snapshot from Dryware. Throws on a missing
 * credential, timeout, any non-200, or a non-array body. Logs the response time
 * so we can watch how fast the endpoint is once it's in real use.
 */
export async function fetchProjectedSalesRaw(): Promise<{ raw: DrywareProject[]; durationMs: number }> {
  const auth = process.env.DRYWARE_AUTH_HEADER
  if (!auth) throw new Error('DRYWARE_AUTH_HEADER is not configured on the server.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()
  let res: Response
  try {
    res = await fetch(DRYWARE_URL, {
      method: 'GET',
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Dryware did not respond within ${TIMEOUT_MS / 1000}s.`)
    }
    throw new Error(`Could not reach Dryware: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
  const durationMs = Date.now() - start

  if (!res.ok) throw new Error(`Dryware returned HTTP ${res.status} ${res.statusText}.`)

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    throw new Error('Dryware returned a non-JSON response.')
  }
  if (!Array.isArray(raw)) throw new Error('Dryware response was not a JSON array of projects.')

  console.log(`[dryware] fetched ${raw.length} rows in ${durationMs}ms`)
  return { raw: raw as DrywareProject[], durationMs }
}

/** "M/D/YYYY" → "YYYY-MM-DD" (null/blank/unparseable → null). */
function parseUsDate(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

/** "YYYY-MM-DDT00:00:00" (or "YYYY-MM-DD") → "YYYY-MM-DD" (else null). */
function parseIsoDate(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function toNumber(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * Collapse byte-identical duplicate rows (upstream returns each project twice),
 * then derive unit_count / quote_total / weighted_total and normalize dates.
 * Pure — safe to unit-test and to call from both the route and a script.
 */
export function dedupeAndDeriveProjectedSales(raw: DrywareProject[]): {
  rows: ProjectedSalesRow[]
  summary: ProjectedSalesSummary
} {
  const seen = new Set<string>()
  const rows: ProjectedSalesRow[] = []
  for (const p of raw) {
    const key = JSON.stringify(p)
    if (seen.has(key)) continue
    seen.add(key)

    const units = Array.isArray(p.units) ? p.units : []
    const quoteTotal = units.reduce((a, u) => a + toNumber(u?.quoteTotal), 0)
    const confidence = p.confidenceLevel == null ? null : toNumber(p.confidenceLevel)
    const weighted = confidence == null ? 0 : quoteTotal * (confidence / 100)

    rows.push({
      user_name: p.user ?? null,
      company: p.company ?? null,
      project_customer: p.projectCustomer ?? null,
      project_name: p.projectName ?? null,
      date_created: parseUsDate(p.dateCreated),
      contact: p.contact || null,
      project_types: p.projectTypes || null,
      confidence_level: confidence,
      estimated_closing_date: parseIsoDate(p.estimatedClosingDate),
      units,
      unit_count: units.length,
      quote_total: quoteTotal,
      weighted_total: weighted,
    })
  }

  const totalQuote = rows.reduce((a, r) => a + r.quote_total, 0)
  const weightedTotal = rows.reduce((a, r) => a + r.weighted_total, 0)
  return {
    rows,
    summary: { sourceCount: raw.length, uniqueCount: rows.length, totalQuote, weightedTotal },
  }
}
