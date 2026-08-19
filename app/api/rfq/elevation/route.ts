import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { designForSite } from '@/lib/ashrae'

export const dynamic = 'force-dynamic'

/**
 * Look up a site elevation from a typed location ("Covington, GA" or "30014").
 *
 * DELIBERATELY NOT AN LLM. Elevation feeds the psychrometrics — grains, dew point
 * and ultimately the airflow a unit is sized for — so a number that is merely
 * plausible is worse than no number at all: it is wrong quietly, in a field a
 * customer will not think to check. A language model will happily return "about
 * 900 ft" for a town it has never encountered. Every source below is a public
 * geodetic service returning a measured value.
 *
 * Chain:
 *   1. ZIP (5 digits)   -> Zippopotam  -> lat/lon
 *      anything else    -> Open-Meteo geocoding -> lat/lon (+ its own elevation)
 *   2. lat/lon          -> USGS EPQS   -> elevation in feet
 *
 * USGS is the authority for US ground elevation and is what we return when it
 * answers. Open-Meteo's own elevation is the fallback when USGS is unreachable or
 * the point is outside its coverage; the two agreed to within 4 ft on the first
 * point tested, which is far inside the tolerance this number needs.
 *
 * Elevation itself comes only from free, keyless, public geodetic services.
 *
 * ── ASHRAE design conditions (added 2026-08-19) ─────────────────────────────
 * The response also carries the outdoor DESIGN conditions for the site, from the
 * nearest ASHRAE weather station (lib/ashrae.ts). This route previously said no
 * ASHRAE data would ever pass through it, because the dataset is licensed and sold
 * by ASHRAE; the owner reviewed that on 2026-08-19 and chose to serve it, for
 * consistency with the DryWare calculators. lib/ashrae.ts carries the reasoning.
 *
 * The two halves are independent. Elevation still resolves from USGS and does NOT
 * take the station's figure — a station is typically an airport tens of miles off,
 * and its elevation is not the site's.
 *
 * Failure is ALWAYS soft. The field stays hand-editable and the wizard must work
 * with every one of these services down; this endpoint is a convenience, never a
 * dependency. A caller that gets `{ ok: false }` should simply leave the field
 * alone.
 */

const UA = 'IAT-Portal/1.0 (quote request elevation lookup)'
const M_TO_FT = 3.280839895

type Geo = { lat: number; lon: number; label: string; elevationFtFallback: number | null }

/** US ZIP, with or without the +4. */
function zipOf(q: string): string | null {
  const m = q.trim().match(/^(\d{5})(?:-\d{4})?$/)
  return m ? m[1] : null
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function geocodeZip(zip: string): Promise<Geo | null> {
  const j = await fetchJson(`https://api.zippopotam.us/us/${zip}`) as
    { places?: Array<{ latitude?: string; longitude?: string; 'place name'?: string; 'state abbreviation'?: string }> } | null
  const p = j?.places?.[0]
  if (!p?.latitude || !p?.longitude) return null
  const lat = Number(p.latitude)
  const lon = Number(p.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return {
    lat, lon,
    label: [p['place name'], p['state abbreviation']].filter(Boolean).join(', ') || zip,
    elevationFtFallback: null,
  }
}

/**
 * "Covington, GA" -> the Georgia Covington, not the Louisiana one. The state is
 * matched against admin1 / its abbreviation, because searching the bare city name
 * returns the most populous match, which is frequently the wrong state.
 */
async function geocodeName(q: string): Promise<Geo | null> {
  const parts = q.split(',').map(s => s.trim()).filter(Boolean)
  const city = parts[0]
  const region = parts[1]?.toUpperCase() ?? ''
  if (!city) return null

  const j = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&countryCode=US&language=en&format=json`
  ) as { results?: Array<{ latitude: number; longitude: number; elevation?: number; name?: string; admin1?: string }> } | null

  const results = j?.results ?? []
  if (!results.length) return null

  const hit = region
    ? results.find(r => {
        const a1 = (r.admin1 ?? '').toUpperCase()
        return a1 === region || a1.startsWith(region) || US_STATE[region] === a1
      }) ?? results[0]
    : results[0]

  return {
    lat: hit.latitude,
    lon: hit.longitude,
    label: [hit.name, hit.admin1].filter(Boolean).join(', '),
    // Open-Meteo reports metres.
    elevationFtFallback: typeof hit.elevation === 'number' ? Math.round(hit.elevation * M_TO_FT) : null,
  }
}

async function usgsElevationFt(lat: number, lon: number): Promise<number | null> {
  const j = await fetchJson(
    `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&wkid=4326`
  ) as { value?: number | string } | null
  const v = typeof j?.value === 'string' ? Number(j.value) : j?.value
  // EPQS reports -1000000 for "no data at this point" rather than erroring.
  if (typeof v !== 'number' || !Number.isFinite(v) || v < -1400 || v > 30000) return null
  return Math.round(v)
}

export async function GET(req: Request) {
  const limited = await rateLimit(req, { name: 'rfq-elevation', max: 40, windowSeconds: 600 })
  if (limited) return limited

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 120) {
    return NextResponse.json({ ok: false, reason: 'bad_query' }, { status: 400 })
  }

  const zip = zipOf(q)
  const geo = zip ? await geocodeZip(zip) : await geocodeName(q)
  if (!geo) return NextResponse.json({ ok: false, reason: 'not_found' })

  // Elevation and design conditions are independent lookups against different
  // services, so they run together — the slow one should not wait on the other.
  const [usgs, design] = await Promise.all([
    usgsElevationFt(geo.lat, geo.lon),
    designForSite(geo.lat, geo.lon),
  ])

  // ELEVATION STAYS USGS. The ASHRAE record carries its station's elevation, but
  // that is the airport's, not the site's: Covington, GA is 745 ft and its nearest
  // station is 29 miles away at 943 ft. Elevation feeds every psychrometric number
  // here and USGS resolves the actual coordinates, so it wins whenever it answers.
  // The station figure is returned alongside as context, never as the value.
  const elevationFt = usgs ?? geo.elevationFtFallback ?? design?.elevationFt ?? null
  if (elevationFt === null) return NextResponse.json({ ok: false, reason: 'no_elevation' })

  return NextResponse.json({
    ok: true,
    elevationFt,
    matched: geo.label,
    source: usgs !== null ? 'USGS 3DEP' : geo.elevationFtFallback !== null ? 'Open-Meteo' : 'ASHRAE station',
    // Absent whenever the lookup failed or no station was close enough. A caller
    // must treat this as optional and leave its fields alone when it is missing.
    design: design && {
      station: design.station.place,
      wmo: design.station.wmo,
      distanceMi: Math.round(design.station.distanceMi),
      version: design.version,
      period: design.period,
      stationElevationFt: design.elevationFt,
      dehumDewPointF: design.dehumDewPointF,
      dehumGrains: design.dehumGrains,
      dehumMcdbF: design.dehumMcdbF,
      coolingDbF: design.coolingDbF,
      coolingMcwbF: design.coolingMcwbF,
      heatingDbF: design.heatingDbF,
    },
  })
}

/** Abbreviation -> full name, for matching a typed "GA" against admin1 "Georgia". */
const US_STATE: Record<string, string> = {
  AL: 'ALABAMA', AK: 'ALASKA', AZ: 'ARIZONA', AR: 'ARKANSAS', CA: 'CALIFORNIA',
  CO: 'COLORADO', CT: 'CONNECTICUT', DE: 'DELAWARE', DC: 'DISTRICT OF COLUMBIA',
  FL: 'FLORIDA', GA: 'GEORGIA', HI: 'HAWAII', ID: 'IDAHO', IL: 'ILLINOIS',
  IN: 'INDIANA', IA: 'IOWA', KS: 'KANSAS', KY: 'KENTUCKY', LA: 'LOUISIANA',
  ME: 'MAINE', MD: 'MARYLAND', MA: 'MASSACHUSETTS', MI: 'MICHIGAN', MN: 'MINNESOTA',
  MS: 'MISSISSIPPI', MO: 'MISSOURI', MT: 'MONTANA', NE: 'NEBRASKA', NV: 'NEVADA',
  NH: 'NEW HAMPSHIRE', NJ: 'NEW JERSEY', NM: 'NEW MEXICO', NY: 'NEW YORK',
  NC: 'NORTH CAROLINA', ND: 'NORTH DAKOTA', OH: 'OHIO', OK: 'OKLAHOMA', OR: 'OREGON',
  PA: 'PENNSYLVANIA', RI: 'RHODE ISLAND', SC: 'SOUTH CAROLINA', SD: 'SOUTH DAKOTA',
  TN: 'TENNESSEE', TX: 'TEXAS', UT: 'UTAH', VT: 'VERMONT', VA: 'VIRGINIA',
  WA: 'WASHINGTON', WV: 'WEST VIRGINIA', WI: 'WISCONSIN', WY: 'WYOMING',
}
