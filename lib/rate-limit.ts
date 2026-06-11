import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-admin'

type LimitConfig = {
  name: string          // limiter bucket, e.g. 'tickets' — keys are '<name>:<ip>'
  max: number           // max requests allowed per window
  windowSeconds: number
}

function clientIp(req: Request): string {
  // On Vercel, x-forwarded-for's first hop is the client IP.
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Fixed-window, per-IP rate limiter backed by the rate_limits table
 * (migration 006). Returns a 429 response when the caller is over the limit,
 * or null to proceed. Fails OPEN on database errors — a limiter hiccup (or a
 * not-yet-run migration) must never block a real customer; the error is
 * logged instead. Call this BEFORE parsing the body so malformed floods are
 * limited too.
 */
export async function rateLimit(req: Request, { name, max, windowSeconds }: LimitConfig): Promise<NextResponse | null> {
  const key = `${name}:${clientIp(req)}`

  const { data: allowed, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error(`[rate-limit] check failed for ${key} (failing open):`, error.message)
    return null
  }

  if (allowed === false) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(windowSeconds) } }
    )
  }

  return null
}
