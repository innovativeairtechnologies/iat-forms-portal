// ─────────────────────────────────────────────────────────────────────────────
// lib/comp-review.ts — the merit-increase model behind /admin/comp-review.
//
// Ported 1:1 from the "Sample Annual Review Spreadsheet" workbook so the numbers
// the annual review already runs on do not move. Every formula below quotes its
// workbook original beside it.
//
// The workbook's chain, in its own column letters:
//   F  Score            (typed by hand — drives everything)
//   N  =F3/3.5          relative score, "% of Avg score"
//   O  =N3*4.1          "% of 3.4% Raise"  ← header says 3.4, multiplier is 4.1
//   G  =N3*O3           "% Adjustment"     ← applies the relative score TWICE
//   H  =C3*(G3/48)      hourly increase    ← /48, not /100
//   J  =C3+H3           new hourly rate
//   I  =J3*40*52        new gross annual
//
// EXACTLY ONE thing changed in the port, at Jacob's direction (2026-08-05): the
// `3.5` denominator was hardcoded — the workbook's own header reads "% of Avg
// score ()" with the parens left empty — so it becomes the live mean of every
// score actually recorded in the cycle. That also retires the workbook's one-row
// override at N7 (=F7/2.47, Chris Hill), which simply disappears.
//
// A free consequence worth knowing: because the denominator is now the mean of
// the same column it divides, the model is SCALE-AGNOSTIC. Scores out of 5, 10
// or 100 all produce identical relative scores, so nothing here needs to know
// which scale the reviewers used. That is why `score` carries no upper bound.
//
// Everything else is deliberately kept, quirks included — see docs/comp-review.md
// before "fixing" any of it:
//   • /48 (not /100) makes every raise ~2.08x what the pool figure implies.
//   • G = N*O squares the relative score, widening the spread between scorers.
//   • the 4.1 pool contradicts its own column header.
// All three are cycle constants (`divisor`, `raise_pool`) rather than literals,
// so settling them later is a row update, not a deploy.
//
// Dependency-free and serializable (no server or React imports) so the server
// page, the API routes AND the client all compute identically — the lib/roles.ts,
// lib/territories.ts and lib/rep-scorecard.ts precedent. Nothing computed here is
// stored: every output is a pure function of the inputs plus the cycle constants,
// so changing the model is one edit here rather than a backfill.
// ─────────────────────────────────────────────────────────────────────────────

import type { Tone } from '@/components/admin/list'

// ── Rows (migration 078) ─────────────────────────────────────────────────────

export type CycleStatus = 'draft' | 'final'

export type CompCycle = {
  id: string
  year: number
  label: string | null
  status: CycleStatus
  /** numeric columns arrive from PostgREST as STRINGS — always read via `num()`. */
  raise_pool: string | number | null       // workbook O's multiplier (4.1)
  divisor: string | number | null          // workbook H's divisor (48)
  hours_per_week: string | number | null   // workbook I (40)
  weeks_per_year: string | number | null   // workbook I (52)
  /** Set only when the cycle is finalized — see `effectiveAvg`. */
  avg_score_final: string | number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CompReviewLine = {
  id: string
  cycle_id: string
  /** Nullable: `employees.id` is FK'd to auth.users, so a row there requires a
   *  portal login. The review roster includes people who may not have one. */
  employee_id: string | null
  person_name: string
  tenure_override: string | null
  per_hour: string | number | null      // workbook C
  gross_annual: string | number | null  // workbook D
  bonus: string | number | null         // workbook E
  score: string | number | null         // workbook F
  notes: string | null                  // workbook L
  created_at: string
  updated_at: string
}

/** Coerce a PostgREST `numeric` (string) or a form value to a number, or null.
 *  Same helper, same reason, as lib/rep-scorecard.ts. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// ── Cycle constants ──────────────────────────────────────────────────────────
// Defaults match the workbook exactly. They live on the cycle row so a past year
// always recomputes with ITS constants — tuning next year never rewrites last
// year's record.

export const DEFAULT_CONSTANTS = {
  raisePool: 4.1,     // workbook O: =N3*4.1
  divisor: 48,        // workbook H: =C3*(G3/48)
  hoursPerWeek: 40,   // workbook I: =J3*40*52
  weeksPerYear: 52,
} as const

export type Constants = { raisePool: number; divisor: number; hoursPerWeek: number; weeksPerYear: number }

export function constantsOf(cycle: CompCycle | null | undefined): Constants {
  return {
    raisePool: num(cycle?.raise_pool) ?? DEFAULT_CONSTANTS.raisePool,
    divisor: num(cycle?.divisor) ?? DEFAULT_CONSTANTS.divisor,
    hoursPerWeek: num(cycle?.hours_per_week) ?? DEFAULT_CONSTANTS.hoursPerWeek,
    weeksPerYear: num(cycle?.weeks_per_year) ?? DEFAULT_CONSTANTS.weeksPerYear,
  }
}

// ── The denominator ──────────────────────────────────────────────────────────

/**
 * Mean of every score actually RECORDED, or null if none are. This is the
 * workbook's hardcoded `3.5`, made live.
 *
 * Unscored lines are excluded rather than counted as zero: "we haven't reviewed
 * them yet" and "they scored nothing" are different facts, and averaging the
 * former in would drag everyone else's raise up as a side effect of an empty row.
 */
export function avgScore(lines: Pick<CompReviewLine, 'score'>[]): number | null {
  const scores = lines.map((l) => num(l.score)).filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/**
 * The denominator to actually divide by.
 *
 * A live average means every row depends on every other row — scoring one person
 * moves everybody's raise. That is correct while a cycle is being worked, and
 * wrong once it has been signed off, so finalizing snapshots the average onto
 * the cycle and this returns the frozen value from then on.
 */
export function effectiveAvg(
  cycle: CompCycle | null | undefined,
  lines: Pick<CompReviewLine, 'score'>[],
): number | null {
  if (cycle?.status === 'final') return num(cycle.avg_score_final)
  return avgScore(lines)
}

// ── Per-line computation ─────────────────────────────────────────────────────

/** Which arm of the model a line is on — decided by which pay fields are filled.
 *  Both are optional because employees are one or the other, not both. */
export type PayKind = 'hourly' | 'salaried' | 'none'

export type ComputedLine = {
  kind: PayKind
  /** Workbook N — the score as a multiple of the average. */
  relScore: number | null
  /** Workbook O — the personalized raise figure. */
  raisePct: number | null
  /** Workbook G — "% Adjustment". NOT a fraction: 4.1 means "4.1". */
  adjustment: number | null
  /** `adjustment / divisor` — the actual fraction applied to pay. */
  raiseFraction: number | null
  /** Workbook H. Null for salaried lines. */
  hourlyIncrease: number | null
  /** Workbook J. Null for salaried lines. */
  newHourly: number | null
  currentAnnual: number | null
  /** Workbook I. */
  newAnnual: number | null
  annualIncrease: number | null
}

const EMPTY: ComputedLine = {
  kind: 'none', relScore: null, raisePct: null, adjustment: null, raiseFraction: null,
  hourlyIncrease: null, newHourly: null, currentAnnual: null, newAnnual: null, annualIncrease: null,
}

/**
 * The workbook chain for one person.
 *
 * `avg` is the denominator from `effectiveAvg` — passed in rather than derived
 * here because it depends on the whole cycle, and recomputing it per row would
 * be quadratic on every keystroke in the drawer.
 */
export function computeLine(
  line: Pick<CompReviewLine, 'per_hour' | 'gross_annual' | 'score'>,
  c: Constants,
  avg: number | null,
): ComputedLine {
  const perHour = num(line.per_hour)
  const grossAnnual = num(line.gross_annual)
  const score = num(line.score)

  const kind: PayKind = perHour !== null ? 'hourly' : grossAnnual !== null ? 'salaried' : 'none'

  // Current annual is known even before a score exists, so the payroll total is
  // real from the first row typed. Hourly with no stated annual falls back to
  // rate x hrs x wks, the same arithmetic the workbook's column I uses.
  const currentAnnual =
    grossAnnual !== null ? grossAnnual
    : perHour !== null ? perHour * c.hoursPerWeek * c.weeksPerYear
    : null

  // No score, no average, or a zero/negative average → no result. Guarding here
  // is what keeps a divide-by-zero from reaching the UI as NaN or Infinity: an
  // empty cycle has no average at all, and it stays "—" rather than becoming a
  // number nobody can explain.
  if (score === null || avg === null || avg <= 0) {
    return { ...EMPTY, kind, currentAnnual }
  }

  const relScore = score / avg                    // workbook N: =F3/3.5
  const raisePct = relScore * c.raisePool          // workbook O: =N3*4.1
  const adjustment = relScore * raisePct           // workbook G: =N3*O3

  // The workbook divides the adjustment by 48 to reach a fraction of pay. Kept
  // as-is (see the header note); `divisor` makes it a settable constant.
  const raiseFraction = c.divisor === 0 ? null : adjustment / c.divisor
  if (raiseFraction === null) return { ...EMPTY, kind, currentAnnual, relScore, raisePct, adjustment }

  if (kind === 'hourly' && perHour !== null) {
    const hourlyIncrease = perHour * raiseFraction              // workbook H: =C3*(G3/48)
    const newHourly = perHour + hourlyIncrease                  // workbook J: =C3+H3
    const newAnnual = newHourly * c.hoursPerWeek * c.weeksPerYear // workbook I: =J3*40*52
    return {
      kind, relScore, raisePct, adjustment, raiseFraction,
      hourlyIncrease, newHourly, currentAnnual, newAnnual,
      annualIncrease: currentAnnual === null ? null : newAnnual - currentAnnual,
    }
  }

  if (kind === 'salaried' && grossAnnual !== null) {
    // Not a workbook formula — the sheet has no salaried path, because its whole
    // chain hangs off an hourly rate. This is algebraically the same operation
    // the hourly arm performs (pay x (1 + raiseFraction)), applied to the annual
    // figure instead, so a salaried and an hourly employee with the same score
    // receive the same percentage. Hourly outputs stay null so the list shows
    // honestly who is paid which way.
    const newAnnual = grossAnnual * (1 + raiseFraction)
    return {
      kind, relScore, raisePct, adjustment, raiseFraction,
      hourlyIncrease: null, newHourly: null,
      currentAnnual, newAnnual, annualIncrease: newAnnual - grossAnnual,
    }
  }

  // Scored, but no pay on file yet — the review stands, the money doesn't.
  return { ...EMPTY, kind, relScore, raisePct, adjustment, raiseFraction, currentAnnual }
}

// ── Rollup ───────────────────────────────────────────────────────────────────
// This replaces the workbook's row 40, where `I40 =SUM(I3:I17)` totalled 15 of
// the 34 people on the sheet. Totals here always span every line.

export type CompSummary = {
  people: number
  scored: number
  /** The live denominator, surfaced because it moves as scores are entered. */
  avg: number | null
  currentPayroll: number
  newPayroll: number
  payrollDelta: number
  /** Fraction, e.g. 0.085. Null when there is no current payroll to compare to. */
  payrollDeltaPct: number | null
  bonusTotal: number
  /** Lines with a score but no pay data — they'd otherwise vanish silently. */
  missingPay: number
}

export function summarize(
  lines: CompReviewLine[],
  c: Constants,
  avg: number | null,
): CompSummary {
  let currentPayroll = 0
  let newPayroll = 0
  let bonusTotal = 0
  let scored = 0
  let missingPay = 0

  for (const line of lines) {
    const computed = computeLine(line, c, avg)
    if (num(line.score) !== null) scored++
    bonusTotal += num(line.bonus) ?? 0
    if (computed.currentAnnual === null) {
      if (num(line.score) !== null) missingPay++
      continue
    }
    currentPayroll += computed.currentAnnual
    // An unscored person still costs what they cost — carry them into the new
    // payroll at their current pay so the total is a real budget number rather
    // than one that silently omits everybody not yet reviewed.
    newPayroll += computed.newAnnual ?? computed.currentAnnual
  }

  return {
    people: lines.length,
    scored,
    avg,
    currentPayroll,
    newPayroll,
    payrollDelta: newPayroll - currentPayroll,
    payrollDeltaPct: currentPayroll > 0 ? (newPayroll - currentPayroll) / currentPayroll : null,
    bonusTotal,
    missingPay,
  }
}

// ── Presentation ─────────────────────────────────────────────────────────────

/**
 * Tone for a score pill, keyed off the score's ratio to the average rather than
 * an absolute band — the workbook defines no bands, and an absolute one would be
 * an invention that breaks the moment reviewers change scale. Presentational
 * only; nothing here feeds the math.
 */
export function scoreTone(relScore: number | null): Tone {
  if (relScore === null) return 'slate'
  if (relScore >= 1.1) return 'emerald'
  if (relScore >= 0.9) return 'sky'
  if (relScore >= 0.7) return 'amber'
  return 'rose'
}

export const PAY_KIND_LABEL: Record<PayKind, string> = {
  hourly: 'Hourly',
  salaried: 'Salaried',
  none: 'No pay data',
}

export const PAY_KIND_TONE: Record<PayKind, Tone> = {
  hourly: 'sky',
  salaried: 'violet',
  none: 'slate',
}

/** Whole dollars — annual figures, payroll totals. */
export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `$${Math.round(v).toLocaleString('en-US')}`
}

/** Signed whole dollars, for deltas. */
export function fmtDelta(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${v < 0 ? '−' : '+'}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
}

/** Two decimals — hourly rates and hourly increases. Deliberately NOT
 *  lib/rep-scorecard.ts's fmtMoney, which rounds to whole dollars: a $27.14 rate
 *  rendered "$27" is the wrong number on a pay sheet. */
export function fmtRate(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `$${v.toFixed(2)}`
}

/** A stored fraction as a percent — e.g. 0.0854 → "8.5%". */
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** The workbook's "% Adjustment" is already percent-shaped (4.1 = "4.1"), so it
 *  is printed as-is rather than multiplied by 100 like a fraction. */
export function fmtAdjustment(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(2)
}

export function fmtScore(v: string | number | null | undefined): string {
  const n = num(v)
  if (n === null) return '—'
  return String(Math.round(n * 100) / 100)
}

// ── Tenure ───────────────────────────────────────────────────────────────────

/**
 * Workbook column B, computed instead of typed. The sheet's values were free
 * text and inconsistent ("6 m", "7 y", "11y", "3y"), and several rows were
 * simply blank; `employees.hire_date` already holds the fact.
 */
export function tenureFrom(hireDate: string | null | undefined, now = new Date()): string | null {
  if (!hireDate) return null
  const start = new Date(hireDate)
  if (Number.isNaN(start.getTime())) return null
  const months = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()) -
      (now.getDate() < start.getDate() ? 1 : 0),
  )
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`
}

/** The tenure to show: an explicit override wins, else derived from hire date. */
export function tenureOf(
  line: Pick<CompReviewLine, 'tenure_override'>,
  hireDate: string | null | undefined,
  now?: Date,
): string | null {
  return line.tenure_override?.trim() || tenureFrom(hireDate, now)
}
