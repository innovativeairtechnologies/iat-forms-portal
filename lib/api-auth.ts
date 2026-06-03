import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const AUTH_COOKIE = 'iat_admin_auth'

/**
 * Call at the top of any admin API route handler.
 * Returns a 401 response if the request is not authenticated,
 * or null if it is (so you can do: const err = requireAdminAuth(); if (err) return err).
 */
export function requireAdminAuth(): NextResponse | null {
  const cookieStore = cookies()
  if (cookieStore.get(AUTH_COOKIE)?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
