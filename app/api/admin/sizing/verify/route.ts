import { NextRequest, NextResponse } from 'next/server'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/rate-limit'
import { calculateDesiccantPerformance, getSizingCatalog } from '@/lib/dryware-sizing'
import { calculateSizing, parseSizingInputs } from '@/lib/sizing'
import {
  buildDesmodRequest,
  desmodCacheKey,
  readDesmodResponse,
  reconcileVerification,
  type DesmodRequest,
  type DesmodResponse,
} from '@/lib/desmod'

/* Verify a Sizing Studio run against DryWare's real wheel-performance engine.
 *
 * The Studio's own leaving-air prediction is a planning approximation. This route
 * runs the same selection through DryWare's DesMod model and returns the
 * authoritative leaving condition, the optimised RPH, and the pressure drop —
 * plus the delta against the Studio's estimate, so how far off the planning
 * coefficients were stays visible rather than being silently overwritten.
 *
 * The client posts INPUTS ONLY. The selection is recomputed server-side against
 * the live catalog, so a caller cannot hand us a forged unit or a forged airflow
 * and get an authoritative-looking answer back for it.
 *
 * Gated on the same `sizing` perm as the page. Read-only; no writes anywhere.
 *
 * ⚠️ The upstream is single-threaded at ~1.9 s a call and serialises concurrent
 * requests. Hence: one call per explicit user action, a per-user rate limit, and
 * the deterministic cache below.
 */

export const dynamic = 'force-dynamic'
// Catalog fetch (~0.5 s) + DesMod (~1.9 s, up to ~5.3 s for a 3-sector purge run),
// with headroom for a slow upstream. Well inside the platform ceiling.
export const maxDuration = 30

/**
 * DesMod is deterministic — identical inputs returned byte-identical outputs on
 * every probe — so repeat verifications are served locally rather than queueing
 * behind the single-threaded upstream.
 *
 * Per-instance and in-memory on purpose: this is a latency optimisation for a rep
 * toggling back and forth, not a source of truth. A cold lambda simply recalculates.
 */
const CACHE = new Map<string, DesmodResponse>()
const CACHE_MAX = 200

function cacheGet(key: string): DesmodResponse | undefined {
  const hit = CACHE.get(key)
  if (hit) {
    // Refresh LRU position.
    CACHE.delete(key)
    CACHE.set(key, hit)
  }
  return hit
}

function cacheSet(key: string, value: DesmodResponse): void {
  CACHE.set(key, value)
  while (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value
    if (oldest === undefined) break
    CACHE.delete(oldest)
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('sizing')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  // The upstream is a shared, single-threaded, first-party service. This protects
  // it from one impatient tab, not from an attacker — the perm gate does that.
  const limited = await rateLimit(req, { name: 'sizing_verify', max: 60, windowSeconds: 300 })
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const inputs = parseSizingInputs(body && typeof body === 'object' ? (body as Record<string, unknown>).inputs : null)

  const { sizes, source } = await getSizingCatalog()
  const result = calculateSizing(inputs, sizes)

  // A run the local engine already rejects has nothing worth verifying — sending
  // it upstream would burn a 1.9 s slot to be told the same thing less clearly.
  const blocking = result.warnings.find((w) => w.severity === 'error')
  if (blocking) {
    return NextResponse.json(
      { error: `Fix this before verifying: ${blocking.message}` },
      { status: 400 },
    )
  }

  const built = buildDesmodRequest(inputs, result)
  if (!built.ok) {
    return NextResponse.json({ error: built.message }, { status: 400 })
  }
  const request: DesmodRequest = built.request

  const key = desmodCacheKey(request)
  const cached = cacheGet(key)
  if (cached) {
    return NextResponse.json({
      verification: reconcileVerification(result, request, cached, new Date().toISOString()),
      catalogSource: source,
      cached: true,
    })
  }

  let raw: unknown
  try {
    raw = await calculateDesiccantPerformance(request)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: `Could not reach DryWare's calculator. ${detail}`, code: 'unreachable' },
      { status: 502 },
    )
  }

  const read = readDesmodResponse(raw)
  if (!read.ok) {
    // A refusal is not a malformation — the same lesson the case-study tool
    // taught. `rejected` means DesMod ran and declined, and its own words are the
    // only useful thing to show; retrying identical inputs lands here again.
    const status = read.code === 'rejected' ? 422 : 502
    return NextResponse.json({ error: read.message, code: read.code }, { status })
  }

  cacheSet(key, read.response)

  return NextResponse.json({
    verification: reconcileVerification(result, request, read.response, new Date().toISOString()),
    catalogSource: source,
    cached: false,
  })
}
