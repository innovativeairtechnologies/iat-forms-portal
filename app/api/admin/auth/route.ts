import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const AUTH_COOKIE = 'iat_admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

const MAX_ATTEMPTS = 5
const WINDOW_MS = 10 * 60 * 1000  // 10 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15-minute lockout after limit hit

const attempts = new Map<string, { count: number; windowStart: number; lockedUntil?: number }>()

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const now = Date.now()
  const record = attempts.get(ip)

  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfter = Math.ceil((record.lockedUntil - now) / 1000)
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }
    // Reset window if it's expired
    if (now - record.windowStart > WINDOW_MS) {
      attempts.delete(ip)
    }
  }

  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: 'Admin password not configured' }, { status: 500 })
  }

  // Timing-safe comparison — HMAC both values with a per-request random key
  // so the fixed-length outputs can be compared without leaking via timing.
  const key = randomBytes(32)
  const hmac = (s: string) => createHmac('sha256', key).update(s).digest()
  const match = timingSafeEqual(hmac(password ?? ''), hmac(adminPassword))

  if (!match) {
    const current = attempts.get(ip) ?? { count: 0, windowStart: now }
    current.count += 1
    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = now + LOCKOUT_MS
    }
    attempts.set(ip, current)
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  attempts.delete(ip)

  const cookieStore = cookies()
  cookieStore.set(AUTH_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const cookieStore = cookies()
  cookieStore.delete(AUTH_COOKIE)
  return NextResponse.json({ success: true })
}
