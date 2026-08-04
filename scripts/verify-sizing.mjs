/* Verifies lib/sizing.ts — the selection engine — and the model-number grammar.
 *
 * The psychrometrics are checked separately against ASHRAE in verify-psychro.mjs.
 * This file checks the ENGINEERING LOGIC layered on top: that selection picks a size
 * that covers the requirement, that the process is energetically consistent, that
 * load/altitude/fresh-air all push the answer the right direction, and that model
 * numbers round-trip through the grammar in the nomenclature sheet.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-sizing.mjs
 */

import {
  calculateSizing,
  DEFAULT_SIZING_INPUTS,
  predictLeavingState,
  REACTIVATION_PERFORMANCE,
} from '../lib/sizing.ts'
import {
  buildModelNumber,
  parseModelNumber,
  selectNominalSize,
  faceVelocityFpm,
  CATALOG_SIZES,
  WHEEL_SPECS,
  MAX_DESIGN_FACE_VELOCITY_FPM,
} from '../lib/sizing-catalog.ts'
import { airStateFromRH, pressureAtAltitude } from '../lib/psychro.ts'
import { toCatalogSizes } from '../lib/dryware-sizing.ts'

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

function near(label, actual, expected, tol) {
  const d = Math.abs(actual - expected)
  ok(label, d <= tol, `got ${round(actual)} vs ${round(expected)} ±${tol}`)
}

function round(n) {
  return typeof n === 'number' ? Number(n.toFixed(3)) : n
}

function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`)
}

const inputs = (over = {}) => ({ ...DEFAULT_SIZING_INPUTS, ...over })

// ─── 1. Model-number grammar ─────────────────────────────────────────────────
// Every worked example printed in scripts/kb-reference/iat-unit-nomenclature.md.
section('1. Model-number grammar (nomenclature sheet worked examples)')

const ex1 = parseModelNumber('IAT-600REHC/IDP-450')
ok('IAT-600REHC/IDP-450 parses', ex1.valid)
ok('  nominal 600', ex1.nominalCfm === 600, `got ${ex1.nominalCfm}`)
ok('  Rotor', ex1.system === 'R', `got ${ex1.system}`)
ok('  Electric', ex1.reactivation === 'E', `got ${ex1.reactivation}`)
ok('  high-capacity wheel', ex1.wheel === 'high-capacity', `got ${ex1.wheel}`)
ok('  IDP package', ex1.idp === true)
ok('  actual 450 CFM', ex1.actualCfm === 450, `got ${ex1.actualCfm}`)

const ex2 = parseModelNumber('IAT-75REC')
ok('IAT-75REC parses as a Compact', ex2.valid && ex2.compact === true)
ok('  standard wheel (C is not HC)', ex2.wheel === 'standard', `got ${ex2.wheel}`)
ok('  not an IDP', ex2.idp === false)

const ex3 = parseModelNumber('IAT-7500RGHC-IDP')
ok('IAT-7500RGHC-IDP parses', ex3.valid)
ok('  Gas + HC + IDP, no actual CFM', ex3.reactivation === 'G' && ex3.wheel === 'high-capacity' && ex3.idp && ex3.actualCfm === undefined)

const ex4 = parseModelNumber('IAT-600RG-IDP-1200')
ok('IAT-600RG-IDP-1200 parses', ex4.valid)
ok('  nominal 600 but actual 1200', ex4.nominalCfm === 600 && ex4.actualCfm === 1200)

const ex5 = parseModelNumber('IAT-5000RS-IDP-4000')
ok('IAT-5000RS-IDP-4000 parses (Steam)', ex5.valid && ex5.reactivation === 'S' && ex5.actualCfm === 4000)

ok('bare IAT-600 parses', parseModelNumber('IAT-600').valid)
ok('garbage is rejected, not thrown', parseModelNumber('not-a-model').valid === false)

// HW must not be split into H + W.
const hw = parseModelNumber('IAT-3000RHW')
ok('IAT-3000RHW reads Hot Water (not H+W)', hw.valid && hw.reactivation === 'HW', `got ${hw.reactivation}`)

// Build → parse round trip across the whole catalog and every option combination.
section('2. buildModelNumber → parseModelNumber round trip')
let roundTripFails = 0
let combos = 0
for (const size of CATALOG_SIZES) {
  for (const react of ['E', 'S', 'G', 'HW']) {
    for (const wheel of ['standard', 'high-capacity']) {
      for (const idp of [false, true]) {
        const spec = { nominalCfm: size.nominalCfm, system: 'R', reactivation: react, wheel, idp }
        const built = buildModelNumber(spec)
        const back = parseModelNumber(built)
        combos++
        if (
          !back.valid ||
          back.nominalCfm !== spec.nominalCfm ||
          back.reactivation !== react ||
          back.wheel !== wheel ||
          back.idp !== idp
        ) {
          roundTripFails++
          if (roundTripFails <= 3) console.log(`        \x1b[90mmismatch: ${built}\x1b[0m`)
        }
      }
    }
  }
}
ok(`all ${combos} build→parse combinations round-trip`, roundTripFails === 0, `${roundTripFails} mismatches`)

// ─── 3. Size selection ───────────────────────────────────────────────────────
section('3. Catalog size selection')
ok('1 CFM → smallest size (75)', selectNominalSize(1)?.nominalCfm === 75)
ok('600 CFM → exactly 600 (boundary, not 1000)', selectNominalSize(600)?.nominalCfm === 600)
ok('601 CFM → 1000', selectNominalSize(601)?.nominalCfm === 1000)
ok('2000 CFM → 3000', selectNominalSize(2000)?.nominalCfm === 3000)
ok('30000 CFM → 30000', selectNominalSize(30000)?.nominalCfm === 30000)
ok('40000 CFM → null (needs multiple units)', selectNominalSize(40000) === null)
ok('catalog is ascending', CATALOG_SIZES.every((s, i, a) => i === 0 || s.nominalCfm > a[i - 1].nominalCfm))

// ─── 4. Baseline job ─────────────────────────────────────────────────────────
section('4. Baseline job — 2,000 CFM, 75°F/60% in, 70°F/35% target, 10% OA at 95°F/60%')
const base = calculateSizing(inputs())

console.log(`        \x1b[90mentering  ${round(base.entering.tempF)} °F  ${round(base.entering.grains)} gr/lb\x1b[0m`)
console.log(`        \x1b[90mleaving   ${round(base.leaving.tempF)} °F  ${round(base.leaving.grains)} gr/lb\x1b[0m`)
console.log(`        \x1b[90mtarget    ${round(base.target.tempF)} °F  ${round(base.target.grains)} gr/lb\x1b[0m`)
console.log(`        \x1b[90mselected  ${base.selection.model}  (${base.airflow.requiredCfm.toFixed(0)} CFM required)\x1b[0m`)
console.log(`        \x1b[90mreact     ${round(base.reactivation.electricKw)} kW · ${round(base.reactivation.btuPerLbWater)} BTU/lb water\x1b[0m`)

ok('selects a unit at or above the requirement', base.selection.nominalCfm >= base.airflow.requiredCfm)
ok('2,000 CFM job → 3,000 CFM unit', base.selection.nominalCfm === 3000, `got ${base.selection.nominalCfm}`)
ok('standard wheel suffices for a 35% RH target', base.selection.wheel === 'standard')
ok('one unit', base.selection.unitsRequired === 1)
ok('leaving air is drier than entering', base.leaving.grains < base.entering.grains)
ok('leaving air meets the target grains', base.leaving.grains <= base.target.grains)
ok('leaving air is HOTTER than entering (latent → sensible)', base.leaving.tempF > base.entering.tempF)
ok('no error-severity warnings', base.warnings.every((w) => w.severity !== 'error'))
ok('result is stamped preliminary', base.preliminary === true)

// The wheel process is modelled as adiabatic, so enthalpy must be conserved.
near('process is adiabatic (enthalpy conserved)', base.leaving.enthalpy, base.entering.enthalpy, 0.05)

// Reactivation energy sanity: desiccant systems land ~1,500–2,500 BTU per lb removed.
ok(
  'reactivation lands in the 1,500–2,500 BTU/lb band',
  base.reactivation.btuPerLbWater > 1500 && base.reactivation.btuPerLbWater < 2500,
  `got ${round(base.reactivation.btuPerLbWater)}`,
)
near('reactivation airflow is 1/3 of unit airflow', base.reactivation.airflowCfm, 1000, 0.1)

// Energy conversions must be mutually consistent.
near('kW ↔ BTU/hr', base.reactivation.electricKw * 3412.14, base.reactivation.heatBtuh, 1)
near('gas CFH ↔ BTU/hr', base.reactivation.gasCfh * 1030, base.reactivation.heatBtuh, 1)
near('steam lb/hr ↔ BTU/hr', base.reactivation.steamLbPerHour * 1000, base.reactivation.heatBtuh, 1)

// ─── 5. Fresh air must raise the entering condition ──────────────────────────
section('5. Directional sensitivity — the answers must move the right way')
const noOA = calculateSizing(inputs({ freshAirPercent: 0 }))
const lotsOA = calculateSizing(inputs({ freshAirPercent: 50 }))
ok('0% OA → entering equals the return condition', Math.abs(noOA.entering.grains - noOA.returnAir.grains) < 1e-6)
ok('more outside air → wetter entering air', lotsOA.entering.grains > base.entering.grains)
ok('more outside air → larger fresh-air load', lotsOA.load.freshAirLbPerHour > base.load.freshAirLbPerHour)
ok('50% OA raises a warning', lotsOA.warnings.some((w) => w.message.includes('outside air')))

// A deep target must force the high-capacity wheel.
const deep = calculateSizing(inputs({ target: { tempF: 70, mode: 'grains', grains: 8 } }))
ok('deep 8 gr/lb target → high-capacity wheel', deep.selection.wheel === 'high-capacity', `got ${deep.selection.wheel}`)
ok('  and the model number carries HC', deep.selection.model.includes('HC'), deep.selection.model)

// Hot water can't reach what gas can.
const hwJob = calculateSizing(inputs({ reactivation: 'HW' }))
const gasJob = calculateSizing(inputs({ reactivation: 'G' }))
ok('hot-water reactivation leaves the air wetter than gas', hwJob.leaving.grains > gasJob.leaving.grains)
ok('  and warns about the temperature limit', hwJob.warnings.some((w) => w.message.includes('Hot-water')))

// Internal moisture load must drive airflow up.
const wetProcess = calculateSizing(inputs({ internalLoadLbPerHour: 400 }))
ok('a 400 lb/hr internal load raises required CFM', wetProcess.airflow.requiredCfm > base.airflow.requiredCfm)
ok('  → a bigger unit', wetProcess.selection.nominalCfm > base.selection.nominalCfm, `${base.selection.nominalCfm} → ${wetProcess.selection.nominalCfm}`)
ok('  → flagged that the load governs', wetProcess.warnings.some((w) => w.message.includes('load governs')))

// Altitude: thinner air carries less moisture per CFM, so the same job needs more air.
const denver = calculateSizing(inputs({ altitudeFt: 5280, internalLoadLbPerHour: 400 }))
ok('at 5,280 ft the same load needs more airflow', denver.airflow.loadCfm > wetProcess.airflow.loadCfm)
ok('  and notes the altitude', denver.warnings.some((w) => w.message.includes('ft')))
near('  barometric pressure used', denver.pressure, pressureAtAltitude(5280), 1e-9)

// ─── 6. Airflow basis ────────────────────────────────────────────────────────
section('6. Airflow basis — room volume × air changes')
const room = calculateSizing(
  inputs({ airflowMode: 'room', roomVolumeFt3: 120000, airChangesPerHour: 2 }),
)
near('120,000 ft³ at 2 ACH → 4,000 CFM', room.airflow.circulationCfm, 4000, 0.001)
ok('  → 5,000 CFM unit', room.selection.nominalCfm === 5000, `got ${room.selection.nominalCfm}`)

// ─── 7. Multiple units ───────────────────────────────────────────────────────
section('7. Requirements beyond the largest single unit')
const huge = calculateSizing(inputs({ processCfm: 72000 }))
ok('72,000 CFM → multiple 30,000 CFM units', huge.selection.unitsRequired === 3, `got ${huge.selection.unitsRequired}`)
ok('  total capacity covers the requirement', huge.selection.unitsRequired * huge.selection.nominalCfm >= 72000)
ok('  and warns', huge.warnings.some((w) => w.message.includes('exceeds the largest')))

// ─── 8. Impossible / nonsense inputs are caught, not silently wrong ──────────
section('8. Guard rails')
const impossible = calculateSizing(
  inputs({ reactivation: 'HW', target: { tempF: 70, mode: 'grains', grains: 2 }, wheelPreference: 'standard' }),
)
ok('unreachable target raises an error', impossible.warnings.some((w) => w.severity === 'error'))

const backwards = calculateSizing(
  inputs({ entering: { tempF: 70, mode: 'rh', rh: 20 }, target: { tempF: 70, mode: 'rh', rh: 60 } }),
)
ok('target wetter than entering raises an error', backwards.warnings.some((w) => w.severity === 'error'))

const noAir = calculateSizing(inputs({ processCfm: 0 }))
ok('zero airflow raises an error, no NaN', noAir.warnings.some((w) => w.severity === 'error'))
ok('  and every output number stays finite', allFinite(noAir), 'no NaN/Infinity leaked')

const emptyRoom = calculateSizing(inputs({ airflowMode: 'room' }))
ok('room mode with no volume raises an error', emptyRoom.warnings.some((w) => w.severity === 'error'))

// ─── 9. Wheel model invariants ───────────────────────────────────────────────
section('9. Wheel model invariants across a sweep of entering conditions')
let violations = 0
const P = pressureAtAltitude(0)
for (let t = 40; t <= 120; t += 10) {
  for (let rh = 10; rh <= 95; rh += 5) {
    const ent = airStateFromRH(t, rh, P)
    for (const wheel of ['standard', 'high-capacity']) {
      for (const react of ['E', 'S', 'G', 'HW']) {
        const lv = predictLeavingState(ent, wheel, react, P)
        if (
          !Number.isFinite(lv.grains) ||
          !Number.isFinite(lv.tempF) ||
          lv.grains > ent.grains + 1e-9 || // never adds moisture
          lv.tempF < ent.tempF - 1e-6 || // never gets colder
          lv.grains < 0
        ) {
          violations++
        }
      }
    }
  }
}
ok('wheel never adds moisture, never cools, never returns NaN (648 cases)', violations === 0, `${violations} violations`)

// ─── 10. Catalog integrity vs the real DryWare product data ──────────────────
// Added after a full catalog rewrite passed every existing check — the suite was
// testing the ENGINE but never the DATA it selects from. These lock the product
// facts so a future edit can't silently reintroduce a unit that doesn't exist.
section('10. Catalog matches DryWare product data')

ok('no 25,000 CFM product exists', !CATALOG_SIZES.some((s) => s.nominalCfm === 25000),
  'it was on the 2022 nomenclature sheet but is not a shipping product')
ok('13 catalog sizes', CATALOG_SIZES.length === 13, `got ${CATALOG_SIZES.length}`)
ok('22,000 CFM selects the 30,000 unit (not a phantom 25,000)',
  selectNominalSize(22000)?.nominalCfm === 30000, `got ${selectNominalSize(22000)?.nominalCfm}`)

ok('every size carries real wheel geometry',
  CATALOG_SIZES.every((s) => s.wheelDiameterMm > 0 && s.wheelDepthMm > 0 && s.effectiveAreaFt2 > 0))
ok('every size carries its DryWare model number',
  CATALOG_SIZES.every((s) => /^IAT-\d+/.test(s.model)))

// Spot-check three rows against the API payload verbatim.
const byCfm = (c) => CATALOG_SIZES.find((s) => s.nominalCfm === c)
ok('IAT-3000 = 965 mm / 7.298 ft²',
  byCfm(3000)?.wheelDiameterMm === 965 && byCfm(3000)?.effectiveAreaFt2 === 7.298)
ok('IAT-30000 = 3050 mm / 73.531 ft²',
  byCfm(30000)?.wheelDiameterMm === 3050 && byCfm(30000)?.effectiveAreaFt2 === 73.531)
ok('IAT-75REC = 220 mm / 0.38 ft², 100 mm deep',
  byCfm(75)?.wheelDiameterMm === 220 && byCfm(75)?.effectiveAreaFt2 === 0.38 && byCfm(75)?.wheelDepthMm === 100)

// The design rule derived FROM this data: the rotor line runs a tight face-velocity band
// at nominal airflow. If a future catalog edit breaks that, the selection logic is wrong.
section('11. Face velocity — the constraint that picks a wheel diameter')
let outOfBand = []
for (const s of CATALOG_SIZES.filter((x) => x.nominalCfm >= 1000)) {
  const v = faceVelocityFpm(s.nominalCfm, s)
  if (v < 525 || v > 585) outOfBand.push(`${s.model}=${v.toFixed(0)}`)
}
ok('every rotor ≥1,000 CFM sits in 525–585 fpm at nominal', outOfBand.length === 0, outOfBand.join(' '))
ok('compacts deliberately run slower', faceVelocityFpm(150, byCfm(150)) < 300,
  `IAT-150REC = ${faceVelocityFpm(150, byCfm(150)).toFixed(0)} fpm`)
ok('no nominal selection exceeds the design ceiling',
  CATALOG_SIZES.every((s) => faceVelocityFpm(s.nominalCfm, s) <= MAX_DESIGN_FACE_VELOCITY_FPM))

// Over-velocity has to be caught: force a job that fills a unit past its rating.
const fast = calculateSizing(inputs({ processCfm: 2900 }))
const fastV = fast.selection.faceVelocityFpm
ok('a 2,900 CFM job on the 3,000 unit reports its real face velocity', fastV > 400 && fastV < 600, `${fastV.toFixed(0)} fpm`)
ok('  geometry is surfaced on the result', fast.selection.wheelDiameterMm === 965 && fast.selection.effectiveAreaFt2 === 7.298)

section('12. Wheel depth and reactivation temperature')
ok('standard wheel = 200 mm', WHEEL_SPECS.standard.depthMm === 200)
ok('high-capacity wheel = 400 mm', WHEEL_SPECS['high-capacity'].depthMm === 400)
ok('an HC selection reports the 400 mm rotor',
  calculateSizing(inputs({ wheelPreference: 'high-capacity' })).selection.wheelDepthMm === 400)
ok('electric reactivation is 285 °F (DryWare default, was 270)', REACTIVATION_PERFORMANCE.E.tempF === 285)
ok('gas reactivation is 285 °F', REACTIVATION_PERFORMANCE.G.tempF === 285)
ok('hot water still derates hardest', REACTIVATION_PERFORMANCE.HW.removalFactor < REACTIVATION_PERFORMANCE.S.removalFactor)
// The BTU/lb sanity band must still hold after the temperature bump.
const afterBump = calculateSizing(inputs())
ok('reactivation still lands in 1,500–2,500 BTU/lb after the 285 °F bump',
  afterBump.reactivation.btuPerLbWater > 1500 && afterBump.reactivation.btuPerLbWater < 2500,
  `got ${round(afterBump.reactivation.btuPerLbWater)}`)

// ─── 13. Live-catalog plumbing (step 2) ──────────────────────────────────────
// calculateSizing now takes an optional catalog so the page can pass Dryware's live
// one. These prove the parameter is actually USED, not just accepted — and that the
// Dryware→CatalogSize mapping collapses the duplicate 600 SKU correctly.
section('13. Live catalog parameter and Dryware mapping')

// A deliberately tiny catalog: if the parameter is ignored, selection would still
// find a 3,000 and this fails.
const TINY = [
  { model: 'TEST-1000', nominalCfm: 1000, wheelDiameterMm: 550, wheelDepthMm: 200, effectiveAreaFt2: 2.504, series: ['rotor', 'idp'] },
  { model: 'TEST-9000', nominalCfm: 9000, wheelDiameterMm: 1730, wheelDepthMm: 200, effectiveAreaFt2: 23.328, series: ['rotor', 'idp'] },
]
const tiny = calculateSizing(inputs({ processCfm: 2000 }), TINY)
ok('a passed catalog is actually used', tiny.selection.nominalCfm === 9000, `got ${tiny.selection.nominalCfm}`)
ok('  and its geometry comes through', tiny.selection.effectiveAreaFt2 === 23.328)
ok('default (no catalog arg) still uses the built-in', calculateSizing(inputs({ processCfm: 2000 })).selection.nominalCfm === 3000)

// Beyond the largest size in the PASSED catalog → multi-unit off that catalog, not the built-in.
const tinyBig = calculateSizing(inputs({ processCfm: 20000 }), TINY)
ok('multi-unit uses the passed catalog max (9,000, not 30,000)',
  tinyBig.selection.nominalCfm === 9000 && tinyBig.selection.unitsRequired === 3,
  `${tinyBig.selection.unitsRequired} × ${tinyBig.selection.nominalCfm}`)

// The Dryware → CatalogSize mapping.
const mapped = toCatalogSizes([
  { drywareId: 1, model: 'IAT-600', nominalCfm: 600, wheelDiameterMm: 440, wheelDepthMm: 200, effectiveAreaFt2: 1.591, optimizeRph: true, active: true },
  { drywareId: 2, model: 'IAT-600REC', nominalCfm: 600, wheelDiameterMm: 440, wheelDepthMm: 200, effectiveAreaFt2: 1.591, optimizeRph: true, active: true },
  { drywareId: 3, model: 'IAT-150REC', nominalCfm: 150, wheelDiameterMm: 320, wheelDepthMm: 100, effectiveAreaFt2: 0.828, optimizeRph: true, active: true },
  { drywareId: 4, model: 'IAT-3000', nominalCfm: 3000, wheelDiameterMm: 965, wheelDepthMm: 200, effectiveAreaFt2: 7.298, optimizeRph: true, active: true },
])
ok('the duplicate 600 SKU collapses to one size', mapped.filter((s) => s.nominalCfm === 600).length === 1)
ok('  keeping the non-REC model name', mapped.find((s) => s.nominalCfm === 600)?.model === 'IAT-600')
ok('  and unioning both series', (() => {
  const s = mapped.find((x) => x.nominalCfm === 600)
  return s.series.includes('compact') && s.series.includes('rotor')
})())
ok('REC models are tagged compact', mapped.find((s) => s.nominalCfm === 150)?.series.includes('compact') === true)
ok('non-REC models are tagged rotor', mapped.find((s) => s.nominalCfm === 3000)?.series.includes('rotor') === true)
ok('output is sorted ascending', mapped.every((s, i, a) => i === 0 || s.nominalCfm > a[i - 1].nominalCfm))
ok('rows without geometry would be dropped upstream', mapped.every((s) => s.effectiveAreaFt2 > 0))

function allFinite(r) {
  const nums = [
    r.pressure,
    r.airflow.requiredCfm,
    r.airflow.loadCfm,
    r.load.totalLbPerHour,
    r.load.airstreamLbPerHour,
    r.reactivation.heatBtuh,
    r.reactivation.electricKw,
    r.reactivation.btuPerLbWater,
    r.leaving.grains,
    r.leaving.tempF,
  ]
  return nums.every((n) => Number.isFinite(n))
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`)
if (failed === 0) console.log(`\x1b[32m\x1b[1mAll ${passed} checks passed.\x1b[0m`)
else console.log(`\x1b[31m\x1b[1m${failed} FAILED\x1b[0m, ${passed} passed.`)
console.log(`${'─'.repeat(64)}\n`)
process.exit(failed === 0 ? 0 : 1)
