import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Must be called before any redirect — refreshes the session cookie
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Resolve role once (relies on the profiles read-own RLS policy from 002).
  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = profile?.role ?? null
  }

  // Where each role's "home" lives. Unknown/null role → employee profile (the
  // trigger always creates a profile, so null is effectively a dead path).
  const homeFor = (r: string | null) =>
    r === 'admin' ? '/admin' : r === 'customer' ? '/customer' : '/employee/profile'

  // Carry the refreshed Supabase auth cookies (set on `supabaseResponse` during
  // getUser()) onto every redirect. Without this, a refreshed session is dropped
  // on redirect and the auth gate can loop (e.g. /customer ↔ /login) for sessions
  // whose token needs refreshing. This is the documented Supabase SSR fix.
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c))
    return res
  }

  const toLogin = () => {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return redirectTo(loginUrl)
  }

  // ── /login: if already logged in, skip to the right portal ───────────────
  if (pathname === '/login') {
    if (user) return redirectTo(new URL(homeFor(role), request.url))
    return supabaseResponse
  }

  // ── /customer/* (external customers; skip the set-password welcome page) ────
  if (pathname.startsWith('/customer') && !pathname.startsWith('/customer/welcome')) {
    if (!user) return toLogin()
    if (role !== 'customer') return redirectTo(new URL(homeFor(role), request.url))
    return supabaseResponse
  }

  // ── /admin/* ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) return redirectTo(new URL('/login', request.url))
    if (role !== 'admin') return redirectTo(new URL(homeFor(role), request.url))
    return supabaseResponse
  }

  // ── /learn/* (shared auth; admin-gating handled in the /learn/admin layout) ─
  if (pathname.startsWith('/learn')) {
    if (!user) return toLogin()
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  // ── /employee/* (skip public entry points) ────────────────────────────────
  // Note: /employee/login is consolidated to /login via a next.config redirect
  // (runs before middleware), so it never reaches here.
  if (
    pathname.startsWith('/employee') &&
    !pathname.startsWith('/employee/welcome')
  ) {
    if (!user) return toLogin()
    if (role === 'admin') return redirectTo(new URL('/admin', request.url))
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  // ── /tools/* (internal static HTML tools — staff only) ─────────────────────
  // public/tools/*.html are self-contained internal calculators/generators.
  // Gate them behind any authenticated session (employee OR admin); anon → login.
  if (pathname.startsWith('/tools')) {
    if (!user) return toLogin()
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/learn/:path*', '/customer/:path*', '/tools/:path*', '/login'],
}
