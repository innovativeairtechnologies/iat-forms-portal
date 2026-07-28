/* Psychrometrics — ASHRAE Fundamentals (2017), Chapter 1, in IP units.
 *
 * This is the moist-air physics layer behind the Sizing Studio (/admin/sizing-studio).
 * It is deliberately dependency-free and side-effect-free: every export is a pure
 * function over numbers, so the whole file is unit-testable in isolation and safe to
 * import from both server and client components.
 *
 * Conventions used throughout (IP, because that is how the shop, the submittals and
 * the DryWare calculator all speak):
 *   t   — dry-bulb temperature, °F
 *   W   — humidity ratio, lb water / lb dry air
 *   gr  — grains of moisture per lb dry air (W × 7000). The number reps quote.
 *   p   — absolute (barometric) pressure, psia
 *   h   — enthalpy, BTU / lb dry air
 *   v   — specific volume, ft³ / lb dry air
 *   rh  — relative humidity as a FRACTION (0–1), never a percent
 *
 * Desiccant dehumidification lives at the dry end of the chart, so correctness below
 * freezing matters: the saturation-pressure correlation switches to the over-ice
 * branch under 32 °F, and dew points well below 0 °F are normal for our units.
 */

/** Grains of moisture per pound of water. The chart's native unit. */
export const GRAINS_PER_LB = 7000

/** Ratio of molecular masses, water vapour : dry air (ASHRAE eq. 20). */
const MW_RATIO = 0.621945

/** Sea-level standard atmospheric pressure, psia. */
export const STD_PRESSURE_PSIA = 14.696

/** °F → °R (absolute). */
function toRankine(tF: number): number {
  return tF + 459.67
}

/**
 * Standard barometric pressure at altitude (ASHRAE eq. 3), psia.
 * `altitudeFt` is site elevation above sea level. Altitude matters more than people
 * expect: at 5,000 ft the air is ~17% less dense, so the same CFM carries ~17% less
 * moisture, and a unit sized at sea level is oversized (or a grain target unreachable).
 */
export function pressureAtAltitude(altitudeFt: number): number {
  return STD_PRESSURE_PSIA * Math.pow(1 - 6.8754e-6 * altitudeFt, 5.2559)
}

/**
 * Saturation vapour pressure over water (t ≥ 32 °F) or ice (t < 32 °F), psia.
 * ASHRAE Fundamentals 2017, eq. 5 (ice) and eq. 6 (water). Valid −148…392 °F.
 */
export function satVaporPressure(tF: number): number {
  const T = toRankine(tF)
  const lnT = Math.log(T)
  let lnP: number

  if (tF < 32) {
    // Over ice.
    lnP =
      -1.0214165e4 / T +
      -4.8932428 +
      -5.3765794e-3 * T +
      1.9202377e-7 * T * T +
      3.5575832e-10 * T * T * T +
      -9.0344688e-14 * T * T * T * T +
      4.1635019 * lnT
  } else {
    // Over liquid water.
    lnP =
      -1.0440397e4 / T +
      -1.1294650e1 +
      -2.7022355e-2 * T +
      1.2890360e-5 * T * T +
      -2.4780681e-9 * T * T * T +
      6.5459673 * lnT
  }
  return Math.exp(lnP)
}

/** Humidity ratio from vapour pressure and barometric pressure (ASHRAE eq. 20). */
export function humidityRatioFromVaporPressure(pw: number, p: number): number {
  // Guard the asymptote: pw can never reach p physically, but a bad input shouldn't
  // return Infinity and poison every downstream number.
  const safePw = Math.min(pw, p * 0.999999)
  return (MW_RATIO * safePw) / (p - safePw)
}

/** Vapour pressure from humidity ratio (inverse of the above). */
export function vaporPressureFromHumidityRatio(W: number, p: number): number {
  return (p * W) / (MW_RATIO + W)
}

/** Saturation humidity ratio at a given dry-bulb temperature. */
export function satHumidityRatio(tF: number, p: number): number {
  return humidityRatioFromVaporPressure(satVaporPressure(tF), p)
}

/** Humidity ratio from dry-bulb + relative humidity (rh as a 0–1 fraction). */
export function humidityRatioFromRH(tF: number, rh: number, p: number): number {
  const pw = clamp(rh, 0, 1) * satVaporPressure(tF)
  return humidityRatioFromVaporPressure(pw, p)
}

/** Relative humidity (0–1 fraction) from dry-bulb + humidity ratio. */
export function rhFromHumidityRatio(tF: number, W: number, p: number): number {
  const pw = vaporPressureFromHumidityRatio(Math.max(W, 0), p)
  return clamp(pw / satVaporPressure(tF), 0, 1)
}

/**
 * Dew-point temperature, °F, from humidity ratio.
 *
 * Solved by bisection on satVaporPressure rather than ASHRAE's fitted inverse
 * polynomial: the fit is published in two ranges with a seam at 32 °F, and desiccant
 * work sits right on that seam. Bisection is monotone, branch-safe, and converges to
 * well under 0.01 °F in ~40 iterations — cheap enough to be irrelevant here.
 */
export function dewPoint(W: number, p: number): number {
  if (W <= 0) return DEWPOINT_FLOOR_F
  const pw = vaporPressureFromHumidityRatio(W, p)
  if (pw <= satVaporPressure(DEWPOINT_FLOOR_F)) return DEWPOINT_FLOOR_F

  let lo = DEWPOINT_FLOOR_F
  let hi = DEWPOINT_CEILING_F
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (satVaporPressure(mid) < pw) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Practical bounds for the dew-point solver (well outside any real IAT process). */
const DEWPOINT_FLOOR_F = -148
const DEWPOINT_CEILING_F = 392

/** Moist-air enthalpy, BTU / lb dry air (ASHRAE eq. 32). */
export function enthalpy(tF: number, W: number): number {
  return 0.24 * tF + W * (1061 + 0.444 * tF)
}

/** Specific volume, ft³ / lb dry air (ASHRAE eq. 26). */
export function specificVolume(tF: number, W: number, p: number): number {
  return (0.370486 * toRankine(tF) * (1 + 1.607858 * W)) / p
}

/** Air density on a moist-air basis, lb of moist air / ft³. */
export function density(tF: number, W: number, p: number): number {
  return (1 + W) / specificVolume(tF, W, p)
}

/**
 * Thermodynamic wet-bulb temperature, °F (ASHRAE eq. 33/35, solved by bisection).
 * Not used by the core sizing math, but reps read wet-bulb off job specs constantly,
 * so the Studio accepts and displays it.
 */
export function wetBulb(tF: number, W: number, p: number): number {
  const dp = dewPoint(W, p)
  if (dp >= tF) return tF // saturated

  let lo = dp
  let hi = tF
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (humidityRatioFromWetBulb(tF, mid, p) < W) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Humidity ratio implied by a dry-bulb / wet-bulb pair (ASHRAE eq. 33 & 35). */
export function humidityRatioFromWetBulb(tDb: number, tWb: number, p: number): number {
  const Wsstar = satHumidityRatio(tWb, p)
  if (tWb >= 32) {
    return (
      ((1093 - 0.556 * tWb) * Wsstar - 0.24 * (tDb - tWb)) /
      (1093 + 0.444 * tDb - tWb)
    )
  }
  // Over ice.
  return (
    ((1220 - 0.04 * tWb) * Wsstar - 0.24 * (tDb - tWb)) /
    (1220 + 0.444 * tDb - 0.48 * tWb)
  )
}

// ─── The moist-air state object the Sizing Studio passes around ──────────────

/** A fully-resolved moist-air state. Every field is derived, never user-entered. */
export type AirState = {
  /** Dry-bulb temperature, °F. */
  tempF: number
  /** Humidity ratio, lb/lb. */
  W: number
  /** Grains of moisture per lb dry air — the number reps actually quote. */
  grains: number
  /** Relative humidity as a PERCENT (0–100), for display. */
  rh: number
  /** Dew point, °F. */
  dewPointF: number
  /** Wet bulb, °F. */
  wetBulbF: number
  /** Enthalpy, BTU/lb dry air. */
  enthalpy: number
  /** Specific volume, ft³/lb dry air. */
  specificVolume: number
  /** Barometric pressure this state was resolved at, psia. */
  pressure: number
}

/** Resolve a complete AirState from dry-bulb + humidity ratio. */
export function airStateFromW(tempF: number, W: number, p: number): AirState {
  const safeW = Math.max(W, 0)
  return {
    tempF,
    W: safeW,
    grains: safeW * GRAINS_PER_LB,
    rh: rhFromHumidityRatio(tempF, safeW, p) * 100,
    dewPointF: dewPoint(safeW, p),
    wetBulbF: wetBulb(tempF, safeW, p),
    enthalpy: enthalpy(tempF, safeW),
    specificVolume: specificVolume(tempF, safeW, p),
    pressure: p,
  }
}

/** Resolve a complete AirState from dry-bulb + relative humidity (percent, 0–100). */
export function airStateFromRH(tempF: number, rhPercent: number, p: number): AirState {
  return airStateFromW(tempF, humidityRatioFromRH(tempF, rhPercent / 100, p), p)
}

/** Resolve a complete AirState from dry-bulb + dew point (°F). */
export function airStateFromDewPoint(tempF: number, dewPointF: number, p: number): AirState {
  // Dew point can't exceed dry-bulb; clamp so a typo yields saturated air, not NaN.
  const dp = Math.min(dewPointF, tempF)
  return airStateFromW(tempF, humidityRatioFromVaporPressure(satVaporPressure(dp), p), p)
}

/** Resolve a complete AirState from dry-bulb + grains per lb. */
export function airStateFromGrains(tempF: number, grains: number, p: number): AirState {
  return airStateFromW(tempF, grains / GRAINS_PER_LB, p)
}

// ─── Airflow ⇄ mass-flow conversions ─────────────────────────────────────────

/**
 * Dry-air mass flow, lb dry air / hr, for a volumetric airflow at a given state.
 *
 * The familiar shop shortcut is `lb/hr = 4.5 × CFM × ΔW` — which bakes in sea-level
 * standard density (0.075 lb/ft³ × 60 min/hr = 4.5). We compute the real specific
 * volume instead, because altitude and high process temperatures both move it enough
 * to matter on a submittal.
 */
export function massFlowFromCFM(cfm: number, state: AirState): number {
  return (cfm * 60) / state.specificVolume
}

/**
 * Moisture removal duty between two states at a given airflow.
 * Returns both lb/hr (what engineering sizes on) and grains/hr.
 */
export function moistureRemoval(
  cfm: number,
  from: AirState,
  to: AirState,
): { lbPerHour: number; grainsPerHour: number; deltaGrains: number } {
  const massFlow = massFlowFromCFM(cfm, from)
  const deltaW = from.W - to.W
  return {
    lbPerHour: massFlow * deltaW,
    grainsPerHour: massFlow * deltaW * GRAINS_PER_LB,
    deltaGrains: from.grains - to.grains,
  }
}

/**
 * Adiabatic mixing of two airstreams (return + outside air), by mass.
 * Used to resolve the true entering condition when a job pulls in fresh air —
 * the single most common reason a "room condition" sizing comes out undersized.
 */
export function mixStreams(
  a: AirState,
  aCfm: number,
  b: AirState,
  bCfm: number,
  p: number,
): AirState {
  const ma = massFlowFromCFM(aCfm, a)
  const mb = massFlowFromCFM(bCfm, b)
  const total = ma + mb
  if (total <= 0) return a

  const W = (ma * a.W + mb * b.W) / total
  const h = (ma * a.enthalpy + mb * b.enthalpy) / total
  // Invert the enthalpy relation for dry-bulb at the mixed humidity ratio.
  const tempF = (h - 1061 * W) / (0.24 + 0.444 * W)
  return airStateFromW(tempF, W, p)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}
