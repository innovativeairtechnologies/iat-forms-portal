/* Psychrometric relations for the teaching chart.
 *
 * ⚠️ Teaching approximations, deliberately. Saturation pressure uses the
 * Magnus-Tetens form rather than ASHRAE's full formulation, and the humidity
 * ratio assumes a fixed 1013.25 hPa atmosphere — so this is not fit for design
 * or selection work. The Sizing Studio (`/admin/sizing-studio`) is the tool
 * that does real psychrometrics; the chart built on this one says as much on
 * its face.
 *
 * Ported from the source course unchanged so the chart plots the same curves
 * the learner would have seen there.
 */

const P_ATM_HPA = 1013.25

/** Saturation vapour pressure (hPa) over water at a Celsius temperature. */
export function satPressHPa(tC: number): number {
  return 6.1094 * Math.exp((17.625 * tC) / (tC + 243.04))
}

/** Humidity ratio (lb water / lb dry air) from vapour pressure in hPa. */
export function humidityRatioFromPwHpa(pwHpa: number): number {
  return (0.622 * pwHpa) / (P_ATM_HPA - pwHpa)
}

/** Dew point (°C) from vapour pressure in hPa. */
export function dewPointC(pwHpa: number): number {
  const lnr = Math.log(pwHpa / 6.1094)
  return (243.04 * lnr) / (17.625 - lnr)
}

export const fToC = (f: number): number => ((f - 32) * 5) / 9
export const cToF = (c: number): number => (c * 9) / 5 + 32

export type PsychrometricPoint = {
  /** lb water per lb dry air. */
  humidityRatio: number
  /** Grains of water per lb dry air — the number a technician actually reads. */
  grainsPerLb: number
  dewPointF: number
}

export function psychrometrics(dryBulbF: number, rhPct: number): PsychrometricPoint {
  const pws = satPressHPa(fToC(dryBulbF))
  const pw = pws * (rhPct / 100)
  const w = humidityRatioFromPwHpa(pw)
  return {
    humidityRatio: w,
    // 7000 grains to the pound. The source labelled `w * 1000` as "gr/lb",
    // which is off by a factor of 7 — corrected here rather than ported.
    grainsPerLb: w * 7000,
    dewPointF: cToF(dewPointC(pw)),
  }
}
