/* Verifies lib/psychro.ts against published ASHRAE reference values.
 *
 * The Sizing Studio puts numbers on submittals, so the physics layer gets checked
 * against the book rather than against itself. Reference values below are from
 * ASHRAE Fundamentals (2017) Ch.1 Table 2 / the IP psychrometric chart at sea level.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-psychro.mjs
 * (Node ≥22.18 strips the TypeScript types on import — no build step needed.)
 */

import {
  satVaporPressure,
  pressureAtAltitude,
  airStateFromRH,
  airStateFromDewPoint,
  airStateFromGrains,
  airStateFromW,
  moistureRemoval,
  mixStreams,
  massFlowFromCFM,
  humidityRatioFromRH,
  dewPoint,
  STD_PRESSURE_PSIA,
} from '../lib/psychro.ts'

let passed = 0
let failed = 0

function check(label, actual, expected, tolerance) {
  const delta = Math.abs(actual - expected)
  const ok = delta <= tolerance
  if (ok) {
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}`)
    console.log(`        got ${fmt(actual)}   expected ${fmt(expected)} ±${tolerance}`)
  } else {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}`)
    console.log(`        got ${fmt(actual)}   expected ${fmt(expected)} ±${tolerance}   (off by ${fmt(delta)})`)
  }
}

function fmt(n) {
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(5)
  return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

const P = STD_PRESSURE_PSIA

// ─── 1. Saturation vapour pressure ───────────────────────────────────────────
// The strongest available check: water boils at exactly 1 atm at 212 °F, so the
// correlation MUST return 14.696 psia there. Table values for 32/70/95 °F follow.
section('1. Saturation vapour pressure (ASHRAE eq. 5/6)')
check('p_ws at 212 °F = 1 atm (boiling point)', satVaporPressure(212), 14.696, 0.02)
check('p_ws at 32 °F', satVaporPressure(32), 0.08865, 0.0002)
check('p_ws at 70 °F', satVaporPressure(70), 0.36334, 0.0005)
check('p_ws at 95 °F', satVaporPressure(95), 0.81543, 0.001)
check('p_ws at 0 °F (over-ice branch)', satVaporPressure(0), 0.018518, 0.00005)

// The ice/water branches must meet at the 32 °F seam — desiccant work sits right on it.
const iceSide = satVaporPressure(31.9999)
const waterSide = satVaporPressure(32)
check('ice/water branch continuity at 32 °F', iceSide, waterSide, 1e-5)

// ─── 2. Standard atmosphere ──────────────────────────────────────────────────
section('2. Barometric pressure vs altitude (ASHRAE eq. 3)')
check('sea level', pressureAtAltitude(0), 14.696, 0.001)
check('5,000 ft', pressureAtAltitude(5000), 12.228, 0.005)
// 12.100 psia ≈ 24.63 inHg, the standard Denver barometric figure.
check('Denver, 5,280 ft', pressureAtAltitude(5280), 12.100, 0.005)

// ─── 3. The canonical chart point: 70 °F, 50% RH ─────────────────────────────
section('3. Chart point — 70 °F dry bulb, 50% RH, sea level')
const room = airStateFromRH(70, 50, P)
check('humidity ratio W', room.W, 0.007786, 0.00002)
check('grains per lb', room.grains, 54.5, 0.2)
check('dew point °F', room.dewPointF, 50.5, 0.3)
check('wet bulb °F', room.wetBulbF, 58.5, 0.3)
check('enthalpy BTU/lb', room.enthalpy, 25.31, 0.05)
check('specific volume ft³/lb', room.specificVolume, 13.522, 0.01)

// ─── 4. Summer design condition: 95 °F, 40% RH ───────────────────────────────
section('4. Chart point — 95 °F dry bulb, 40% RH, sea level')
const summer = airStateFromRH(95, 40, P)
check('humidity ratio W', summer.W, 0.014118, 0.00003)
check('grains per lb', summer.grains, 98.8, 0.3)
check('dew point °F', summer.dewPointF, 66.9, 0.3)

// ─── 5. Round-trip identities ────────────────────────────────────────────────
// Every conversion path must land back on the same state, or the Studio's three
// input modes (RH / dew point / grains) would silently disagree with each other.
section('5. Round-trip identities across input modes')
const viaDp = airStateFromDewPoint(70, room.dewPointF, P)
check('RH → dew point → W', viaDp.W, room.W, 1e-6)
const viaGr = airStateFromGrains(70, room.grains, P)
check('RH → grains → W', viaGr.W, room.W, 1e-9)
check('W → RH round-trip', viaGr.rh, 50, 0.02)
const sat = airStateFromRH(60, 100, P)
check('dew point of saturated air = dry bulb', sat.dewPointF, 60, 0.02)
check('wet bulb of saturated air = dry bulb', sat.wetBulbF, 60, 0.02)

// A deep desiccant outlet — the regime our units actually run in. Verifies the
// sub-zero dew-point path returns something sane rather than clamping or NaN.
section('6. Deep-dry desiccant outlet (sub-zero dew point)')
const dry = airStateFromGrains(100, 5, P)
// Saturation at 0 °F works out to 5.53 gr/lb (from the ASHRAE p_ws check above),
// so 5 gr/lb necessarily lands just below zero — a useful anchor for reps.
check('5 gr/lb at 100 °F → dew point °F', dry.dewPointF, -1.8, 0.4)
check('  … and round-trips back to 5 gr', airStateFromDewPoint(100, dry.dewPointF, P).grains, 5, 0.02)
check('  … RH is a small positive percent', dry.rh > 0 && dry.rh < 3 ? 1 : 0, 1, 0)

// ─── 7. Mass flow & moisture removal ─────────────────────────────────────────
// Cross-check against the shop shortcut lb/hr ≈ 4.5 × CFM × ΔW, which bakes in
// sea-level standard density. At ~70 °F the two should agree within a couple of %.
section('7. Mass flow and moisture-removal duty')
check('mass flow, 1000 CFM at 70 °F/50%', massFlowFromCFM(1000, room), 4437, 5)

const target = airStateFromGrains(70, 20, P)
const duty = moistureRemoval(1000, room, target)
const shortcut = 4.5 * 1000 * (room.W - target.W)
check('duty vs 4.5×CFM×ΔW shortcut (lb/hr)', duty.lbPerHour, shortcut, shortcut * 0.03)
check('grain depression', duty.deltaGrains, 34.5, 0.2)
check('grains/hr = lb/hr × 7000', duty.grainsPerHour, duty.lbPerHour * 7000, 1e-6)

// Altitude must reduce the duty for the same CFM and grain depression — this is
// the failure mode that silently undersizes a high-altitude job.
const pDenver = pressureAtAltitude(5280)
const roomDenver = airStateFromGrains(70, room.grains, pDenver)
const targetDenver = airStateFromGrains(70, 20, pDenver)
const dutyDenver = moistureRemoval(1000, roomDenver, targetDenver)
check(
  'Denver duty < sea-level duty for same CFM/Δgrains',
  dutyDenver.lbPerHour < duty.lbPerHour ? 1 : 0,
  1,
  0,
)
check('Denver duty is ~17% lower', dutyDenver.lbPerHour / duty.lbPerHour, 0.825, 0.02)

// ─── 8. Adiabatic mixing ─────────────────────────────────────────────────────
section('8. Adiabatic mixing of return + outside air')
const same = mixStreams(room, 500, room, 500, P)
check('mixing a stream with itself is identity (W)', same.W, room.W, 1e-9)
check('mixing a stream with itself is identity (t)', same.tempF, 70, 0.01)

const outside = airStateFromRH(95, 60, P)
const mixed = mixStreams(room, 750, outside, 250, P)
// 25% outside air must land between the two, nearer the return stream.
check('25% OA mix lands between the streams (W)', mixed.W > room.W && mixed.W < outside.W ? 1 : 0, 1, 0)
check('25% OA mix temperature', mixed.tempF, 76.2, 0.6)

// ─── 9. Guard rails ──────────────────────────────────────────────────────────
section('9. Guard rails on bad input')
check('zero humidity ratio → floor dew point, not NaN', Number.isFinite(dewPoint(0, P)) ? 1 : 0, 1, 0)
check('dew point above dry bulb clamps to saturation', airStateFromDewPoint(60, 90, P).rh, 100, 0.01)
check('negative W is clamped to zero', airStateFromW(70, -0.005, P).W, 0, 0)
check('RH input above 100 clamps', humidityRatioFromRH(70, 1.5, P), humidityRatioFromRH(70, 1.0, P), 1e-12)

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`)
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1mAll ${passed} checks passed.\x1b[0m`)
} else {
  console.log(`\x1b[31m\x1b[1m${failed} FAILED\x1b[0m, ${passed} passed.`)
}
console.log(`${'─'.repeat(64)}\n`)
process.exit(failed === 0 ? 0 : 1)
