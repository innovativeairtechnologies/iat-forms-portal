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
 * Dew point °F from dry bulb + RH. ASHRAE Fundamentals eq. 39/40 — an explicit
 * fit in ln(pw), so no iteration and no chance of a solver stalling in the UI.
 */
export function dewPointF(tempF: number, rhPct: number, elevationFt = 0): number {
  const p = pressureAtElevation(elevationFt)
  const w = humidityRatio(tempF, rhPct, elevationFt)
  if (w <= 0) return -100
  const pw = (w * p) / (0.621945 + w)
  const a = Math.log(pw)
  const dp =
    pw >= 0.08865 // ≈ the 32°F crossover in psia
      ? 100.45 + 33.193 * a + 2.319 * a * a + 0.17074 * a * a * a + 1.2063 * Math.pow(pw, 0.1984)
      : 90.12 + 26.142 * a + 0.8927 * a * a
  return Math.min(dp, tempF)
}

/**
 * Density of the moist air (lb/cu.ft) at a condition — the `d` term in every
 * infiltration equation. Chapter 5 uses one figure per project (0.075 near sea
 * level, 0.070 at Chicago's 658 ft in the worked example); computing it from the
 * actual condition is the same idea, just not rounded by hand.
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
