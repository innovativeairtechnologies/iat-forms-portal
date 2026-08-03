// ─────────────────────────────────────────────────────────────────────────────
// lib/rep-scorecard.ts — the scoring model behind /admin/rep-scorecard.
//
// Ported 1:1 from the IAT_Rep_Scorecard workbook so the numbers Sales already
// trusts do not move: ten 0/1/2 signals → Total out of 20 → Score % → Tier →
// Grade, then the same bands applied to a firm's AVERAGE total for the rollup.
// Every formula below has its workbook original quoted beside it.
//
// Dependency-free and serializable (no server or React imports) so the server
// page, the API routes AND the client all score identically — the lib/roles.ts
// and lib/territories.ts precedent. Nothing here is stored in the database:
// Total/Tier/Grade are pure functions of the ten signals (migration 075), so
// re-banding is one edit here rather than a backfill.
// ─────────────────────────────────────────────────────────────────────────────

import type { Tone } from '@/components/admin/list'

// ── The ten health signals ───────────────────────────────────────────────────
// Order is the workbook's column order (M→V) and drives the UI. `help` is the
// workbook's own "How to Use" wording — Sales wrote it, so it stays verbatim.

export const SIGNAL_KEYS = [
  'rfqs_regularly',
  'registers_early',
  'coverage_3x',
  'pipeline_shaped',
  'hit_rate_in_band',
  'responsive',
  'forecast_trust',
  'training_1_3',
  'logs_win_loss',
  'booked_to_plan',
] as const

export type SignalKey = (typeof SIGNAL_KEYS)[number]

export const SIGNALS: { key: SignalKey; label: string; help: string }[] = [
  { key: 'rfqs_regularly',   label: 'RFQs regularly',    help: 'Submitting quote requests consistently (last 60 days).' },
  { key: 'registers_early',  label: 'Registers early',   help: 'Registers real opportunities early, in writing.' },
  { key: 'coverage_3x',      label: 'Coverage ≥3x',      help: 'Open pipeline covers at least 3x the gap to goal.' },
  { key: 'pipeline_shaped',  label: 'Pipeline shaped',   help: 'A meaningful share of pipeline is shaped (Influence / Design), not open bids.' },
  { key: 'hit_rate_in_band', label: 'Hit rate in band',  help: 'Win rate fits the deal-type bands (Influence+Design 60–75%, Design 30–45%, open 15–25%).' },
  { key: 'responsive',       label: 'Responsive',        help: 'Responsive to our follow-ups and requests.' },
  { key: 'forecast_trust',   label: 'Forecast trust',    help: 'Their forecast and stage calls are ones we can trust.' },
  { key: 'training_1_3',     label: 'Training 1–3',      help: 'Completed training modules 1–3 (IAT 101, psychrometrics, DryWare/RFQ).' },
  { key: 'logs_win_loss',    label: 'Logs win/loss',     help: 'Closes the loop with a win/loss on completed jobs.' },
  { key: 'booked_to_plan',   label: 'Booked to plan',    help: 'Booked revenue is tracking to their plan.' },
]

export const MAX_TOTAL = SIGNAL_KEYS.length * 2 // 20

/** The 0/1/2 dropdown, with the workbook's own reading of each value. */
export const SIGNAL_SCORES: { value: 0 | 1 | 2; label: string; tone: Tone }[] = [
  { value: 0, label: 'No / unknown', tone: 'rose' },
  { value: 1, label: 'Partial',      tone: 'amber' },
  { value: 2, label: 'Healthy',      tone: 'emerald' },
]

export function signalTone(v: number | null | undefined): Tone {
  if (v === 2) return 'emerald'
  if (v === 1) return 'amber'
  if (v === 0) return 'rose'
  return 'slate'
}

// ── Rep status (workbook column E's dropdown) ────────────────────────────────

export const REP_STATUSES = ['Active', 'Developing', 'Dormant', 'House/Direct'] as const
export type RepStatus = (typeof REP_STATUSES)[number]

export const REP_STATUS_TONE: Record<RepStatus, Tone> = {
  Active: 'emerald',
  Developing: 'sky',
  Dormant: 'slate',
  'House/Direct': 'violet',
}

// ── Tiers & grades ───────────────────────────────────────────────────────────
// Bands from the workbook's "How to Use" tab, sourced there to the Inside Sales
// Playbook (Measure). Applied to a REP's total and, unchanged, to a FIRM's
// average total — which is why `tierOf`/`gradeOf` take a plain number.

export const TIERS = ['Platinum / Gold', 'Silver', 'Developing / At-risk'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_TONE: Record<Tier, Tone> = {
  'Platinum / Gold': 'emerald',
  Silver: 'amber',
  'Developing / At-risk': 'rose',
}

/** What each tier means for the next conversation — the workbook's own gloss. */
export const TIER_ACTION: Record<Tier, string> = {
  'Platinum / Gold': 'Invest and grow',
  Silver: 'Targeted coaching',
  'Developing / At-risk': 'Rebuild the basics',
}

export const GRADES = ['A', 'B', 'C', 'D', 'F'] as const
export type Grade = (typeof GRADES)[number]

export const GRADE_TONE: Record<Grade, Tone> = {
  A: 'emerald', B: 'emerald', C: 'amber', D: 'rose', F: 'rose',
}

/** Workbook: IF(W>=15,"Platinum / Gold",IF(W>=8,"Silver","Developing / At-risk")) */
export function tierOf(total: number): Tier {
  if (total >= 15) return 'Platinum / Gold'
  if (total >= 8) return 'Silver'
  return 'Developing / At-risk'
}

/** Workbook: IF(W>=17,"A",IF(W>=13,"B",IF(W>=9,"C",IF(W>=5,"D","F")))) */
export function gradeOf(total: number): Grade {
  if (total >= 17) return 'A'
  if (total >= 13) return 'B'
  if (total >= 9) return 'C'
  if (total >= 5) return 'D'
  return 'F'
}

// ── The scorecard row (migration 075) ────────────────────────────────────────

export type RepScorecard = {
  id: string
  contact_id: string
  period: string
  notes: string | null
  scored_by: string | null
  scored_by_name: string | null
  scored_at: string | null
  created_at: string
  updated_at: string
  /** numeric columns arrive from PostgREST as STRINGS — always read via `num()`. */
  annual_goal: string | number | null
  booked_ytd: string | number | null
  open_pipeline: string | number | null
  hit_rate: string | number | null
  rfqs_60d: number | null
} & { [K in SignalKey]: number | null }

/** Coerce a PostgREST `numeric` (string) or a form value to a number, or null. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export type Scored = {
  /** Sum of the signals that HAVE been scored — null until at least one is.
   *  Workbook: IF(COUNT(M:V)=0,"",SUM(M:V)). */
  total: number | null
  /** How many of the ten are filled in. Not a workbook column: the sheet's
   *  Total is out of 20 no matter how many were scored, so a rep judged on
   *  three signals reads "Developing / At-risk" identically to one judged on
   *  ten. Carrying the count lets the UI say which it is. */
  scoredCount: number
  scorePct: number | null
  tier: Tier | null
  grade: Grade | null
}

export function scoreCard(card: Partial<Record<SignalKey, number | null>> | null | undefined): Scored {
  let total = 0
  let scoredCount = 0
  if (card) {
    for (const key of SIGNAL_KEYS) {
      const v = card[key]
      if (typeof v === 'number') { total += v; scoredCount++ }
    }
  }
  if (scoredCount === 0) return { total: null, scoredCount: 0, scorePct: null, tier: null, grade: null }
  return { total, scoredCount, scorePct: total / MAX_TOTAL, tier: tierOf(total), grade: gradeOf(total) }
}

/** Workbook: IF(F>0,G/F,"") — booked ÷ goal, as a fraction. */
export function pctToGoal(goal: number | null, booked: number | null): number | null {
  if (goal === null || goal <= 0) return null
  return (booked ?? 0) / goal
}

/** Workbook coverage: blank with no goal, "Goal met" once booked ≥ goal,
 *  otherwise pipeline ÷ the remaining gap, to one decimal. */
export function coverage(goal: number | null, booked: number | null, pipeline: number | null):
  { kind: 'none' } | { kind: 'met' } | { kind: 'ratio'; value: number } {
  if (goal === null) return { kind: 'none' }
  const gap = goal - (booked ?? 0)
  if (gap <= 0) return { kind: 'met' }
  if (pipeline === null) return { kind: 'none' }
  return { kind: 'ratio', value: Math.round((pipeline / gap) * 10) / 10 }
}

/** The "Coverage ≥3x" signal's own threshold, so the UI can flag a mismatch
 *  between the measured ratio and how the signal was scored. */
export const COVERAGE_TARGET = 3

// ── Periods ──────────────────────────────────────────────────────────────────
// 'YYYY-Qn'. The workbook is a single snapshot that gets overwritten; keeping
// scores per period is the whole reason a rep's trend exists here.

export function periodOf(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

export function isPeriod(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-Q[1-4]$/.test(s)
}

/** `count` periods ending at (and including) `from`, newest first. */
export function recentPeriods(from: Date, count = 8): string[] {
  const out: string[] = []
  let year = from.getFullYear()
  let q = Math.floor(from.getMonth() / 3) + 1
  for (let i = 0; i < count; i++) {
    out.push(`${year}-Q${q}`)
    q--
    if (q === 0) { q = 4; year-- }
  }
  return out
}

/** '2026-Q3' → 'Q3 2026'. */
export function periodLabel(p: string): string {
  const m = /^(\d{4})-(Q[1-4])$/.exec(p)
  return m ? `${m[2]} ${m[1]}` : p
}

// ── Rollups ──────────────────────────────────────────────────────────────────

/** A rep joined to their scorecard for the selected period. */
export type ScoredRep = {
  id: string
  name: string
  title: string | null
  territory: string | null
  repStatus: string | null
  companyId: string
  firmName: string
  card: RepScorecard | null
  scored: Scored
  goal: number | null
  booked: number | null
  pipeline: number | null
  rfqs60d: number | null
  hitRate: number | null
  pctToGoal: number | null
  coverage: ReturnType<typeof coverage>
}

export function buildScoredRep(
  rep: { id: string; name: string; title: string | null; territory: string | null; rep_status: string | null; company_id: string },
  firmName: string,
  card: RepScorecard | null,
): ScoredRep {
  const goal = num(card?.annual_goal)
  const booked = num(card?.booked_ytd)
  const pipeline = num(card?.open_pipeline)
  return {
    id: rep.id,
    name: rep.name,
    title: rep.title,
    territory: rep.territory,
    repStatus: rep.rep_status,
    companyId: rep.company_id,
    firmName,
    card,
    scored: scoreCard(card),
    goal, booked, pipeline,
    rfqs60d: card?.rfqs_60d ?? null,
    hitRate: num(card?.hit_rate),
    pctToGoal: pctToGoal(goal, booked),
    coverage: coverage(goal, booked, pipeline),
  }
}

/** One row of the workbook's "Firm Rollup" tab, computed from its people. */
export type FirmRollup = {
  companyId: string
  firmName: string
  people: number
  scored: number
  /** AVERAGEIFS over scored reps only, to one decimal (blank if none scored). */
  avgTotal: number | null
  avgScorePct: number | null
  tier: Tier | null
  grade: Grade | null
  platinum: number
  silver: number
  developing: number
  goal: number
  booked: number
  pipeline: number
  pctToGoal: number | null
}

export function rollupFirms(reps: ScoredRep[], firms: { id: string; name: string }[]): FirmRollup[] {
  return firms.map((firm) => {
    const mine = reps.filter((r) => r.companyId === firm.id)
    const scoredReps = mine.filter((r) => r.scored.total !== null)
    const avgTotal = scoredReps.length
      ? Math.round((scoredReps.reduce((s, r) => s + (r.scored.total ?? 0), 0) / scoredReps.length) * 10) / 10
      : null
    const goal = mine.reduce((s, r) => s + (r.goal ?? 0), 0)
    const booked = mine.reduce((s, r) => s + (r.booked ?? 0), 0)
    return {
      companyId: firm.id,
      firmName: firm.name,
      people: mine.length,
      scored: scoredReps.length,
      avgTotal,
      avgScorePct: avgTotal === null ? null : avgTotal / MAX_TOTAL,
      tier: avgTotal === null ? null : tierOf(avgTotal),
      grade: avgTotal === null ? null : gradeOf(avgTotal),
      platinum: scoredReps.filter((r) => r.scored.tier === 'Platinum / Gold').length,
      silver: scoredReps.filter((r) => r.scored.tier === 'Silver').length,
      developing: scoredReps.filter((r) => r.scored.tier === 'Developing / At-risk').length,
      goal,
      booked,
      pipeline: mine.reduce((s, r) => s + (r.pipeline ?? 0), 0),
      pctToGoal: goal > 0 ? booked / goal : null,
    }
  })
}

/** The workbook's "Summary" tab, over whichever reps are in scope. */
export function summarize(reps: ScoredRep[]) {
  const scoredReps = reps.filter((r) => r.scored.total !== null)
  const goal = reps.reduce((s, r) => s + (r.goal ?? 0), 0)
  const booked = reps.reduce((s, r) => s + (r.booked ?? 0), 0)
  const avgTotal = scoredReps.length
    ? Math.round((scoredReps.reduce((s, r) => s + (r.scored.total ?? 0), 0) / scoredReps.length) * 10) / 10
    : null
  return {
    reps: reps.length,
    scored: scoredReps.length,
    avgTotal,
    avgScorePct: avgTotal === null ? null : avgTotal / MAX_TOTAL,
    goal,
    booked,
    pipeline: reps.reduce((s, r) => s + (r.pipeline ?? 0), 0),
    pctToGoal: goal > 0 ? booked / goal : null,
    byTier: {
      'Platinum / Gold': scoredReps.filter((r) => r.scored.tier === 'Platinum / Gold').length,
      Silver: scoredReps.filter((r) => r.scored.tier === 'Silver').length,
      'Developing / At-risk': scoredReps.filter((r) => r.scored.tier === 'Developing / At-risk').length,
    } as Record<Tier, number>,
    byGrade: GRADES.reduce((acc, g) => {
      acc[g] = scoredReps.filter((r) => r.scored.grade === g).length
      return acc
    }, {} as Record<Grade, number>),
  }
}

// ── Formatting ───────────────────────────────────────────────────────────────
// Shared so the list, the drawer and the rollup render a dollar the same way.

export function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined) return '—'
  if (opts.compact) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${Math.round(v / 1_000).toLocaleString('en-US')}k`
  }
  return `$${Math.round(v).toLocaleString('en-US')}`
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

export function fmtCoverage(c: ReturnType<typeof coverage>): string {
  if (c.kind === 'met') return 'Goal met'
  if (c.kind === 'ratio') return `${c.value.toFixed(1)}x`
  return '—'
}
