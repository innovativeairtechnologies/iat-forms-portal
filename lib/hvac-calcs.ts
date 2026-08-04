/* Standalone HVAC calculators — the formula half of DryWare's calculator suite.
 *
 * DryWare ships 15 calculators. Five were already covered by lib/psychro.ts +
 * lib/sizing.ts (psychrometrics, air mixing, moisture removal, reactivation heat,
 * BTU/kW). These are the rest of the ones that are pure formula, so they can live
 * here rather than behind a network call:
 *
 *   Velocity / CFM · Duct diameter & friction loss · Duct diameter & velocity ·
 *   Duct velocity & friction loss · RPH ⇄ time · Coil widths · Bypass CFM · BTU ⇄ kW
 *
 * Every function is pure and unit-tested (scripts/verify-hvac-calcs.mjs). IP units
 * throughout, matching the shop and the submittals.
 *
 * NOT ported: DryWare's Desiccant Wheel Calculator (table-driven off wheel
 * performance curves we don't have) and Ship Date (belongs with the CRM, not sizing).
 */

// ─── Areas and velocity ──────────────────────────────────────────────────────

/** Cross-sectional area of a round duct, ft², from diameter in INCHES. */
export function roundDuctAreaFt2(diameterIn: number): number {
  if (diameterIn <= 0) return 0
  // π/4 × (d/12)² = π d² / 576
  return (Math.PI * diameterIn * diameterIn) / 576
}

/** Cross-sectional area of a rectangular duct, ft², from sides in INCHES. */
export function rectDuctAreaFt2(widthIn: number, heightIn: number): number {
  if (widthIn <= 0 || heightIn <= 0) return 0
  return (widthIn * heightIn) / 144
}

/**
 * Equivalent round diameter of a rectangular duct, inches (ASHRAE eq. for equal
 * friction and airflow). Rectangular duct is sized by converting to this first.
 */
export function equivalentRoundDiameterIn(widthIn: number, heightIn: number): number {
  if (widthIn <= 0 || heightIn <= 0) return 0
  return (1.3 * Math.pow(widthIn * heightIn, 0.625)) / Math.pow(widthIn + heightIn, 0.25)
}

/** Velocity (ft/min) from airflow (CFM) and area (ft²). */
export function velocityFpm(cfm: number, areaFt2: number): number {
  return areaFt2 > 0 ? cfm / areaFt2 : 0
}

/** Airflow (CFM) from velocity (ft/min) and area (ft²). */
export function cfmFromVelocity(velocityFpm: number, areaFt2: number): number {
  return velocityFpm * areaFt2
}

/** Round-duct diameter (inches) that carries `cfm` at `targetFpm`. */
export function diameterForVelocityIn(cfm: number, targetFpm: number): number {
  if (cfm <= 0 || targetFpm <= 0) return 0
  // A = Q/V, then invert A = π d² / 576
  return Math.sqrt((576 * cfm) / (Math.PI * targetFpm))
}

// ─── Duct friction ───────────────────────────────────────────────────────────

/**
 * Friction loss in round galvanised duct, inches w.g. per 100 ft.
 *
 * The standard Wright/ASHRAE fit used by every duct friction chart:
 *   Δp = 0.109136 · Q^1.9 / d^5.02      (Q in CFM, d in inches)
 *
 * Valid for the usual commercial range and for clean galvanised duct with normal
 * roughness (ε ≈ 0.0003 ft). Flex, lined, or dirty duct is materially worse — this
 * is a sizing figure, not an as-built prediction.
 */
export function frictionLossPer100ft(cfm: number, diameterIn: number): number {
  if (cfm <= 0 || diameterIn <= 0) return 0
  return (0.109136 * Math.pow(cfm, 1.9)) / Math.pow(diameterIn, 5.02)
}

/** Round-duct diameter (inches) that carries `cfm` at a target friction rate. */
export function diameterForFrictionIn(cfm: number, lossPer100ft: number): number {
  if (cfm <= 0 || lossPer100ft <= 0) return 0
  return Math.pow((0.109136 * Math.pow(cfm, 1.9)) / lossPer100ft, 1 / 5.02)
}

/** Airflow (CFM) a given diameter carries at a given friction rate. */
export function cfmForFriction(diameterIn: number, lossPer100ft: number): number {
  if (diameterIn <= 0 || lossPer100ft <= 0) return 0
  return Math.pow((lossPer100ft * Math.pow(diameterIn, 5.02)) / 0.109136, 1 / 1.9)
}

export type DuctSolution = {
  cfm: number
  diameterIn: number
  velocityFpm: number
  frictionPer100ft: number
  /** Total loss over the stated run, inches w.g. */
  totalLoss: number
}

/**
 * Solve a duct from any two of {cfm, diameter, velocity, friction}. This is
 * DryWare's three duct calculators (diameter+friction, diameter+velocity,
 * velocity+friction) collapsed into one — they are the same relationship entered
 * from different corners.
 */
export function solveDuct(
  known: { cfm?: number; diameterIn?: number; velocityFpm?: number; frictionPer100ft?: number },
  runLengthFt = 100,
): DuctSolution | null {
  let { cfm, diameterIn, velocityFpm: vel, frictionPer100ft: fric } = known

  if (cfm && diameterIn) {
    // nothing to solve
  } else if (cfm && vel) {
    diameterIn = diameterForVelocityIn(cfm, vel)
  } else if (cfm && fric) {
    diameterIn = diameterForFrictionIn(cfm, fric)
  } else if (diameterIn && vel) {
    cfm = cfmFromVelocity(vel, roundDuctAreaFt2(diameterIn))
  } else if (diameterIn && fric) {
    cfm = cfmForFriction(diameterIn, fric)
  } else if (vel && fric) {
    // Two unknowns coupled through d: substitute Q = V·A(d) into the friction
    // equation and solve for d. Δp = 0.109136 (V π d²/576)^1.9 / d^5.02, which
    // reduces to a single power of d — no iteration needed.
    const k = 0.109136 * Math.pow((vel * Math.PI) / 576, 1.9)
    diameterIn = Math.pow(k / fric, 1 / (5.02 - 3.8))
    cfm = cfmFromVelocity(vel, roundDuctAreaFt2(diameterIn))
  } else {
    return null
  }

  if (!cfm || !diameterIn || diameterIn <= 0) return null
  const area = roundDuctAreaFt2(diameterIn)
  const velocity = velocityFpm(cfm, area)
  const friction = frictionLossPer100ft(cfm, diameterIn)
  return {
    cfm,
    diameterIn,
    velocityFpm: velocity,
    frictionPer100ft: friction,
    totalLoss: (friction * runLengthFt) / 100,
  }
}

// ─── Wheel rotation ──────────────────────────────────────────────────────────

/** Seconds for one full wheel revolution, from rotations per hour. */
export function secondsPerRevolution(rph: number): number {
  return rph > 0 ? 3600 / rph : 0
}

/** Rotations per hour, from seconds per revolution. */
export function rphFromSeconds(secondsPerRev: number): number {
  return secondsPerRev > 0 ? 3600 / secondsPerRev : 0
}

/**
 * How long any point on the wheel spends in a sector, seconds.
 *
 * This is the number that actually matters physically: dwell in the process sector
 * is the adsorption time, dwell in reactivation is the drying time. It is why RPH
 * has an optimum rather than "faster is better" — too fast and the desiccant never
 * saturates or never fully regenerates; too slow and it saturates and rides through.
 */
export function sectorDwellSeconds(rph: number, sectorDegrees: number): number {
  if (rph <= 0 || sectorDegrees <= 0) return 0
  return secondsPerRevolution(rph) * (sectorDegrees / 360)
}

// ─── Coil widths ─────────────────────────────────────────────────────────────

/**
 * Coil casing width by row count, inches — DryWare's Coil Widths-CV lookup.
 * A physical packaging dimension, not a calculation.
 */
export const COIL_WIDTHS_IN: { rows: number; widthIn: number }[] = [
  { rows: 1, widthIn: 5 },
  { rows: 2, widthIn: 6.5 },
  { rows: 3, widthIn: 6.5 },
  { rows: 4, widthIn: 7.5 },
  { rows: 5, widthIn: 7.5 },
  { rows: 6, widthIn: 10 },
  { rows: 8, widthIn: 12 },
  { rows: 10, widthIn: 15 },
  { rows: 12, widthIn: 18 },
]

/** Casing width for a row count, or null when the row count isn't offered. */
export function coilWidthForRows(rows: number): number | null {
  return COIL_WIDTHS_IN.find((c) => c.rows === rows)?.widthIn ?? null
}

// ─── Bypass ──────────────────────────────────────────────────────────────────

export type BypassResult = {
  /** Fraction of total airflow routed AROUND the wheel, 0–1. */
  bypassFraction: number
  bypassCfm: number
  throughWheelCfm: number
  /** True when the target is unreachable by bypassing (needs a drier wheel outlet). */
  unreachable: boolean
}

/**
 * How much air to route around the wheel to land on a target moisture content.
 *
 * A desiccant wheel dries far below most targets, so running the whole airstream
 * through it over-dries (and wastes reactivation heat). Bypassing part of it and
 * remixing hits the target with a smaller wheel and less energy.
 *
 * Straight lever-rule mix on humidity ratio: the target must sit between the wheel
 * outlet and the untreated inlet, or no bypass fraction exists.
 */
export function bypassCfm(
  totalCfm: number,
  inletGrains: number,
  wheelOutletGrains: number,
  targetGrains: number,
): BypassResult {
  const span = inletGrains - wheelOutletGrains
  if (totalCfm <= 0 || span <= 0) {
    return { bypassFraction: 0, bypassCfm: 0, throughWheelCfm: totalCfm, unreachable: true }
  }
  const raw = (targetGrains - wheelOutletGrains) / span
  const unreachable = raw < 0 || raw > 1
  const f = Math.min(Math.max(raw, 0), 1)
  return {
    bypassFraction: f,
    bypassCfm: totalCfm * f,
    throughWheelCfm: totalCfm * (1 - f),
    unreachable,
  }
}

// ─── Energy ──────────────────────────────────────────────────────────────────

const BTU_PER_KWH = 3412.14

export function btuhToKw(btuh: number): number {
  return btuh / BTU_PER_KWH
}

export function kwToBtuh(kw: number): number {
  return kw * BTU_PER_KWH
}

/** Sensible heating/cooling duty for an airstream, BTU/hr. The 1.08 shop constant. */
export function sensibleBtuh(cfm: number, deltaTempF: number): number {
  return 1.08 * cfm * deltaTempF
}
