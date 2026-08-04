/* Verifies lib/hvac-calcs.ts — the standalone calculators ported from DryWare.
 *
 * These end up on submittals and in the field, so each one is checked against a
 * hand-computable case or a published reference rather than against itself.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-hvac-calcs.mjs
 */

import {
  roundDuctAreaFt2,
  rectDuctAreaFt2,
  equivalentRoundDiameterIn,
  velocityFpm,
  cfmFromVelocity,
  diameterForVelocityIn,
  frictionLossPer100ft,
  diameterForFrictionIn,
  cfmForFriction,
  solveDuct,
  secondsPerRevolution,
  rphFromSeconds,
  sectorDwellSeconds,
  coilWidthForRows,
  COIL_WIDTHS_IN,
  bypassCfm,
  btuhToKw,
  kwToBtuh,
  sensibleBtuh,
} from '../lib/hvac-calcs.ts'

let passed = 0, failed = 0
function ok(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`) }
  else { failed++; console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`) }
}
function near(label, actual, expected, tol) {
  ok(label, Math.abs(actual - expected) <= tol, `got ${round(actual)} vs ${round(expected)} ±${tol}`)
}
const round = (n) => (typeof n === 'number' ? Number(n.toFixed(4)) : n)
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`)

// ─── Areas ───────────────────────────────────────────────────────────────────
section('1. Duct areas (hand-computable)')
// A 12" round duct is exactly 1 ft diameter → π/4 ft² = 0.7853975
near('12 in round = π/4 ft²', roundDuctAreaFt2(12), Math.PI / 4, 1e-9)
near('24 in round = π ft²', roundDuctAreaFt2(24), Math.PI, 1e-9)
near('12×12 in rect = 1 ft²', rectDuctAreaFt2(12, 12), 1, 1e-9)
near('24×12 in rect = 2 ft²', rectDuctAreaFt2(24, 12), 2, 1e-9)
ok('zero/negative diameter is 0, not NaN', roundDuctAreaFt2(0) === 0 && roundDuctAreaFt2(-5) === 0)

// A square duct's equivalent round diameter is ~1.09× its side (ASHRAE table).
near('12×12 equivalent round ≈ 13.1 in', equivalentRoundDiameterIn(12, 12), 13.1, 0.15)
ok('equivalent round is symmetric', Math.abs(equivalentRoundDiameterIn(30, 10) - equivalentRoundDiameterIn(10, 30)) < 1e-9)

// ─── Velocity ────────────────────────────────────────────────────────────────
section('2. Velocity ⇄ CFM')
near('1000 CFM through 1 ft² = 1000 fpm', velocityFpm(1000, 1), 1000, 1e-9)
near('round trip CFM→V→CFM', cfmFromVelocity(velocityFpm(2000, 3), 3), 2000, 1e-9)
// 2000 CFM at 1500 fpm needs 1.333 ft² → d = sqrt(576·2000/(π·1500)) = 15.64"
near('2000 CFM at 1500 fpm → 15.6 in', diameterForVelocityIn(2000, 1500), 15.64, 0.05)
near('  and that diameter really gives 1500 fpm',
  velocityFpm(2000, roundDuctAreaFt2(diameterForVelocityIn(2000, 1500))), 1500, 0.01)

// ─── Friction ────────────────────────────────────────────────────────────────
section('3. Duct friction (Wright/ASHRAE fit)')
// Anchored on the duct-sizing rules every estimator knows, at the standard 0.1
// in.wg/100 ft design friction rate: 400 CFM ≈ 10", 1000 ≈ 14", 2000 ≈ 18".
// (Checking the diameter at a standard friction rate is a far better test than
// picking an arbitrary diameter — a 12" duct at 1000 CFM is simply undersized,
// 1273 fpm, which is why it reads 0.21 rather than anything near 0.1.)
near('400 CFM at 0.1 in/100 ft → ~10 in', diameterForFrictionIn(400, 0.1), 10, 0.3)
near('1000 CFM at 0.1 in/100 ft → ~14 in', diameterForFrictionIn(1000, 0.1), 14, 0.2)
near('2000 CFM at 0.1 in/100 ft → ~18 in', diameterForFrictionIn(2000, 0.1), 18, 0.3)
// …and the resulting velocities must land in the normal commercial band.
ok('those diameters give sane velocities (700–1400 fpm)',
  [400, 1000, 2000, 4000].every((q) => {
    const v = velocityFpm(q, roundDuctAreaFt2(diameterForFrictionIn(q, 0.1)))
    return v > 700 && v < 1400
  }))
ok('friction rises with flow', frictionLossPer100ft(2000, 12) > frictionLossPer100ft(1000, 12))
ok('friction falls with diameter', frictionLossPer100ft(1000, 16) < frictionLossPer100ft(1000, 12))

// Inverses must round-trip.
near('diameter→friction→diameter', diameterForFrictionIn(1000, frictionLossPer100ft(1000, 12)), 12, 0.01)
near('friction→cfm→friction', cfmForFriction(12, frictionLossPer100ft(1000, 12)), 1000, 0.5)

// ─── solveDuct from every corner ─────────────────────────────────────────────
section('4. solveDuct — same duct from any two knowns')
const REF = { cfm: 2000, diameterIn: 14 }
const base = solveDuct(REF)
ok('cfm + diameter solves', !!base, `${round(base.velocityFpm)} fpm, ${round(base.frictionPer100ft)} in/100ft`)

const fromVel = solveDuct({ cfm: REF.cfm, velocityFpm: base.velocityFpm })
near('cfm + velocity → same diameter', fromVel.diameterIn, 14, 0.01)
const fromFric = solveDuct({ cfm: REF.cfm, frictionPer100ft: base.frictionPer100ft })
near('cfm + friction → same diameter', fromFric.diameterIn, 14, 0.01)
const fromDiaVel = solveDuct({ diameterIn: 14, velocityFpm: base.velocityFpm })
near('diameter + velocity → same cfm', fromDiaVel.cfm, 2000, 0.5)
const fromDiaFric = solveDuct({ diameterIn: 14, frictionPer100ft: base.frictionPer100ft })
near('diameter + friction → same cfm', fromDiaFric.cfm, 2000, 1)
// The coupled case — velocity + friction, neither diameter nor flow known.
const fromVelFric = solveDuct({ velocityFpm: base.velocityFpm, frictionPer100ft: base.frictionPer100ft })
near('velocity + friction → same diameter', fromVelFric.diameterIn, 14, 0.05)
near('  and the same cfm', fromVelFric.cfm, 2000, 5)

ok('one known alone is unsolvable (null, not a guess)', solveDuct({ cfm: 2000 }) === null)
near('total loss scales with run length', solveDuct(REF, 250).totalLoss, base.frictionPer100ft * 2.5, 1e-9)

// ─── Wheel rotation ──────────────────────────────────────────────────────────
section('5. RPH ⇄ time and sector dwell')
near('20 RPH = 180 s per revolution', secondsPerRevolution(20), 180, 1e-9)
near('180 s per rev = 20 RPH', rphFromSeconds(180), 20, 1e-9)
near('round trip', rphFromSeconds(secondsPerRevolution(37)), 37, 1e-9)
// At 20 RPH the 270° process sector is three quarters of 180 s.
near('270° dwell at 20 RPH = 135 s', sectorDwellSeconds(20, 270), 135, 1e-9)
near('90° dwell at 20 RPH = 45 s', sectorDwellSeconds(20, 90), 45, 1e-9)
ok('process + react dwell = one revolution',
  Math.abs(sectorDwellSeconds(20, 270) + sectorDwellSeconds(20, 90) - secondsPerRevolution(20)) < 1e-9)
ok('zero RPH is 0, not Infinity', secondsPerRevolution(0) === 0 && sectorDwellSeconds(0, 270) === 0)

// ─── Coil widths ─────────────────────────────────────────────────────────────
section('6. Coil width lookup')
ok('1 row = 5 in', coilWidthForRows(1) === 5)
ok('2 and 3 rows share 6.5 in', coilWidthForRows(2) === 6.5 && coilWidthForRows(3) === 6.5)
ok('4 and 5 rows share 7.5 in', coilWidthForRows(4) === 7.5 && coilWidthForRows(5) === 7.5)
ok('6 row = 10 in', coilWidthForRows(6) === 10)
ok('12 row = 18 in', coilWidthForRows(12) === 18)
ok('7 rows is not offered → null', coilWidthForRows(7) === null)
ok('widths increase with rows', COIL_WIDTHS_IN.every((c, i, a) => i === 0 || c.widthIn >= a[i - 1].widthIn))

// ─── Bypass ──────────────────────────────────────────────────────────────────
section('7. Bypass CFM')
// Inlet 80 gr, wheel dries to 10 gr, want 45 gr → exactly half bypassed.
const half = bypassCfm(2000, 80, 10, 45)
near('midpoint target = 50% bypass', half.bypassFraction, 0.5, 1e-9)
near('  1000 CFM bypassed', half.bypassCfm, 1000, 1e-9)
near('  1000 CFM through the wheel', half.throughWheelCfm, 1000, 1e-9)
ok('  and it is reachable', half.unreachable === false)
ok('bypass + through = total', Math.abs(half.bypassCfm + half.throughWheelCfm - 2000) < 1e-9)

// Target equal to the wheel outlet → no bypass at all.
near('target = wheel outlet → 0% bypass', bypassCfm(2000, 80, 10, 10).bypassFraction, 0, 1e-9)
// Target equal to inlet → everything bypassed.
near('target = inlet → 100% bypass', bypassCfm(2000, 80, 10, 80).bypassFraction, 1, 1e-9)
// Drier than the wheel can produce → flagged, not silently clamped-and-forgotten.
ok('target drier than the wheel outlet is flagged unreachable', bypassCfm(2000, 80, 10, 5).unreachable === true)
ok('target wetter than inlet is flagged unreachable', bypassCfm(2000, 80, 10, 95).unreachable === true)
ok('degenerate span (inlet = outlet) is flagged, not NaN', bypassCfm(2000, 40, 40, 40).unreachable === true)

// ─── Energy ──────────────────────────────────────────────────────────────────
section('8. Energy conversions')
near('3412.14 BTU/hr = 1 kW', btuhToKw(3412.14), 1, 1e-9)
near('1 kW = 3412.14 BTU/hr', kwToBtuh(1), 3412.14, 1e-9)
near('round trip', btuhToKw(kwToBtuh(17.5)), 17.5, 1e-9)
// 1.08 × CFM × ΔT — 2000 CFM raised 30 °F
near('2000 CFM × 30 °F = 64,800 BTU/hr', sensibleBtuh(2000, 30), 64800, 1e-9)
ok('cooling (negative ΔT) is negative', sensibleBtuh(2000, -20) < 0)

console.log(`\n${'─'.repeat(64)}`)
if (failed === 0) console.log(`\x1b[32m\x1b[1mAll ${passed} checks passed.\x1b[0m`)
else console.log(`\x1b[31m\x1b[1m${failed} FAILED\x1b[0m, ${passed} passed.`)
console.log(`${'─'.repeat(64)}\n`)
process.exit(failed === 0 ? 0 : 1)
