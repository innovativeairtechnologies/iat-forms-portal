import { cookies } from 'next/headers'

const AUTH_COOKIE = 'iat_admin_auth'

export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies()
  return cookieStore.get(AUTH_COOKIE)?.value === 'authenticated'
}
