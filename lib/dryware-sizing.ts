// ─────────────────────────────────────────────────────────────────────────────
// lib/dryware-sizing.ts — client for the two Dryware endpoints the Sizing Studio
// needs: the product catalog (unit + rotor geometry) and the ASHRAE weather
// station data. Both are first-party IAT systems at dryware.dehumidifiers.com.
//
// Read-only. Server-side only — never import this into a client component.
//
// ⚠️ These two endpoints currently answer WITHOUT authentication (verified from a
// browser carrying no session). We still send DRYWARE_AUTH_HEADER when it is
// configured, so nothing breaks if Dryware locks them down later. Unlike
// lib/dryware.ts (the projected-sales reporting feed) a missing credential is
// therefore NOT fatal here.
//
// Related: lib/dryware.ts (projected sales), lib/sizing-catalog.ts (the baked-in
// fallback catalog these values replace).
// ─────────────────────────────────────────────────────────────────────────────

import { CATALOG_SIZES, type CatalogSize } from './sizing-catalog'

const BASE = 'https://dryware.dehumidifiers.com'
const TIMEOUT_MS = 30_000

/** Dryware product-type ids. 4 = complete IAT units, 19 = bare desiccant rotors. */
export const PRODUCT_TYPE_UNIT = 4
export const PRODUCT_TYPE_ROTOR = 19

/** The wheel geometry Dryware hangs off every dehumidifier product. */
type DehumidifierNav = {
  diameter: number | null
  depth: number | null
  effectiveArea: number | null
  optimizeRph: boolean | null
  rph: number | null
}

/** A product row as returned by Dryware (trimmed to what sizing needs). */
type DrywareProduct = {
  id: number
  productTypeId: number
  productDescription: string | null
  /** Nominal CFM on a unit; null on a bare rotor. */
  numericQualifier?: number | null
  active: boolean | null
  dehumidifierProductIdNavigation?: DehumidifierNav | null
}

/** A unit or rotor, normalised for the Sizing Studio. */
export type DrywareUnitSpec = {
  drywareId: number
  model: string
  /** Nominal airflow, CFM. Null on a bare rotor (they are sized by geometry). */
  nominalCfm: number | null
  wheelDiameterMm: number
  wheelDepthMm: number
  effectiveAreaFt2: number
  optimizeRph: boolean
  active: boolean
}

async function getJson(path: string): Promise<unknown> {
  const auth = process.env.DRYWARE_AUTH_HEADER
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
      // Dryware's SPA serves an HTML shell for unknown /api paths, so a wrong
      // path returns 200 HTML rather than 404 — the JSON check below catches it.
      redirect: 'manual',
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Dryware did not respond within ${TIMEOUT_MS / 1000}s.`)
    }
    throw new Error(`Could not reach Dryware: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new Error(`Dryware returned HTTP ${res.status} for ${path}.`)

  const text = await res.text()
  // Guard the SPA-shell case explicitly: an unknown /api route answers 200 with
  // the Angular index.html, which would otherwise surface as a confusing JSON
  // parse error rather than "that endpoint does not exist".
  if (text.trimStart().startsWith('<')) {
    throw new Error(`Dryware returned HTML for ${path} — the endpoint does not exist.`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Dryware returned a non-JSON body for ${path}.`)
  }
}

function normalise(p: DrywareProduct): DrywareUnitSpec | null {
  const nav = p.dehumidifierProductIdNavigation
  const model = (p.productDescription ?? '').trim()
  if (!model || !nav) return null
  const dia = Number(nav.diameter ?? 0)
  const depth = Number(nav.depth ?? 0)
  const area = Number(nav.effectiveArea ?? 0)
  // A row with no geometry cannot drive a face-velocity calculation, so it is
  // dropped rather than defaulted — a zero area would divide by zero downstream.
  if (!(dia > 0 && depth > 0 && area > 0)) return null
  return {
    drywareId: p.id,
    model,
    nominalCfm: typeof p.numericQualifier === 'number' ? p.numericQualifier : null,
    wheelDiameterMm: dia,
    wheelDepthMm: depth,
    effectiveAreaFt2: area,
    optimizeRph: nav.optimizeRph === true,
    active: p.active !== false,
  }
}

/** Every product of a type, normalised. Inactive rows are kept — the caller filters. */
export async function fetchProducts(productTypeId: number): Promise<DrywareUnitSpec[]> {
  const raw = await getJson(
    `/api/Product/getProductsForProductType?id=${productTypeId}&isForQuote=false`,
  )
  if (!Array.isArray(raw)) throw new Error('Dryware product response was not an array.')
  return (raw as DrywareProduct[]).map(normalise).filter((x): x is DrywareUnitSpec => x !== null)
}

/** The complete IAT units (product type 4), active only, ascending by nominal CFM. */
export async function fetchUnitCatalog(): Promise<DrywareUnitSpec[]> {
  const all = await fetchProducts(PRODUCT_TYPE_UNIT)
  return all
    .filter((u) => u.active && typeof u.nominalCfm === 'number' && u.nominalCfm > 0)
    .sort((a, b) => (a.nominalCfm ?? 0) - (b.nominalCfm ?? 0))
}

// ─── The live catalog, with a fail-safe fallback ─────────────────────────────

/**
 * The catalog the Sizing Studio should size against: Dryware's live product data,
 * falling back to the baked-in `CATALOG_SIZES` if Dryware is unreachable.
 *
 * Deliberately NOT a database mirror. These endpoints need no credential and the
 * baked-in catalog is a complete, current copy, so a sync table would add a
 * migration, a cron slot and a staleness question to buy nothing. The fallback is
 * the same fail-safe shape as getPermMatrix()/getSrvSections(): a Dryware outage
 * degrades to the last-known-good catalog rather than breaking the page.
 *
 * `source` is returned so the UI can say which one it used — a silent fallback to
 * stale data is exactly the failure mode this codebase keeps getting bitten by.
 */
export async function getSizingCatalog(): Promise<{
  sizes: CatalogSize[]
  source: 'dryware' | 'fallback'
  error?: string
}> {
  try {
    const units = await fetchUnitCatalog()
    const sizes = toCatalogSizes(units)
    // A suspiciously short catalog means the shape changed upstream; prefer the
    // known-good baked-in copy over silently sizing against two products.
    if (sizes.length < 8) {
      return {
        sizes: CATALOG_SIZES,
        source: 'fallback',
        error: `Dryware returned only ${sizes.length} usable units — using the built-in catalog.`,
      }
    }
    return { sizes, source: 'dryware' }
  } catch (e) {
    return {
      sizes: CATALOG_SIZES,
      source: 'fallback',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Map Dryware units onto the Studio's CatalogSize shape.
 *
 * Series is derived from the model number rather than stored: `REC` is the Compact
 * designation (Rotor / Electric / Compact) per the nomenclature sheet. Dryware ships
 * 600 twice (IAT-600 and IAT-600REC) with identical geometry, so rows are collapsed
 * by nominal CFM — the Studio selects on airflow, not on SKU.
 */
export function toCatalogSizes(units: DrywareUnitSpec[]): CatalogSize[] {
  const byCfm = new Map<number, CatalogSize>()
  for (const u of units) {
    const cfm = u.nominalCfm
    if (typeof cfm !== 'number' || cfm <= 0) continue
    const isCompact = /REC\b/i.test(u.model)
    const existing = byCfm.get(cfm)
    if (existing) {
      // Same airflow, two SKUs — union the series and keep the non-REC model name.
      if (isCompact && !existing.series.includes('compact')) existing.series.push('compact')
      if (!isCompact) existing.model = u.model
      if (!isCompact && !existing.series.includes('rotor')) existing.series.push('rotor')
      continue
    }
    byCfm.set(cfm, {
      model: u.model,
      nominalCfm: cfm,
      wheelDiameterMm: u.wheelDiameterMm,
      wheelDepthMm: u.wheelDepthMm,
      effectiveAreaFt2: u.effectiveAreaFt2,
      series: isCompact ? ['compact', 'idp'] : ['rotor', 'idp'],
    })
  }
  return [...byCfm.values()].sort((a, b) => a.nominalCfm - b.nominalCfm)
}

// ─── ASHRAE weather stations ─────────────────────────────────────────────────

/**
 * A weather station's ASHRAE design conditions, as Dryware returns them.
 *
 * The percentages are ASHRAE annual exceedance frequencies: a 0.4% dehumidification
 * dew point is exceeded ~35 hours a year, 1% ~88 hours, 2% ~175 hours. Sizing a
 * dehumidifier normally uses the DEHUMIDIFICATION columns, not the cooling ones —
 * cooling design conditions are chosen for peak sensible load, which is a different
 * hour of the year than peak moisture.
 */
export type WeatherStation = {
  id: number
  country: string | null
  provinceOrState: string | null
  stationName: string | null
  latitude: number | null
  longitude: number | null
  /** Station elevation, ft — feeds the Studio's altitude input directly. */
  elevation: number | null

  /** 99.6% heating design dry bulb, °F. */
  heatingDb996: number | null

  /** Dehumidification design conditions — dew point °F, humidity ratio gr/lb, mean coincident dry bulb °F. */
  dehumidification1pctDp: number | null
  dehumidification1pctHr: number | null
  dehumidification1pctMcdb: number | null
  dehumidification2pctDp: number | null
  dehumidification2pctHr: number | null
  dehumidification2pctMcdb: number | null
  dehumidification4pctDp: number | null
  dehumidification4pctHr: number | null
  dehumidification4pctMcdb: number | null

  /** Cooling design dry bulb + mean coincident wet bulb, °F. */
  cooling1pctDb: number | null
  cooling1pctMcwb: number | null
  cooling2pctDb: number | null
  cooling2pctMcwb: number | null
  cooling4pctDb: number | null
  cooling4pctMcwb: number | null

  /** Extreme annual dry bulb maxima, °F. */
  _5yrDbTempFmax: number | null
  _10yrDbTempFmax: number | null
  _20yrDbTempFmax: number | null
  _50yrDbTempFmax: number | null
}

/**
 * ASHRAE design conditions for a city.
 *
 * `country` follows Dryware's own convention — `USA`, and Canada is the only other
 * coverage. `state` is the two-letter province/state code.
 */
export async function fetchWeatherStation(
  city: string,
  state: string,
  country = 'USA',
): Promise<WeatherStation | null> {
  const qs = new URLSearchParams({ city, state, country })
  const raw = await getJson(`/api/WeatherData/getWeatherData?${qs.toString()}`)
  if (!raw || typeof raw !== 'object') return null
  // Dryware answers with a bare object, or (for an unknown city) an empty body.
  const s = raw as WeatherStation
  return s.stationName || s.id ? s : null
}

/**
 * The design condition a dehumidifier should normally be sized on: the peak-moisture
 * hour, not the peak-temperature hour. Returns dry bulb + grains, ready to drop into
 * the Studio's outdoor-air inputs.
 */
export function dehumidificationDesign(
  s: WeatherStation,
  pct: 1 | 2 | 4 = 1,
): { tempF: number; grains: number; dewPointF: number } | null {
  const pick = <T>(a: T, b: T, c: T) => (pct === 1 ? a : pct === 2 ? b : c)
  const tempF = pick(s.dehumidification1pctMcdb, s.dehumidification2pctMcdb, s.dehumidification4pctMcdb)
  const grains = pick(s.dehumidification1pctHr, s.dehumidification2pctHr, s.dehumidification4pctHr)
  const dewPointF = pick(s.dehumidification1pctDp, s.dehumidification2pctDp, s.dehumidification4pctDp)
  if (tempF == null || grains == null || dewPointF == null) return null
  return { tempF, grains, dewPointF }
}
