import { supabaseAdmin } from './supabase-admin'

/**
 * Sign-in accountability trail (table: login_events, migration 031).
 *
 * Records one row per successful sign-in across every portal — answering "who
 * logged in, from where, on what device, and when". The companion to
 * lib/audit.ts, which records what admins *do* once inside.
 *
 * Writes are best-effort: a logging failure is swallowed and logged to the
 * console, never surfaced to the caller, so logging can never break the sign-in
 * it describes.
 */

export type LoginMethod = 'password' | 'magic_link' | 'invite' | 'recovery'

export type LoginEvent = {
  userId?: string | null
  email?: string | null
  name?: string | null
  role?: string | null
  /** portal the user landed in — 'admin' | 'employee' | 'customer' | 'learn' */
  portal?: string | null
  method?: LoginMethod | null
  /** request headers — IP, geo and User-Agent are derived from these */
  headers: Headers
}

/** A trimmed view of what we pull out of the request, for callers that want it. */
export type ClientInfo = {
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  timezone: string | null
  userAgent: string | null
  browser: string | null
  os: string | null
  device: string | null
}

/**
 * Pull client IP, geo and a parsed User-Agent out of the request headers.
 * On Vercel, x-forwarded-for carries the real client IP and the x-vercel-ip-*
 * headers carry coarse geo (free — no geo-IP service needed).
 */
export function clientInfoFromHeaders(headers: Headers): ClientInfo {
  const forwarded = headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0].trim() || headers.get('x-real-ip') || null) ?? null
  const userAgent = headers.get('user-agent')
  const { browser, os, device } = parseUserAgent(userAgent)

  const decode = (v: string | null) => {
    if (!v) return null
    try { return decodeURIComponent(v) } catch { return v }
  }

  return {
    ip,
    city: decode(headers.get('x-vercel-ip-city')),
    region: headers.get('x-vercel-ip-country-region'),
    country: headers.get('x-vercel-ip-country'),
    timezone: headers.get('x-vercel-ip-timezone'),
    userAgent,
    browser,
    os,
    device,
  }
}

/**
 * Minimal, dependency-free User-Agent parser. Good enough to show "Chrome on
 * Windows · desktop" in the audit viewer; not a full UA database. Order matters
 * (e.g. Edge/Chrome both contain "Chrome"; iOS Chrome reports "CriOS").
 */
export function parseUserAgent(ua: string | null): {
  browser: string | null
  os: string | null
  device: string | null
} {
  if (!ua) return { browser: null, os: null, device: null }

  // OS
  let os: string | null = null
  if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // Browser (check the more specific tokens first)
  let browser: string | null = null
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Firefox\/|FxiOS/i.test(ua)) browser = 'Firefox'
  else if (/Chrome\//i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua)) browser = 'Safari'

  // Device class
  let device: string | null = null
  if (/iPad|Tablet/i.test(ua)) device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) device = 'mobile'
  else device = 'desktop'

  return { browser, os, device }
}

export async function logLoginEvent(event: LoginEvent): Promise<void> {
  try {
    const info = clientInfoFromHeaders(event.headers)
    await supabaseAdmin.from('login_events').insert({
      user_id: event.userId ?? null,
      email: event.email ?? null,
      name: event.name ?? null,
      role: event.role ?? null,
      portal: event.portal ?? null,
      method: event.method ?? null,
      ip: info.ip,
      city: info.city,
      region: info.region,
      country: info.country,
      timezone: info.timezone,
      user_agent: info.userAgent,
      browser: info.browser,
      os: info.os,
      device: info.device,
    })
  } catch (err) {
    console.error('[login-events] failed to write login event:', err)
  }
}
