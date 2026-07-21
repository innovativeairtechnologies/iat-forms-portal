import type { Deal } from './supabase'

/* ────────────────────────────────────────────────────────────────────────────
   Pure, derived-data helpers for the deal pipeline. Nothing here touches the
   network or React state — components call these from useMemo. `weighted` is
   never persisted (see migration 043's header comment); it's always computed
   here so Pipeline / CRM / Focused can never show it out of sync with
   total_cost / confidence.
   ──────────────────────────────────────────────────────────────────────────── */

export function computeWeighted(deal: Pick<Deal, 'total_cost' | 'confidence'>): number {
  return deal.total_cost * (deal.confidence / 100)
}

export type DealSummary = {
  totalCost: number
  totalWeighted: number
  openCount: number
  wonCount: number
  lostCount: number
  winRate: number | null // null until there's at least one closed deal
}

export function computeSummary(deals: Deal[]): DealSummary {
  let totalCost = 0
  let totalWeighted = 0
  let openCount = 0
  let wonCount = 0
  let lostCount = 0
  for (const d of deals) {
    totalCost += d.total_cost
    totalWeighted += computeWeighted(d)
    if (d.status === 'Won') wonCount++
    else if (d.status === 'Lost') lostCount++
    else openCount++
  }
  const closed = wonCount + lostCount
  return {
    totalCost,
    totalWeighted,
    openCount,
    wonCount,
    lostCount,
    winRate: closed > 0 ? (wonCount / closed) * 100 : null,
  }
}

/** CRM view's "recent activity" flag: has commentary, still active. */
export function hasRecentActivity(deal: Deal): boolean {
  return deal.status === null && !!(deal.notes && deal.notes.trim())
}

/* ── Project type / industry (New Deal dropdown) ─────────────────────────────
   Stored free-text in deals.project_type; the New Deal + edit forms offer
   these as a dropdown. Placeholder industry set for IAT's desiccant-dehum
   verticals — swap for the sales team's real list when it lands (nothing else
   depends on the exact strings; the column is free-text). */
export const PROJECT_TYPES = [
  'Ice Rinks & Arenas',
  'Pharmaceutical & Life Sciences',
  'Food & Beverage Processing',
  'Cold Storage & Refrigeration',
  'Cannabis & Controlled Grow',
  'Water & Wastewater Treatment',
  'Manufacturing & Industrial',
  'Battery & Energy Storage',
  'Lithium & EV',
  'Military & Defense',
  'Aerospace',
  'Data Centers',
  'Warehousing & Logistics',
  'Seed & Grain Storage',
  'Indoor Agriculture',
  'Museums & Archives',
  'Electronics & Cleanrooms',
  'Other',
] as const

/* ── Follow-ups ──────────────────────────────────────────────────────────────
   The New-Deal automation drops a reminder this many days out (Monday parity). */
export const AUTO_FOLLOW_UP_DAYS = 14

/** 'YYYY-MM-DD' `days` from `from` (default now), in local time. */
export function followUpDateFrom(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** True only for a real calendar date. A shape-only regex passes 2026-02-31 /
 *  2026-13-01, which Postgres' `date` type would reject as a raw 500 — so the
 *  follow-up routes validate with this before inserting. */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

/* ── Follow-up checklist (deal detail modal) ─────────────────────────────────
   The sales team's fixed 5-step follow-up process. KEYS are the contract —
   they're what deals.checklist (jsonb, migration 047) stores and what the API
   validates — so relabel freely, but never reuse or rename a key. */
export const CHECKLIST_STEPS = [
  { key: 'submittal', label: 'Preliminary Submittal Sent' },
  { key: 'quote', label: 'Quote Sent' },
  { key: 'follow1', label: 'Initial Follow-Up (1–2 weeks) — Timing & Confidence Level' },
  { key: 'follow2', label: '2nd Follow-Up — Update Timing and Confidence' },
  { key: 'award', label: 'Job/PO Award' },
] as const

export type ChecklistKey = (typeof CHECKLIST_STEPS)[number]['key']

export function checklistProgress(deal: Deal): { done: number; total: number } {
  const c = deal.checklist ?? {}
  return {
    done: CHECKLIST_STEPS.filter((s) => c[s.key] === true).length,
    total: CHECKLIST_STEPS.length,
  }
}

/* ── Pipeline stages (migration 061) ─────────────────────────────────────────
   The named stages behind the Board view. KEYS are the contract — they're the
   deals.stage CHECK constraint's values and what deal_stage_history stores —
   so relabel freely, but never reuse or rename a key. `status` (Won/Lost/null)
   stays alongside as a derived compatibility column: the PATCH route keeps the
   two in sync, and every pre-061 analytic keeps reading status untouched. */
export const STAGES = [
  { key: 'lead',      label: 'Lead',      tone: 'slate'   },
  { key: 'quoted',    label: 'Quoted',    tone: 'sky'     },
  { key: 'follow_up', label: 'Follow-Up', tone: 'amber'   },
  { key: 'verbal',    label: 'Verbal',    tone: 'violet'  },
  { key: 'won',       label: 'Won',       tone: 'emerald' },
  { key: 'lost',      label: 'Lost',      tone: 'rose'    },
] as const

export type DealStage = (typeof STAGES)[number]['key']

export const STAGE_KEYS: readonly DealStage[] = STAGES.map((s) => s.key)
export const OPEN_STAGES: readonly DealStage[] = ['lead', 'quoted', 'follow_up', 'verbal']

export function stageInfo(key: string | null | undefined) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0]
}

/** The status column value a stage implies. */
export function statusForStage(stage: DealStage): 'Won' | 'Lost' | null {
  return stage === 'won' ? 'Won' : stage === 'lost' ? 'Lost' : null
}

/** Whole days a deal has sat in its current stage (date-only math — DST-safe). */
export function stageAgeDays(deal: Pick<Deal, 'stage_changed_at'>, now: Date): number {
  const then = new Date(deal.stage_changed_at)
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((b - a) / 864e5))
}

/** Win/loss reasons offered when a deal is dragged to Won/Lost. Free-text
 *  column (deals.closed_reason) — these are the curated quick-picks. */
export const CLOSED_REASONS = [
  'Price',
  'Timing / project delayed',
  'Went with competitor',
  'No budget',
  'Went dark',
  'Spec win',
  'Relationship',
  'Other',
] as const

/* ────────────────────────────────────────────────────────────────────────────
   Sales-dashboard derivations. All pure & deterministic given (deals, now) so
   the dashboard can render them on the server pass and hydrate identically.
   ──────────────────────────────────────────────────────────────────────────── */

export type MonthBucket = { key: string; label: string; value: number; count: number }

/** $ quoted per calendar month over the trailing `months` (all statuses —
 *  this measures quoting activity, not bookings). */
export function monthlyQuoteSeries(deals: Deal[], now: Date, months = 12): MonthBucket[] {
  const buckets: MonthBucket[] = []
  const idx = new Map<string, MonthBucket>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const b = { key, label, value: 0, count: 0 }
    buckets.push(b)
    idx.set(key, b)
  }
  for (const deal of deals) {
    if (!deal.date_quoted) continue
    const b = idx.get(deal.date_quoted.slice(0, 7))
    if (!b) continue
    b.value += deal.total_cost
    b.count++
  }
  return buckets
}

export type ConfidenceBand = { label: string; min: number; max: number; value: number; weighted: number; count: number }

/** Open pipeline sliced by confidence — the closest true read of "stage"
 *  this board has (it forecasts by confidence, not kanban stages). */
export function confidenceBands(deals: Deal[]): ConfidenceBand[] {
  const bands: ConfidenceBand[] = [
    { label: 'Long shots', min: 0, max: 19, value: 0, weighted: 0, count: 0 },
    { label: 'Early', min: 20, max: 39, value: 0, weighted: 0, count: 0 },
    { label: 'Working', min: 40, max: 59, value: 0, weighted: 0, count: 0 },
    { label: 'Likely', min: 60, max: 79, value: 0, weighted: 0, count: 0 },
    { label: 'Near-certain', min: 80, max: 100, value: 0, weighted: 0, count: 0 },
  ]
  for (const d of deals) {
    if (d.status !== null) continue
    const band = bands.find((b) => d.confidence >= b.min && d.confidence <= b.max)!
    band.value += d.total_cost
    band.weighted += computeWeighted(d)
    band.count++
  }
  return bands
}

export type GroupStat = {
  name: string
  count: number
  openCount: number
  raw: number       // open $ (unweighted)
  weighted: number  // open expected value
  wonValue: number
  winRate: number | null
  blendedConfidence: number // weighted ÷ raw, as %
}

/** Per-board-group rollup (MAIN / JACOB / MIKE / DAVE …) for the leaderboard. */
export function groupStats(deals: Deal[]): GroupStat[] {
  const map = new Map<string, GroupStat>()
  for (const d of deals) {
    let g = map.get(d.group_name)
    if (!g) {
      g = { name: d.group_name, count: 0, openCount: 0, raw: 0, weighted: 0, wonValue: 0, winRate: null, blendedConfidence: 0 }
      map.set(d.group_name, g)
    }
    g.count++
    if (d.status === null) {
      g.openCount++
      g.raw += d.total_cost
      g.weighted += computeWeighted(d)
    } else if (d.status === 'Won') {
      g.wonValue += d.total_cost
    }
  }
  for (const g of map.values()) {
    const closed = deals.filter((d) => d.group_name === g.name && d.status !== null)
    const won = closed.filter((d) => d.status === 'Won').length
    g.winRate = closed.length > 0 ? (won / closed.length) * 100 : null
    g.blendedConfidence = g.raw > 0 ? (g.weighted / g.raw) * 100 : 0
  }
  return [...map.values()].sort((a, b) => b.weighted - a.weighted)
}

export type ProjectedBucket = { label: string; order: number; weighted: number; count: number }

const MONTHS_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
const MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Best-effort read of the free-text `projected` column ("Q4 2025",
 *  "July 2025", "2028", "7.15.24", "Not in IAT's Favor") into close buckets.
 *  Unparseable-but-present text lands in "Unscheduled"; blank in "No date". */
export function projectedBuckets(deals: Deal[]): ProjectedBucket[] {
  const map = new Map<string, ProjectedBucket>()
  const add = (label: string, order: number, deal: Deal) => {
    let b = map.get(label)
    if (!b) { b = { label, order, weighted: 0, count: 0 }; map.set(label, b) }
    b.weighted += computeWeighted(deal)
    b.count++
  }
  for (const d of deals) {
    if (d.status !== null) continue
    const p = (d.projected || '').trim()
    if (!p) { add('No date', 9e9, d); continue }

    const q = p.match(/\bQ([1-4])\s*[' ]?(\d{2,4})\b/i)
    if (q) {
      const y = q[2].length === 2 ? 2000 + Number(q[2]) : Number(q[2])
      add(`Q${q[1]} ${y}`, y * 10 + Number(q[1]), d)
      continue
    }
    const mo = p.match(MONTHS_RE)
    const yr = p.match(/\b(20\d{2})\b/)
    if (mo && yr) {
      const m = MONTH_NUM[mo[1].slice(0, 3).toLowerCase()]
      const quarter = Math.ceil(m / 3)
      add(`Q${quarter} ${yr[1]}`, Number(yr[1]) * 10 + quarter, d)
      continue
    }
    if (/^\s*20\d{2}\s*$/.test(p)) {
      const y = Number(p.trim())
      add(String(y), y * 10 + 5, d) // after that year's quarters, before next year
      continue
    }
    const mdY = p.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
    if (mdY) {
      const y = mdY[3].length === 2 ? 2000 + Number(mdY[3]) : Number(mdY[3])
      const quarter = Math.ceil(Math.min(12, Math.max(1, Number(mdY[1]))) / 3)
      add(`Q${quarter} ${y}`, y * 10 + quarter, d)
      continue
    }
    add('Unscheduled', 8e9, d)
  }
  return [...map.values()].sort((a, b) => a.order - b.order)
}

export type AttentionSignal = { label: string; meta: string; tone: 'amber' | 'rose' | 'sky'; count: number }

/** Real follow-up signals derived from the board — no invented urgency. */
export function attentionSignals(deals: Deal[], now: Date): AttentionSignal[] {
  const open = deals.filter((d) => d.status === null)
  const out: AttentionSignal[] = []
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 864e5)

  const stale = open.filter((d) => d.date_quoted && new Date(d.date_quoted + 'T00:00:00') < ninetyDaysAgo)
  if (stale.length) {
    out.push({
      label: `${stale.length} open quote${stale.length === 1 ? '' : 's'} older than 90 days`,
      meta: `${fmtShort(stale.reduce((a, d) => a + d.total_cost, 0))} quoted — worth a follow-up pass`,
      tone: 'amber', count: stale.length,
    })
  }
  const bigLongShots = open.filter((d) => d.total_cost >= 150_000 && d.confidence <= 10)
  if (bigLongShots.length) {
    out.push({
      label: `${bigLongShots.length} big deal${bigLongShots.length === 1 ? '' : 's'} at ≤10% confidence`,
      meta: `${fmtShort(bigLongShots.reduce((a, d) => a + d.total_cost, 0))} — qualify or clear them out`,
      tone: 'rose', count: bigLongShots.length,
    })
  }
  const noCost = open.filter((d) => d.total_cost === 0)
  if (noCost.length) {
    out.push({
      label: `${noCost.length} deal${noCost.length === 1 ? '' : 's'} missing a dollar value`,
      meta: noCost.slice(0, 3).map((d) => d.customer).join(' · '),
      tone: 'sky', count: noCost.length,
    })
  }
  const undated = open.filter((d) => !d.date_quoted)
  if (undated.length) {
    out.push({
      label: `${undated.length} deal${undated.length === 1 ? '' : 's'} with no quote date`,
      meta: 'Aging can’t be tracked until they’re dated',
      tone: 'sky', count: undated.length,
    })
  }
  return out
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

/* ── Industry / vertical mix ──────────────────────────────────────────────────
   Open pipeline sliced by deals.project_type (the "Industry / vertical" column,
   values in PROJECT_TYPES). Deals with no project_type land in "Unspecified" so
   the mix always sums to the full open pipeline. */
export type IndustryStat = { name: string; raw: number; weighted: number; count: number }

export function industryStats(deals: Deal[]): IndustryStat[] {
  const map = new Map<string, IndustryStat>()
  for (const d of deals) {
    if (d.status !== null) continue // open pipeline only
    const name = d.project_type?.trim() || 'Unspecified'
    let s = map.get(name)
    if (!s) { s = { name, raw: 0, weighted: 0, count: 0 }; map.set(name, s) }
    s.raw += d.total_cost
    s.weighted += computeWeighted(d)
    s.count++
  }
  return [...map.values()].sort((a, b) => b.raw - a.raw)
}

/* ── Forecast projections ─────────────────────────────────────────────────────
   Three honest reads off the board — no quota required:
   • runRate  — won *this calendar year* annualized by the fraction of the year
                elapsed. null until there's a dated win this year, so it never
                shows a fabricated number.
   • bestCase — won-to-date + every open deal at full value (all of it closes).
   • commit   — won-to-date + confidence-weighted open pipeline.
   A real sales quota, when Sales provides one, slots in beside these later. */
export type SalesProjections = {
  wonToDate: number
  wonYtd: number
  runRate: number | null
  bestCase: number
  commitCase: number
}

export function salesProjections(deals: Deal[], now: Date): SalesProjections {
  const year = now.getFullYear()
  let wonToDate = 0
  let wonYtd = 0
  let hasDatedWinThisYear = false
  let openRaw = 0
  let openWeighted = 0
  for (const d of deals) {
    if (d.status === 'Won') {
      wonToDate += d.total_cost
      const dt = d.date_quoted // the only date the board carries per deal
      if (dt && Number(dt.slice(0, 4)) === year) { wonYtd += d.total_cost; hasDatedWinThisYear = true }
    } else if (d.status === null) {
      openRaw += d.total_cost
      openWeighted += computeWeighted(d)
    }
  }
  // Day-of-year / 365 — floored at 1 day so early January can't divide by ~0.
  const startOfYear = new Date(year, 0, 1)
  const elapsedDays = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / 864e5) + 1)
  const fraction = Math.min(1, elapsedDays / 365)
  return {
    wonToDate,
    wonYtd,
    runRate: hasDatedWinThisYear ? wonYtd / fraction : null,
    bestCase: wonToDate + openRaw,
    commitCase: wonToDate + openWeighted,
  }
}
