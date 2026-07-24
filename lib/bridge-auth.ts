import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Auth for the customer-portal bridge (/api/bridge/*).
 *
 * These routes serve internal data to the SEPARATE customer deployment
 * (iat-customer), which holds no credential to this database. They are the only
 * machine-to-machine surface in the app, so they get their own named guard —
 * same convention as requireDealsAuth / requireToolCribAuth in lib/api-auth.ts:
 * one guard per surface, so widening one can never silently widen another.
 *
 * Transport contract (must match iat-customer/lib/bridge.ts):
 *   x-iat-timestamp : Date.now() as a string
 *   x-iat-signature : HMAC-SHA256 hex over `${timestamp}.${method}.${path}.${rawBody}`
 *
 * The timestamp is inside the signed payload AND checked for freshness, so a
 * captured request can't be replayed later. Comparison is timing-safe.
 *
 * NOTE ON TRUST: a valid signature proves the request came from the customer
 * deployment — nothing more. It does NOT vouch for the customerId in the body.
 * Every endpoint must still scope its query to that id and re-check ownership
 * itself; see the customer_id re-filter in the tickets route.
 */

/** How far out of sync a request's timestamp may be. Covers clock skew between
 *  the two deployments without leaving a meaningful replay window. */
const MAX_SKEW_MS = 5 * 60 * 1000

export type BridgeAuthResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string }

export async function requireBridgeAuth(request: Request, path: string): Promise<BridgeAuthResult> {
  const secret = process.env.INTERNAL_BRIDGE_SECRET
  // Fail CLOSED when unconfigured: without this, an empty secret would make
  // every unsigned request verify against HMAC("") and open the whole surface.
  if (!secret) return { ok: false, status: 503, error: 'Bridge not configured' }

  const timestamp = request.headers.get('x-iat-timestamp')
  const signature = request.headers.get('x-iat-signature')
  if (!timestamp || !signature) return { ok: false, status: 401, error: 'Unauthorized' }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  // Read the RAW body — the signature covers the exact bytes, so re-serializing
  // parsed JSON could change key order/spacing and break verification.
  const raw = await request.text()
  const expected = createHmac('sha256', secret).update(`${ts}.POST.${path}.${raw}`).digest('hex')

  const a = Buffer.from(signature, 'hex')
  const b = Buffer.from(expected, 'hex')
  // timingSafeEqual throws on a length mismatch — check first, and still compare
  // timing-safely when the lengths do match.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  let body: Record<string, unknown>
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }

  return { ok: true, body }
}

/** Pull a required, non-empty string field out of a verified bridge body. */
export function requireString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
