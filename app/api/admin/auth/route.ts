import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const AUTH_COOKIE = 'iat_admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

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
