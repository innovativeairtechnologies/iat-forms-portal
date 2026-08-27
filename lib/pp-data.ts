import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { getEmployeesWithPerm } from './staff'
import {
  OPEN_FINDING_STATUSES, PREFLIGHT_LOOKBACK_DAYS, RECURRENCE_THRESHOLD,
  standingOf, isLate,
  type PpFinding, type PpFindingRow, type PpTheme, type PpThemeRow, type PpWalkaround,
  type WalkRole, type WalkSource,
} from './post-production'

/* ────────────────────────────────────────────────────────────────────────────
   lib/pp-data.ts — every read the Post-Production section makes.

   Server-only. Client components take the RESULTS of these as props and must
   never import this module: a value import from a 'use client' file would ship
   the service-role client to the browser, past tsc and past a green server
   render.
   ──────────────────────────────────────────────────────────────────────────── */

const FINDING_COLS =
  'id, walkaround_id, job_number, job_id, seq, note, note_source, category, severity, media, ' +
  'status, assignee_id, assigned_at, due_date, resolution, resolved_by, resolved_at, ' +
  'theme_id, theme_source, theme_note, created_at, updated_at'

/**
 * 🔴 THE EMBEDS MUST NAME THEIR FOREIGN KEYS.
 *
 * pp_findings has THREE columns pointing at employees — assignee_id, resolved_by
 * and created_by — so a bare `employees(name)` is ambiguous and PostgREST
 * refuses the entire request with PGRST201 ("Could not embed because more than
 * one relationship was found"). Not a warning and not a partial result: every
 * read here returns zero rows and the whole section renders empty.
 *
 * This compiles, `next build` passes, and nothing catches it — these pages are
 * force-dynamic, so no query runs at build time. The engineering section shipped
 * this exact bug in 096 and it was only caught by running the query. Run the
 * query.
 */
const FINDING_JOINS =
  'walk:pp_walkarounds(walked_by_name, walked_by_role, source, customer_name), ' +
  'assignee:employees!pp_findings_assignee_id_fkey(name), ' +
  'theme:pp_themes(title)'

type WalkJoin = {
  walked_by_name: string
  walked_by_role: WalkRole | null
  source: WalkSource
  customer_name: string
}

type FindingJoinRow = PpFinding & {
  walk: WalkJoin | WalkJoin[] | null
  assignee: { name: string } | { name: string }[] | null
  theme: { title: string } | { title: string }[] | null
}

/** PostgREST returns an embedded to-one as an object or a one-element array
 *  depending on how it infers the relationship. Normalize once, here. */
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

function flatten(rows: FindingJoinRow[]): PpFindingRow[] {
  return rows.map(r => {
    const walk = one(r.walk)
    const assignee = one(r.assignee)
    const theme = one(r.theme)
    const { walk: _w, assignee: _a, theme: _t, ...f } = r
    return {
      ...f,
      media: Array.isArray(f.media) ? f.media : [],
      assignee_name: assignee?.name ?? null,
      walked_by_name: walk?.walked_by_name ?? '',
      walked_by_role: walk?.walked_by_role ?? null,
      // Defaults to 'portal' when the join is missing, which is the SAFER wrong
      // answer: it renders as a signed-in walk rather than mislabelling one.
      source: walk?.source ?? 'portal',
      customer_name: walk?.customer_name ?? '',
      theme_title: theme?.title ?? null,
    }
  })
}

// ─── Findings ────────────────────────────────────────────────────────────────

/**
 * Every finding that has been handed over, worst clock first.
 *
 * ⚠️ Drafts are excluded by default and that is not a display preference. A
 * draft belongs to a walk somebody has not finished; surfacing it in the queue
 * would put half-dictated sentences in front of engineering and start a chase
 * over something nobody has submitted.
 */
export async function listFindings(opts: {
  includeDrafts?: boolean
  openOnly?: boolean
  assigneeId?: string
  jobNumber?: string
  themeId?: string
  limit?: number
} = {}): Promise<PpFindingRow[]> {
  let q = supabaseAdmin
    .from('pp_findings')
    .select(`${FINDING_COLS}, ${FINDING_JOINS}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!opts.includeDrafts) q = q.neq('status', 'draft')
  if (opts.openOnly) q = q.in('status', OPEN_FINDING_STATUSES as unknown as string[])
  if (opts.assigneeId) q = q.eq('assignee_id', opts.assigneeId)
  if (opts.jobNumber) q = q.eq('job_number', opts.jobNumber)
  if (opts.themeId) q = q.eq('theme_id', opts.themeId)
  if (opts.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) { console.error('[pp-data] listFindings:', error.message); return [] }
  return flatten((data ?? []) as unknown as FindingJoinRow[])
}

export async function getFinding(id: string): Promise<PpFindingRow | null> {
  const { data, error } = await supabaseAdmin
    .from('pp_findings')
    .select(`${FINDING_COLS}, ${FINDING_JOINS}`)
    .eq('id', id)
    .maybeSingle()
  if (error) { console.error('[pp-data] getFinding:', error.message); return null }
  if (!data) return null
  return flatten([data as unknown as FindingJoinRow])[0] ?? null
}

// ─── Walkarounds ─────────────────────────────────────────────────────────────

export async function listWalkarounds(opts: { walkedBy?: string; status?: 'walking' | 'submitted'; limit?: number } = {}) {
  let q = supabaseAdmin
    .from('pp_walkarounds')
    .select('*')
    .order('started_at', { ascending: false })
  if (opts.walkedBy) q = q.eq('walked_by', opts.walkedBy)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) { console.error('[pp-data] listWalkarounds:', error.message); return [] }
  return (data ?? []) as PpWalkaround[]
}

export async function getWalkaround(id: string): Promise<{ walk: PpWalkaround; findings: PpFinding[] } | null> {
  const { data: walk } = await supabaseAdmin.from('pp_walkarounds').select('*').eq('id', id).maybeSingle()
  if (!walk) return null
  const { data } = await supabaseAdmin
    .from('pp_findings').select(FINDING_COLS).eq('walkaround_id', id).order('seq', { ascending: true })
  const findings = ((data ?? []) as unknown as PpFinding[])
    .map(f => ({ ...f, media: Array.isArray(f.media) ? f.media : [] }))
  return { walk: walk as PpWalkaround, findings }
}

/** The walk this person left open, if any. Reopening the capture page should
 *  drop them back into the unit they were standing next to — not ask them to
 *  find it. Only ever their OWN: two people walking the same job are two walks,
 *  and resuming somebody else's would merge their observations. */
export async function activeWalkFor(employeeId: string | null): Promise<PpWalkaround | null> {
  if (!employeeId) return null
  const { data } = await supabaseAdmin
    .from('pp_walkarounds')
    .select('*')
    .eq('walked_by', employeeId)
    .eq('status', 'walking')
    .order('started_at', { ascending: false })
    .limit(1)
  return ((data ?? [])[0] as PpWalkaround) ?? null
}

// ─── Jobs, for the unit picker ───────────────────────────────────────────────

/**
 * Recent jobs, so the phone can offer taps instead of typing.
 *
 * Sorted by ship date because a walk happens at the END of a build: the unit in
 * front of you is one that is about to leave, not one that just got a PO.
 * Jobs with no ship date sort after, still reachable — an unlinked job number is
 * always allowed, so this list is a convenience and never a gate.
 */
export async function recentJobs(limit = 40) {
  const { data, error } = await supabaseAdmin
    .from('eng_jobs')
    .select('id, job_number, customer_name, project_name, model_number, ship_date, status')
    .in('status', ['active', 'complete'])
    .order('ship_date', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) { console.error('[pp-data] recentJobs:', error.message); return [] }
  return (data ?? []) as {
    id: string; job_number: string; customer_name: string
    project_name: string; model_number: string | null; ship_date: string | null; status: string
  }[]
}

// ─── Themes ──────────────────────────────────────────────────────────────────

/**
 * The recurrence board: every theme with how many findings sit under it.
 *
 * 🔴 CONFIRMED AND SUGGESTED ARE COUNTED SEPARATELY AND NEVER SUMMED.
 * "We have brought this up twelve times" is the sentence this feature exists to
 * make sayable, and it has to survive somebody checking it. A model's guess that
 * two findings are the same issue is a good shortlist and a bad statistic, so
 * the headline number counts only links a person has confirmed (theme_source =
 * 'human'); the model's un-reviewed matches are carried alongside as "N to
 * review". If those were added together, the first time an engineer opened a
 * theme and found two unrelated findings in it, the number would stop being
 * believed — and it would deserve to.
 */
export async function listThemes(): Promise<PpThemeRow[]> {
  const [{ data: themes, error }, { data: links }] = await Promise.all([
    supabaseAdmin.from('pp_themes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('pp_findings')
      .select('theme_id, theme_source, status, job_number, created_at')
      .not('theme_id', 'is', null)
      .neq('status', 'draft'),
  ])
  if (error) { console.error('[pp-data] listThemes:', error.message); return [] }

  type Link = { theme_id: string; theme_source: 'ai' | 'human' | null; status: string; job_number: string; created_at: string }
  const byTheme = new Map<string, Link[]>()
  for (const l of (links ?? []) as Link[]) {
    byTheme.set(l.theme_id, [...(byTheme.get(l.theme_id) ?? []), l])
  }

  return ((themes ?? []) as PpTheme[]).map(t => {
    const rows = byTheme.get(t.id) ?? []
    const human = rows.filter(r => r.theme_source === 'human')
    const dates = human.map(r => r.created_at).sort()
    return {
      ...t,
      confirmed: human.length,
      suggested: rows.filter(r => r.theme_source === 'ai').length,
      stillOpen: human.filter(r => (OPEN_FINDING_STATUSES as readonly string[]).includes(r.status)).length,
      jobs: [...new Set(human.map(r => r.job_number))].sort(),
      firstSeen: dates[0] ?? null,
      lastSeen: dates[dates.length - 1] ?? null,
    }
  })
}

export async function getTheme(id: string): Promise<{ theme: PpThemeRow; findings: PpFindingRow[] } | null> {
  const all = await listThemes()
  const theme = all.find(t => t.id === id)
  if (!theme) return null
  return { theme, findings: await listFindings({ themeId: id }) }
}

/**
 * The themes a pre-production meeting should carry in.
 *
 * Three conditions, and each one is there to keep the checklist short enough
 * that people read it: still open (a resolved or accepted theme is settled), it
 * has actually happened more than once, and it has been seen inside the lookback
 * window. The transcript's own phrasing is "all the issues from previous jobs in
 * the last month" — a checklist that carries everything forever is a checklist
 * everybody ticks without reading, which is how the spreadsheet died.
 */
export async function carryForwardThemes(now: Date = new Date()): Promise<PpThemeRow[]> {
  const cutoff = new Date(now.getTime() - PREFLIGHT_LOOKBACK_DAYS * 86_400_000).toISOString()
  return (await listThemes()).filter(t =>
    t.status === 'open' &&
    t.confirmed >= RECURRENCE_THRESHOLD &&
    t.lastSeen != null && t.lastSeen >= cutoff,
  )
}

// ─── Pre-production checks ───────────────────────────────────────────────────

export type PreflightItem = {
  id: string
  preflight_id: string
  theme_id: string | null
  title: string
  verdict: 'pending' | 'addressed' | 'not_applicable' | 'risk'
  note: string | null
  checked_at: string | null
  created_at: string
}

export type Preflight = {
  id: string
  job_number: string
  job_id: string | null
  held_by: string | null
  held_by_name: string
  notes: string | null
  status: 'in_progress' | 'complete'
  completed_at: string | null
  created_at: string
  updated_at: string
}

export async function listPreflights(limit = 50): Promise<(Preflight & { items: number; open: number })[]> {
  const { data: rows, error } = await supabaseAdmin
    .from('pp_preflights').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) { console.error('[pp-data] listPreflights:', error.message); return [] }
  const ids = (rows ?? []).map(r => r.id as string)
  if (!ids.length) return []

  const { data: items } = await supabaseAdmin
    .from('pp_preflight_items').select('preflight_id, verdict').in('preflight_id', ids)

  const counts = new Map<string, { items: number; open: number }>()
  for (const it of (items ?? []) as { preflight_id: string; verdict: string }[]) {
    const c = counts.get(it.preflight_id) ?? { items: 0, open: 0 }
    c.items += 1
    if (it.verdict === 'pending') c.open += 1
    counts.set(it.preflight_id, c)
  }

  return (rows as Preflight[]).map(p => ({ ...p, ...(counts.get(p.id) ?? { items: 0, open: 0 }) }))
}

export async function getPreflight(id: string): Promise<{ preflight: Preflight; items: PreflightItem[] } | null> {
  const { data: pf } = await supabaseAdmin.from('pp_preflights').select('*').eq('id', id).maybeSingle()
  if (!pf) return null
  const { data } = await supabaseAdmin
    .from('pp_preflight_items').select('*').eq('preflight_id', id).order('created_at', { ascending: true })
  return { preflight: pf as Preflight, items: (data ?? []) as PreflightItem[] }
}

// ─── Who can own a finding ───────────────────────────────────────────────────

/**
 * ⚠️ NOT "every active employee". `employees` is not a staff table — every
 * customer invite adds a row — so an unfiltered picker would offer customers as
 * assignees. Same rule as the engineering task queue: only somebody who can
 * actually reach this board can be made responsible for something on it.
 *
 * Can legitimately come back EMPTY. Callers must show that as an explainable
 * empty state, not a broken dropdown.
 */
export async function listAssignees(): Promise<{ id: string; name: string }[]> {
  return getEmployeesWithPerm('engineering_jobs')
}

// ─── The queue summary ───────────────────────────────────────────────────────

export type PpSummary = {
  open: number
  overdue: number
  unassigned: number
  answeredWaiting: number
  recurringThemes: number
  toReview: number
  closedThisMonth: number
  medianDaysToAnswer: number | null
  /** How many closed findings the median could actually see. Printed beside it,
   *  same rule as the engineering report: a median over three rows is a number
   *  with a shape, not a measurement. */
  medianCoverage: number
}

export async function buildSummary(now: Date = new Date()): Promise<PpSummary> {
  const [findings, themes] = await Promise.all([listFindings(), listThemes()])

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const answeredRows = findings.filter(f => f.resolved_at)
  const turnarounds = answeredRows
    .map(f => (new Date(f.resolved_at!).getTime() - new Date(f.created_at).getTime()) / 86_400_000)
    .filter(n => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b)

  const median = turnarounds.length
    ? turnarounds.length % 2
      ? turnarounds[(turnarounds.length - 1) / 2]
      : (turnarounds[turnarounds.length / 2 - 1] + turnarounds[turnarounds.length / 2]) / 2
    : null

  return {
    open: findings.filter(f => (OPEN_FINDING_STATUSES as readonly string[]).includes(f.status)).length,
    overdue: findings.filter(f => isLate(standingOf(f, now))).length,
    unassigned: findings.filter(f => f.status === 'open').length,
    answeredWaiting: findings.filter(f => f.status === 'answered').length,
    recurringThemes: themes.filter(t => t.status === 'open' && t.confirmed >= RECURRENCE_THRESHOLD).length,
    toReview: findings.filter(f => f.theme_id && f.theme_source === 'ai').length,
    closedThisMonth: findings.filter(f => f.resolved_at && f.resolved_at >= monthStart).length,
    medianDaysToAnswer: median == null ? null : Math.round(median * 10) / 10,
    medianCoverage: turnarounds.length,
  }
}
