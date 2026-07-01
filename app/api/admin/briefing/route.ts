import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { gatherMetrics, generateBriefing, type BriefingPayload } from '@/lib/briefing'

export const dynamic = 'force-dynamic'

/* AI Executive Briefing — a plain-English read of the operation, written by
   Claude from live metrics. The dashboard is force-dynamic (loads often), so we
   never call the model inline: this endpoint is fetched client-side and the
   result is cached in-module for an hour. ?refresh=1 forces a regenerate.

   Metric-gathering and the actual Claude call live in lib/briefing.ts, shared
   with the admin email digest (app/api/cron/admin-digest) so there is exactly
   ONE briefing generated per day, not one per surface. */

// Module-level cache (best-effort across warm invocations).
let cache: { at: number; payload: BriefingPayload } | null = null
const TTL_MS = 60 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  if (!refresh && cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ ...cache.payload, cached: true })
  }

  try {
    const payload = await generateBriefing()
    cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[briefing] generation failed:', err)
    const metrics = await gatherMetrics().catch(() => null)
    return NextResponse.json({ error: 'Could not generate a briefing right now.', metrics }, { status: 502 })
  }
}
