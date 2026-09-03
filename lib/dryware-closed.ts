// ─────────────────────────────────────────────────────────────────────────────
// lib/dryware-closed.ts — client for the external Dryware "closed projects"
// reporting API (a first-party IAT system at dryware.dehumidifiers.com).
//
// Sibling to lib/dryware.ts (the open/"projected sales" feed), not a merge into
// it: this feed has a different identity model (a real projectId/unitId — no
// dedup needed) and a different storage contract (additive upsert into
// closed_projects, NEVER a wipe-and-reload — see migration 100 for why). Shares
// its date/number parsing with lib/dryware.ts rather than duplicating it.
//
// Per Danny Popov (Dryware dev, 2026-07): this endpoint is WON-ONLY. Lost
// projects carry a separate DryWare status and are never returned here — so a
// row's mere presence means the deal was won. No inference needed, no status
// field to read.
//
// `closedTotal` (not `quoteTotal`) is the authoritative dollar figure — a unit
// can have multiple quote revisions, and `quoteTotal` reflects whichever
// revision is most recently selected system-wide, not necessarily the one the
// closed deal actually used. `quote_total` is derived and kept for reference
// only; anything downstream that needs "what did this sell for" must read
// `closed_total`.
// ─────────────────────────────────────────────────────────────────────────────

import { parseUsDate, parseIsoDate, toNumber } from './dryware'

const DRYWARE_CLOSED_URL =
  'https://dryware.dehumidifiers.com/api/Reporting/getClosedProjectsForExternalSystem'

const TIMEOUT_MS = 60_000

/** A unit line as returned by Dryware's closed-projects feed. */
export type DrywareClosedUnit = {
  unitId: number | null
  unitName: string | null
  modelNumber: string | null
  quoteTotal: number | null
  closedTotal: number | null
}

/** A raw closed-project row as returned by Dryware. One row per project — real
 *  stable `projectId`, so (unlike the open feed) no dedup pass is needed: a
 *  repeat projectId in one response, or across syncs, collapses naturally at
 *  the DB layer via upsert_closed_projects()'s ON CONFLICT (project_id). */
export type DrywareClosedProject = {
  projectId: number
  user: string | null
  company: string | null
  projectCustomer: string | null
  projectName: string | null
  dateCreated: string | null // "M/D/YYYY"
  contact: string | null
  projectTypes: string | null
  confidenceLevel: number | null
  estimatedClosingDate: string | null // ISO-ish "YYYY-MM-DDT00:00:00"; can be ABSENT
  actualClosingDate: string | null // ISO-ish "YYYY-MM-DDT00:00:00"
  units: DrywareClosedUnit[] | null
}

/** A derived row shaped for the closed_projects table. */
export type ClosedProjectRow = {
  project_id: number
  user_name: string | null
  company: string | null
  project_customer: string | null
  project_name: string | null
  date_created: string | null
  contact: string | null
  project_types: string | null
  confidence_level: number | null
  estimated_closing_date: string | null
  actual_closing_date: string | null
  units: DrywareClosedUnit[]
  unit_count: number
  quote_total: number // reference only — see module note
  closed_total: number // authoritative
}

export type ClosedProjectsSummary = {
  fetchedCount: number
  totalClosedThisBatch: number
}

/**
 * GET the raw snapshot from Dryware. Throws on a missing credential, timeout,
 * any non-200, a non-array body, or a row missing `projectId` (our upsert key —
 * we'd rather fail loudly than silently drop or mis-key a closed deal).
 */
export async function fetchClosedProjectsRaw(): Promise<{ raw: DrywareClosedProject[]; durationMs: number }> {
  const auth = process.env.DRYWARE_AUTH_HEADER
  if (!auth) throw new Error('DRYWARE_AUTH_HEADER is not configured on the server.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()
  let res: Response
  try {
    res = await fetch(DRYWARE_CLOSED_URL, {
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
  if (!Array.isArray(raw)) throw new Error('Dryware response was not a JSON array of closed projects.')

  const rows = raw as DrywareClosedProject[]
  const missingId = rows.filter((r) => r == null || typeof r.projectId !== 'number')
  if (missingId.length > 0) {
    throw new Error(`Dryware returned ${missingId.length} closed project row(s) with no numeric projectId.`)
  }

  console.log(`[dryware-closed] fetched ${rows.length} rows in ${durationMs}ms`)
  return { raw: rows, durationMs }
}

/**
 * Derive closed_total / quote_total / unit_count and normalize dates. Pure —
 * safe to unit-test and to call from both a future route and a script.
 */
export function deriveClosedProjects(raw: DrywareClosedProject[]): {
  rows: ClosedProjectRow[]
  summary: ClosedProjectsSummary
} {
  const rows: ClosedProjectRow[] = raw.map((p) => {
    const units = Array.isArray(p.units) ? p.units : []
    const quoteTotal = units.reduce((a, u) => a + toNumber(u?.quoteTotal), 0)
    const closedTotal = units.reduce((a, u) => a + toNumber(u?.closedTotal), 0)

    return {
      project_id: p.projectId,
      user_name: p.user ?? null,
      company: p.company ?? null,
      project_customer: p.projectCustomer ?? null,
      project_name: p.projectName ?? null,
      date_created: parseUsDate(p.dateCreated),
      contact: p.contact || null,
      project_types: p.projectTypes || null,
      confidence_level: p.confidenceLevel == null ? null : toNumber(p.confidenceLevel),
      estimated_closing_date: parseIsoDate(p.estimatedClosingDate),
      actual_closing_date: parseIsoDate(p.actualClosingDate),
      units,
      unit_count: units.length,
      quote_total: quoteTotal,
      closed_total: closedTotal,
    }
  })

  const totalClosedThisBatch = rows.reduce((a, r) => a + r.closed_total, 0)
  return { rows, summary: { fetchedCount: rows.length, totalClosedThisBatch } }
}
