// ─── ASHRAE climatic design conditions, by site ──────────────────────────────
//
// Turns a latitude/longitude into the outdoor design conditions a dehumidifier is
// actually sized against: the summer dehumidification point (dew point, humidity
// ratio and its mean coincident dry bulb), the cooling point, and the winter
// heating point.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Before this, `emptyRfq()` seeded every survey with outdoor design 95°F / 55%rh
// and the room flow never asked. That is roughly 100 gr/lb — a national guess that
// happened to be the number in the template. Atlanta's 0.4% dehumidification
// design is 132.6 gr/lb, about a third more moisture, and Phoenix is far less.
// Ventilation and infiltration load are computed from it (see estimateLoad), so
// every room quote was being costed against weather nobody chose.
//
// ── Where the data comes from, and the position on it ───────────────────────
// ashrae-meteo.info is an unaffiliated site that republishes ASHRAE's Climatic
// Design Conditions. That dataset is copyrighted and sold by ASHRAE.
//
// An earlier pass DECLINED to build on it for exactly that reason and used
// public-domain USGS elevation instead (docs/handoff/2026-08-19). The owner
// reviewed that position on 2026-08-19 and chose to serve these values to
// customers anyway, for consistency with the DryWare calculators which already
// use the same source. The decision is recorded here so it is re-decidable rather
// than rediscovered: if the licensing position ever changes, this file is the
// only thing that has to go, and lib/rfq.ts's defaults still stand behind it.
//
// Every field is LABELLED with its station and vintage wherever it is shown, so a
// reader can always tell a looked-up number from one a customer typed.
//
// ── Failure is always soft ──────────────────────────────────────────────────
// This is a third-party site with no SLA, no published API and no terms we
// control. Nothing here throws and nothing here is required: every function
// returns null on any failure, and the wizard must remain fully usable with this
// module returning null forever. It is a convenience, never a dependency.

const BASE = 'https://ashrae-meteo.info/v3.0'

/**
 * Which ASHRAE vintage to read.
 *
 * The site serves 2009, 2013, 2017, 2021 and 2025. 2021 is the default because it
 * is the vintage current design practice quotes from; 2025 exists and is a drop-in
 * change to this one constant (it reports a 1999–2023 observation period against
 * 2021's 1994–2019, and moves Atlanta's design dew point by about 0.1°F).
 *
 * ⚠️ The POINT of this integration is that a quote and a DryWare check agree. If
 * DryWare is reading a different vintage, change this to match it — the numbers
 * will otherwise differ in the first decimal and nobody will know why.
 */
export const ASHRAE_VERSION = '2021'

/** The station list endpoint rejects any `number` but 10. Not a tunable. */
const STATION_COUNT = 10

const TIMEOUT_MS = 7000

/**
 * Refuse a station further than this from the site.
 *
 * The endpoint always answers with its ten nearest, however far that is — asked
 * about a point in the mid-Atlantic it cheerfully returns an island 314 miles away.
 * Design conditions from the wrong climate are the worst possible output here,
 * because they look exactly like the right ones: a plausible dew point, correctly
 * labelled, quietly sizing the wrong machine. Past this radius the honest answer
 * is no answer, and the survey falls back to being asked.
 *
 * 100 miles is loose enough for rural US sites — Covington, GA resolves to a
 * station 29 miles out — and tight enough that a miss is a genuine gap in coverage
 * rather than a different weather regime.
 */
const MAX_STATION_MI = 100

export type AshraeStation = {
  wmo: string
  /** e.g. "ATLANTA HARTSFIELD-JACKSON, GA, USA". */
  place: string
  lat: number
  lon: number
  /** Straight-line miles from the point asked about. */
  distanceMi: number
}

export type AshraeDesign = {
  station: AshraeStation
  /** ASHRAE vintage these figures came from, e.g. "2021". */
  version: string
  /** Observation period the vintage reports, e.g. "94-19". */
  period: string
  /** Station elevation, feet above sea level. */
  elevationFt: number

  // Summer dehumidification design, 0.4% annual exceedance. THIS is the sizing
  // point for a dehumidifier — the cooling point below is a drier, hotter hour and
  // understates moisture, which is the classic way to undersize one of these.
  dehumDewPointF: number
  dehumGrains: number
  /** Mean coincident dry bulb — the temperature at which that moisture occurs. */
  dehumMcdbF: number

  // Cooling design, 0.4%. Carried for the record and the engineer's sanity check.
  coolingDbF: number | null
  coolingMcwbF: number | null

  /** Winter heating design, 99.6% annual exceedance. */
  heatingDbF: number | null
}

/** Form-encoded POST returning parsed JSON, or null on any failure at all. */
async function postForm(path: string, body: Record<string, string>): Promise<unknown | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      signal: ctrl.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // The endpoints 500 without a same-origin referer.
        'Referer': `${BASE}/`,
      },
      body: new URLSearchParams(body).toString(),
    })
    clearTimeout(timer)
    if (!res.ok) return null
    // The responses are served with a UTF-8 BOM, which JSON.parse rejects.
    const text = (await res.text()).replace(/^﻿/, '').trim()
    if (!text) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** A field that may arrive as "", "-", "n/a" or a number-as-string. */
function numOrNull(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

const EARTH_MI = 3958.8

function haversineMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The nearest weather stations to a point, nearest first.
 *
 * The endpoint returns ten in what looks like distance order, but the distance
 * itself is not in the payload, so we compute it rather than trust the ordering —
 * and we need the number anyway to tell the customer how far away their weather
 * was measured. A station 60 miles off is worth knowing about.
 *
 * Its `elev` is METRES here, unlike the per-station endpoint below, which reports
 * feet when asked for IP units. We take elevation only from that one, so the two
 * can never be crossed.
 */
async function nearestStations(lat: number, lon: number, version: string): Promise<AshraeStation[]> {
  const j = await postForm('request_places.php', {
    lat: lat.toFixed(3),
    long: lon.toFixed(3),
    number: String(STATION_COUNT),
    ashrae_version: version,
  }) as { meteo_stations?: Array<Record<string, unknown>> } | null

  const rows = j?.meteo_stations
  if (!Array.isArray(rows)) return []

  return rows.flatMap(r => {
    const sLat = numOrNull(r.lat)
    const sLon = numOrNull(r.long)
    const wmo = typeof r.wmo === 'string' ? r.wmo : null
    if (sLat === null || sLon === null || !wmo) return []
    return [{
      wmo,
      place: typeof r.place === 'string' ? r.place : wmo,
      lat: sLat,
      lon: sLon,
      distanceMi: haversineMi(lat, lon, sLat, sLon),
    }]
  }).sort((a, b) => a.distanceMi - b.distanceMi)
}

/** One station's design conditions, in IP units. */
async function stationDesign(station: AshraeStation, version: string): Promise<AshraeDesign | null> {
  const j = await postForm('request_meteo_parametres.php', {
    wmo: station.wmo,
    ashrae_version: version,
    si_ip: 'IP',
  }) as { meteo_stations?: Array<Record<string, unknown>> } | null

  const s = j?.meteo_stations?.[0]
  if (!s) return null

  const elevationFt = numOrNull(s.elev)
  const dehumDewPointF = numOrNull(s['dehumidification_DP/MCDB_and_HR_0.4_DP'])
  const dehumGrains = numOrNull(s['dehumidification_DP/MCDB_and_HR_0.4_HR'])
  const dehumMcdbF = numOrNull(s['dehumidification_DP/MCDB_and_HR_0.4_MCDB'])

  // A record missing any of the four is not usable: the whole point is to replace
  // a guessed outdoor condition with a measured one, and a half-filled one would
  // silently leave the guess in place for whichever field was absent.
  if (elevationFt === null || dehumDewPointF === null || dehumGrains === null || dehumMcdbF === null) {
    return null
  }

  return {
    station,
    version,
    period: typeof s.period === 'string' ? s.period : '',
    elevationFt,
    dehumDewPointF,
    dehumGrains,
    dehumMcdbF,
    coolingDbF: numOrNull(s['cooling_DB_MCWB_0.4_DB']),
    coolingMcwbF: numOrNull(s['cooling_DB_MCWB_0.4_MCWB']),
    heatingDbF: numOrNull(s['heating_DB_99.6']),
  }
}

/**
 * Design conditions for a site, from the nearest station that has a usable record.
 *
 * Walks outward rather than giving up on the closest one: a station can be in the
 * list and still have no design record for the requested vintage, and the next one
 * twenty miles away is a far better answer than none. Stops after a few so a bad
 * region cannot turn one lookup into ten round trips.
 */
export async function designForSite(
  lat: number,
  lon: number,
  version: string = ASHRAE_VERSION,
): Promise<AshraeDesign | null> {
  const stations = (await nearestStations(lat, lon, version))
    .filter(s => s.distanceMi <= MAX_STATION_MI)
  for (const station of stations.slice(0, 3)) {
    const design = await stationDesign(station, version)
    if (design) return design
  }
  return null
}
