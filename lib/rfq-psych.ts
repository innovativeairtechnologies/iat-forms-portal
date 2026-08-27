// ─── Psychrometrics for the RFQ moisture survey ───────────────────────────────
//
// Everything the RFQ wizard shows live — grains, dew point, vapor pressure, air
// density — comes from here. Formulas are ASHRAE Fundamentals (Ch. 1, "Moist
// air properties"); the moisture-load equations that consume them are Chapter 5
// of the Dehumidification Handbook, matching IAT's own moisture-load workbook.
//
// Checked against the handbook's published points at sea level:
//   70°F/30%rh → 32.5 (book: 32) · 70°F/20%rh → 21.6 (book: 22)
//   75°F/40%rh → 51.6 (book: 52) · 80°F/50%rh → 76.5 (book: 77)
// The book's own Figure 5.1 reads 70°F/50%rh as "56 gr/lb"; the exact ASHRAE
// value is 54.5, and its facing figure gives 1.8 gr/lb where the text says 2.1 —
// those are chart reads, so we keep the equations rather than the printed digits.
//
// A "grain" is 1/7000 lb of water vapor. The whole trade talks in gr/lb of dry
// air, because relative humidity alone is meaningless for load work — 30%rh is a
// different amount of water at 50°F than at 90°F.

export const GRAINS_PER_LB = 7000

/** Standard barometric pressure (psia) at an elevation in ft above sea level. */
export function pressureAtElevation(elevationFt: number): number {
  const z = Number.isFinite(elevationFt) ? elevationFt : 0
  return 14.696 * Math.pow(1 - 6.8754e-6 * z, 5.2559)
}

/**
 * Saturation vapor pressure over liquid water (psia) at a dry-bulb temp in °F.
 * ASHRAE Fundamentals eq. 6 (over water, 32–392°F). Below freezing we fall back
 * to eq. 5 (over ice) so cold-storage rooms don't read high.
 */
export function satVaporPressure(tempF: number): number {
  const T = tempF + 459.67 // °R
  if (T <= 0) return 0
  let lnP: number
  if (tempF < 32) {
    lnP =
      -1.0214165e4 / T -
      4.8932428 -
      5.3765794e-3 * T +
      1.9202377e-7 * T * T +
      3.5575832e-10 * T * T * T -
      9.0344688e-14 * T * T * T * T +
      4.1635019 * Math.log(T)
  } else {
    lnP =
      -1.0440397e4 / T -
      1.129465e1 -
      2.7022355e-2 * T +
      1.289036e-5 * T * T -
      2.4780681e-9 * T * T * T +
      6.5459673 * Math.log(T)
  }
  return Math.exp(lnP)
}

/** Humidity ratio (lb water / lb dry air) from dry bulb °F, RH %, elevation ft. */
export function humidityRatio(tempF: number, rhPct: number, elevationFt = 0): number {
  const p = pressureAtElevation(elevationFt)
  const pw = Math.min((clampRh(rhPct) / 100) * satVaporPressure(tempF), p * 0.999)
  if (pw <= 0) return 0
  return (0.621945 * pw) / (p - pw)
}

/** Grains of water per lb of dry air — the working unit for every load equation. */
export function grains(tempF: number, rhPct: number, elevationFt = 0): number {
  return humidityRatio(tempF, rhPct, elevationFt) * GRAINS_PER_LB
}

/** Partial water-vapor pressure (inHg) — the driving force for permeation. */
export function vaporPressureInHg(tempF: number, rhPct: number): number {
  return (clampRh(rhPct) / 100) * satVaporPressure(tempF) * 2.036021
}

/** inHg partial pressure implied by a humidity ratio — used when only gr/lb is known. */
export function vaporPressureFromGrains(grainsPerLb: number, elevationFt = 0): number {
  const w = Math.max(grainsPerLb, 0) / GRAINS_PER_LB
  const p = pressureAtElevation(elevationFt)
  return ((w * p) / (0.621945 + w)) * 2.036021
}

/** Relative humidity (%) implied by a dry bulb and a grain level. */
export function rhFromGrains(tempF: number, grainsPerLb: number, elevationFt = 0): number {
  const pws = satVaporPressure(tempF)
  if (pws <= 0) return 0
  const w = Math.max(grainsPerLb, 0) / GRAINS_PER_LB
  const p = pressureAtElevation(elevationFt)
  const pw = (w * p) / (0.621945 + w)
  return clampRh((pw / pws) * 100)
}

/**
 * Dew point °F — the temperature at which this air's vapour pressure would be
 * saturation pressure. Solved by bisecting satVaporPressure rather than with
 * ASHRAE's eq. 39/40 curve fit.
 *
 * The fit is faster but it is a DIFFERENT function from satVaporPressure, so
 * rh → dew point → rh did not round-trip across the ice/water crossover (0°F at
 * 70%rh came back as 70.25%). With the unit selector letting a customer type a
 * dew point directly — and with freezer and cold-storage presets sitting right
 * on that crossover — the two directions have to be exact inverses of each
 * other. 60 halvings over a fixed bracket cannot stall and is far past display
 * precision.
 */
export function dewPointF(tempF: number, rhPct: number, elevationFt = 0): number {
  const w = humidityRatio(tempF, rhPct, elevationFt)
  if (w <= 0) return -100
  const p = pressureAtElevation(elevationFt)
  const pw = (w * p) / (0.621945 + w)
  let lo = -150 // below any dew point this equipment will ever see
  let hi = tempF // dew point can never exceed dry bulb
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (satVaporPressure(mid) < pw) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Relative humidity (%) implied by a dew point at a given dry bulb. */
export function rhFromDewPoint(tempF: number, dewPtF: number): number {
  const pws = satVaporPressure(tempF)
  if (pws <= 0) return 0
  // A dew point above the dry bulb is not physical; saturation is the ceiling.
  return clampRh((satVaporPressure(Math.min(dewPtF, tempF)) / pws) * 100)
}

/**
 * Humidity ratio (lb/lb) from a dry-bulb / wet-bulb pair. ASHRAE Fundamentals
 * eq. 33 above freezing, eq. 35 below — the wet-bulb depression is a heat
 * balance, so the two regimes use different latent constants.
 */
export function humidityRatioFromWetBulb(tempF: number, wetBulbF: number, elevationFt = 0): number {
  const p = pressureAtElevation(elevationFt)
  const twb = Math.min(wetBulbF, tempF) // wet bulb can never exceed dry bulb
  const pwsWb = satVaporPressure(twb)
  if (pwsWb >= p) return 0
  const wsWb = (0.621945 * pwsWb) / (p - pwsWb)
  const w = twb >= 32
    ? ((1093 - 0.556 * twb) * wsWb - 0.24 * (tempF - twb)) / (1093 + 0.444 * tempF - twb)
    : ((1220 - 0.04 * twb) * wsWb - 0.24 * (tempF - twb)) / (1220 + 0.444 * tempF - 0.48 * twb)
  return Math.max(w, 0)
}

/** Relative humidity (%) implied by a dry-bulb / wet-bulb pair. */
export function rhFromWetBulb(tempF: number, wetBulbF: number, elevationFt = 0): number {
  return rhFromGrains(tempF, humidityRatioFromWetBulb(tempF, wetBulbF, elevationFt) * GRAINS_PER_LB, elevationFt)
}

/**
 * Wet-bulb temperature (°F) for a condition. There is no closed form for this
 * direction, so bisect: humidity ratio rises monotonically with wet bulb between
 * the dew point (saturation) and the dry bulb, which makes the search safe and
 * quick. 50 halvings on that interval is far past display precision and cannot
 * loop — no convergence test to get wrong.
 */
export function wetBulbF(tempF: number, rhPct: number, elevationFt = 0): number {
  const target = humidityRatio(tempF, rhPct, elevationFt)
  if (target <= 0) return tempF
  let lo = dewPointF(tempF, rhPct, elevationFt)
  let hi = tempF
  if (lo > hi) return tempF
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (humidityRatioFromWetBulb(tempF, mid, elevationFt) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Density of the moist air (lb/cu.ft) at a condition — the `d` term in every
 * infiltration equation. Chapter 5 uses one figure per project (0.075 near sea
 * level, 0.070 at Chicago's 658 ft in the worked example); computing it from the
 * actual condition is the same idea, just not rounded by hand.
 */
/**
 * Mass of DRY AIR per cubic foot (lb da / cu.ft) — the 1/v term.
 *
 * 🔴 THIS IS THE ONE TO USE WITH GRAINS. Grains are measured per pound of DRY air,
 * so converting a volume flow into the mass that carries them needs 1/v, not the
 * density of the moist mixture. Using airDensity() below overstates by exactly
 * (1 + W) — 0.7% in a typical room, 2% at an outdoor design condition.
 *
 * Chapter 5's 0.075 lb/cu.ft near sea level is this value: 1/v_dry(70°F) = 0.0749.
 */
export function dryAirDensity(tempF: number, rhPct: number, elevationFt = 0): number {
  const p = pressureAtElevation(elevationFt)
  const T = tempF + 459.67
  const w = humidityRatio(tempF, rhPct, elevationFt)
  const v = (0.370486 * T * (1 + 1.607858 * w)) / p
  return v > 0 ? 1 / v : 0.0749
}

/**
 * ⚠️ MOIST-air density, and NOT what a grain calculation wants — see dryAirDensity.
 * Kept because it is the honest answer to "how heavy is this air", which is a
 * different question from "how much dry air is in it".
 */
export function airDensity(tempF: number, rhPct: number, elevationFt = 0): number {
  const p = pressureAtElevation(elevationFt)
  const T = tempF + 459.67
  const w = humidityRatio(tempF, rhPct, elevationFt)
  // Specific volume of the mixture per lb of DRY air (ft³/lb da)
  const v = (0.370486 * T * (1 + 1.607858 * w)) / p
  return v > 0 ? (1 + w) / v : 0.075
}

function clampRh(rh: number): number {
  if (!Number.isFinite(rh)) return 0
  return Math.min(Math.max(rh, 0), 100)
}
