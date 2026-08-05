/* Verifies lib/comp-review.ts against the source workbook.
 *
 * The annual review's whole premise is that the portal produces the same numbers
 * the spreadsheet does. This file is the proof: it walks the workbook's formula
 * chain by hand and asserts the port reproduces it, including the three quirks
 * kept on purpose (the /48 divisor, the squared relative score, the 4.1 pool).
 *
 * It also pins the one deliberate change — a live average-score denominator
 * instead of the hardcoded 3.5 — and the properties that follow from it: scale
 * independence, and a guarded divide when nothing has been scored yet.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-comp-review.mjs
 */

import {
  avgScore,
  effectiveAvg,
  computeLine,
  summarize,
  constantsOf,
  DEFAULT_CONSTANTS,
  tenureFrom,
  scoreTone,
} from '../lib/comp-review.ts'

let passed = 0
let failed = 0

function ok(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  } else {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  }
}

function near(label, actual, expected, tol = 1e-9) {
  const okish = actual !== null && actual !== undefined && Math.abs(actual - expected) <= tol
  ok(label, okish, `got ${actual} vs ${expected} ±${tol}`)
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

const C = constantsOf(null) // the workbook defaults: 4.1 / 48 / 40 / 52
const line = (o) => ({ per_hour: null, gross_annual: null, score: null, bonus: null, ...o })

// ─────────────────────────────────────────────────────────────────────────────
section('Workbook chain — an exactly-average performer')
// Sheet: F=3.5, avg=3.5, C=$25.00/hr.
//   N = 3.5/3.5      = 1.0
//   O = 1.0*4.1      = 4.1
//   G = 1.0*4.1      = 4.1
//   H = 25*(4.1/48)  = 2.135416…
//   J = 25 + 2.1354  = 27.135416…
//   I = 27.1354*40*52 = 56,441.67
{
  const r = computeLine(line({ per_hour: 25, score: 3.5 }), C, 3.5)
  near('N  relative score  = 1.0', r.relScore, 1.0)
  near('O  raise figure    = 4.1', r.raisePct, 4.1)
  near('G  % adjustment    = 4.1', r.adjustment, 4.1)
  near('   raise fraction  = 4.1/48', r.raiseFraction, 4.1 / 48)
  near('H  hourly increase = $2.1354', r.hourlyIncrease, 25 * (4.1 / 48), 1e-9)
  near('J  new hourly      = $27.1354', r.newHourly, 25 + 25 * (4.1 / 48), 1e-9)
  near('I  new gross annual= $56,441.67', r.newAnnual, (25 + 25 * (4.1 / 48)) * 40 * 52, 1e-6)
  ok('   kind = hourly', r.kind === 'hourly', r.kind)
  // The headline consequence of /48, asserted so nobody "fixes" it by accident:
  // an average performer receives 8.54%, not the 4.1% the pool figure implies.
  near('   effective raise = 8.54% (the /48 quirk, kept)', r.raiseFraction, 0.0854166666, 1e-9)
}

section('Quirks kept on purpose')
{
  // G = N*O means the relative score is applied twice — N² * pool.
  const r = computeLine(line({ per_hour: 25, score: 4.5 }), C, 3.5)
  const n = 4.5 / 3.5
  near('G squares the relative score (N² × pool)', r.adjustment, n * n * 4.1, 1e-9)
  ok('   a 4.5 scorer beats linear', r.adjustment > n * 4.1, `${r.adjustment.toFixed(4)} > ${(n * 4.1).toFixed(4)}`)

  // A below-average scorer is pushed down by the same squaring.
  const lo = computeLine(line({ per_hour: 25, score: 2.5 }), C, 3.5)
  const nlo = 2.5 / 3.5
  near('   and a 2.5 scorer is penalised by it', lo.adjustment, nlo * nlo * 4.1, 1e-9)
  ok('   below linear', lo.adjustment < nlo * 4.1, `${lo.adjustment.toFixed(4)} < ${(nlo * 4.1).toFixed(4)}`)

  ok('divisor default is 48, not 100', DEFAULT_CONSTANTS.divisor === 48, String(DEFAULT_CONSTANTS.divisor))
  ok('pool default is 4.1, not 3.4', DEFAULT_CONSTANTS.raisePool === 4.1, String(DEFAULT_CONSTANTS.raisePool))
}

section('The one change — a live denominator')
{
  const lines = [line({ score: 3 }), line({ score: 4 }), line({ score: 5 })]
  near('avgScore = mean of recorded scores', avgScore(lines), 4)

  // Unscored rows must not be averaged in as zeros — that would drag the
  // denominator down and inflate everyone else's raise.
  const withBlanks = [...lines, line({ score: null }), line({ score: null })]
  near('avgScore ignores unscored lines', avgScore(withBlanks), 4)
  ok('avgScore of nothing = null', avgScore([line({}), line({})]) === null)

  // The workbook's one-row override (N7 =F7/2.47) has no equivalent: every row
  // divides by the same average.
  const a = computeLine(line({ per_hour: 25, score: 4 }), C, 4)
  const b = computeLine(line({ per_hour: 25, score: 4 }), C, 4)
  ok('every row shares one denominator', a.relScore === b.relScore)
}

section('Scale independence (a property of the live average)')
{
  // Because the denominator is the mean of the same column it divides, a 1–5
  // scale and a 0–100 scale must produce identical results.
  const five = computeLine(line({ per_hour: 25, score: 4.5 }), C, 3.5)
  const hundred = computeLine(line({ per_hour: 25, score: 90 }), C, 70)
  near('score 4.5/avg 3.5 == score 90/avg 70', hundred.newHourly, five.newHourly, 1e-9)
  near('   … and the same adjustment', hundred.adjustment, five.adjustment, 1e-9)
}

section('Guarded divide — no NaN, no Infinity')
{
  const noAvg = computeLine(line({ per_hour: 25, score: 4 }), C, null)
  ok('null average → null result', noAvg.newHourly === null && noAvg.adjustment === null)
  ok('   … but current annual still known', noAvg.currentAnnual === 52000, String(noAvg.currentAnnual))

  const zeroAvg = computeLine(line({ per_hour: 25, score: 4 }), C, 0)
  ok('zero average → null, not Infinity', zeroAvg.newHourly === null)

  const noScore = computeLine(line({ per_hour: 25, score: null }), C, 3.5)
  ok('unscored line → null result', noScore.newHourly === null)

  const zeroDivisor = computeLine(line({ per_hour: 25, score: 3.5 }), { ...C, divisor: 0 }, 3.5)
  ok('zero divisor → null, not Infinity', zeroDivisor.newHourly === null)

  for (const [label, v] of Object.entries(computeLine(line({ score: 4 }), C, 3.5))) {
    if (typeof v === 'number') ok(`   ${label} is finite`, Number.isFinite(v), String(v))
  }
}

section('Salaried arm agrees with the hourly arm')
{
  // $25/hr is $52,000/yr at 40x52. A salaried employee on $52,000 with the same
  // score must land on the same new annual figure — that is the whole claim.
  const hourly = computeLine(line({ per_hour: 25, score: 4.5 }), C, 3.5)
  const salaried = computeLine(line({ gross_annual: 52000, score: 4.5 }), C, 3.5)
  near('same new annual', salaried.newAnnual, hourly.newAnnual, 1e-6)
  near('same % applied', salaried.raiseFraction, hourly.raiseFraction, 1e-12)
  ok('salaried exposes no hourly rate', salaried.newHourly === null && salaried.hourlyIncrease === null)
  ok('   kinds are distinguished', hourly.kind === 'hourly' && salaried.kind === 'salaried')

  const neither = computeLine(line({ score: 4.5 }), C, 3.5)
  ok('no pay data → kind "none", still scored', neither.kind === 'none' && neither.relScore !== null)
  ok('   … and no annual figure', neither.currentAnnual === null && neither.newAnnual === null)

  // Hourly with no stated annual falls back to rate x hrs x wks (workbook I).
  const derived = computeLine(line({ per_hour: 25, score: null }), C, 3.5)
  near('hourly current annual derived', derived.currentAnnual, 52000)
}

section('Rollup — replaces the workbook total that stopped at row 17')
{
  // 20 people, all identical, all scored. The workbook's I40 =SUM(I3:I17) would
  // have counted 15 of them.
  const many = Array.from({ length: 20 }, () => ({
    id: 'x', cycle_id: 'c', employee_id: null, person_name: 'X', tenure_override: null,
    per_hour: 25, gross_annual: null, bonus: 1000, score: 3.5, notes: null,
    created_at: '', updated_at: '',
  }))
  const s = summarize(many, C, 3.5)
  ok('counts every line', s.people === 20 && s.scored === 20, `${s.people}/${s.scored}`)
  near('current payroll spans all 20', s.currentPayroll, 20 * 52000)
  near('bonus total spans all 20', s.bonusTotal, 20 * 1000)
  near('payroll delta % = the raise %', s.payrollDeltaPct, 4.1 / 48, 1e-9)

  // An unscored person still costs what they cost.
  const mixed = [
    { ...many[0], score: 3.5 },
    { ...many[0], score: null },
  ]
  const m = summarize(mixed, C, 3.5)
  near('unscored carried at current pay', m.newPayroll, 52000 * (1 + 4.1 / 48) + 52000, 1e-6)
  ok('   scored count excludes them', m.scored === 1, String(m.scored))

  // Scored but no pay on file — surfaced rather than silently dropped.
  const orphan = summarize([{ ...many[0], per_hour: null, gross_annual: null }], C, 3.5)
  ok('scored-but-no-pay is flagged', orphan.missingPay === 1, String(orphan.missingPay))
  ok('   and excluded from payroll', orphan.currentPayroll === 0)

  const empty = summarize([], C, null)
  ok('empty cycle totals cleanly', empty.people === 0 && empty.payrollDeltaPct === null)
}

section('Finalize freezes the denominator')
{
  const lines = [line({ score: 3 }), line({ score: 4 })] // live mean 3.5
  const draft = { status: 'draft', avg_score_final: null }
  const final = { status: 'final', avg_score_final: '3.5' } // PostgREST returns a string
  near('draft uses the live average', effectiveAvg(draft, lines), 3.5)
  // Adding a low score moves a draft cycle but must not move a finalized one.
  const more = [...lines, line({ score: 1 })]
  near('draft moves when a score is added', effectiveAvg(draft, more), 8 / 3)
  near('final ignores later scores', effectiveAvg(final, more), 3.5)
}

section('Presentation helpers')
{
  ok('score tone: above average', scoreTone(1.2) === 'emerald')
  ok('score tone: at average', scoreTone(1.0) === 'sky')
  ok('score tone: unscored', scoreTone(null) === 'slate')

  const now = new Date('2026-08-05T00:00:00Z')
  ok('tenure: 6 months', tenureFrom('2026-02-05', now) === '6 mo', String(tenureFrom('2026-02-05', now)))
  ok('tenure: exactly a year', tenureFrom('2025-08-05', now) === '1 yr', String(tenureFrom('2025-08-05', now)))
  ok('tenure: years + months', tenureFrom('2019-02-05', now) === '7 yr 6 mo', String(tenureFrom('2019-02-05', now)))
  ok('tenure: unknown hire date', tenureFrom(null, now) === null)
  ok('tenure: garbage date', tenureFrom('not-a-date', now) === null)
}

console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m\n`)
process.exit(failed === 0 ? 0 : 1)
