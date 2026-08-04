import { NextRequest, NextResponse } from 'next/server'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { fetchWeatherStation, dehumidificationDesign } from '@/lib/dryware-sizing'

/* ASHRAE design conditions for a city, proxied from Dryware's weather-station data.
 *
 * Server-side so the Sizing Studio (a client component) never talks to Dryware
 * directly — that keeps DRYWARE_AUTH_HEADER off the browser if those endpoints are
 * ever locked down, and means one place to change if the upstream shape moves.
 *
 * Gated on the same `sizing` perm as the page itself. Read-only; no writes anywhere.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('sizing')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const city = (req.nextUrl.searchParams.get('city') ?? '').trim()
  const state = (req.nextUrl.searchParams.get('state') ?? '').trim()
  const country = (req.nextUrl.searchParams.get('country') ?? 'USA').trim()

  if (!city || !state) {
    return NextResponse.json({ error: 'city and state are both required' }, { status: 400 })
  }

  try {
    const station = await fetchWeatherStation(city, state, country)
    if (!station) {
      return NextResponse.json(
        { error: `No ASHRAE station found for ${city}, ${state}. Dryware covers the US and Canada only.` },
        { status: 404 },
      )
    }
    return NextResponse.json({
      station,
      // Pre-resolve the three dehumidification design points so the client doesn't
      // have to know which ASHRAE columns matter for sizing.
      design: {
        p1: dehumidificationDesign(station, 1),
        p2: dehumidificationDesign(station, 2),
        p4: dehumidificationDesign(station, 4),
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not reach Dryware. ${detail}` }, { status: 502 })
  }
}
