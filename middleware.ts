import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeRole, homeForRole, landingForRole, isAdminSurfaceRole, canAccessAdminPath, type PermMatrix, type Perm } from '@/lib/roles'

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
  let rawRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    rawRole = profile?.role ?? null
  }
  // Normalize legacy 'employee' → 'production' and validate against the role set.
  const role = normalizeRole(rawRole)

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

  // ── /login: if already logged in, skip to your landing (the company home) ──
  if (pathname === '/login') {
    if (user) return redirectTo(new URL(landingForRole(role), request.url))
    return supabaseResponse
  }

  // ── /home: the shared internal company home. Any signed-in staff member
  // (admin, scoped roles, base production) may see it; external customers have
  // their own portal, so bounce them there. Anon → login.
  if (pathname === '/home') {
    if (!user) return toLogin()
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  // ── /customer/* (external customers; skip the set-password welcome page) ────
  if (pathname.startsWith('/customer') && !pathname.startsWith('/customer/welcome')) {
    if (!user) return toLogin()
    if (role !== 'customer') return redirectTo(new URL(homeForRole(role), request.url))
    return supabaseResponse
  }

  // ── /admin/* ──────────────────────────────────────────────────────────────
  // Admin-surface roles (full admin + scoped: sales/hr/marketing/engineering/
  // production_manager) may enter. Scoped roles are gated per-section here so a
  // hidden nav tab can't be reached by typing its URL. Full admin bypasses.
  if (pathname.startsWith('/admin')) {
    if (!user) return redirectTo(new URL('/login', request.url))
    if (!isAdminSurfaceRole(role)) return redirectTo(new URL(homeForRole(role), request.url))

    // Scoped roles are gated by the DB-backed permission matrix (migration 045),
    // read here for just this one role via the request's own RLS-scoped client.
    // Full admin bypasses (canAccessAdminPath short-circuits on 'admin').
    //
    // Fail behavior: a real read ERROR (e.g. the table doesn't exist yet,
    // pre-migration) leaves matrix undefined, so gating + the redirect target
    // fall back to the code defaults — a transient hiccup never locks a scoped
    // role out. A SUCCESSFUL read of zero rows is honored as "all perms revoked"
    // (fail-closed): that's the intended state when an admin toggles a role's
    // access fully off, which also means migration 045's authenticated-SELECT
    // policy must stay in place — dropping it would read as revocation, not
    // fallback. homeForRole gets the SAME matrix so a revoked perm can't bounce
    // the redirect target back through the gate and loop; /admin/profile is the floor.
    let matrix: PermMatrix | undefined
    if (role && role !== 'admin') {
      const { data: permRows, error: permErr } = await supabase
        .from('role_permissions')
        .select('perm')
        .eq('role', role)
      if (!permErr && permRows) matrix = { [role]: permRows.map((r) => r.perm as Perm) } as PermMatrix
    }

    if (!canAccessAdminPath(role, pathname, matrix)) {
      return redirectTo(new URL(homeForRole(role, matrix), request.url))
    }
    return supabaseResponse
  }

  // NOTE: IAT Learn moved to /admin/learn (+ /admin/learn-content for authoring),
  // so it is covered by the /admin block above — the learner pages via
  // OPEN_ADMIN_PREFIXES, authoring via the 'learn_admin' entry in
  // ADMIN_PATH_PERMS. Old /learn/* URLs are handled by next.config.js redirects,
  // which run BEFORE middleware. The '/learn/:path*' matcher entry was removed
  // with this block: keeping it without the block would let any /learn/* request
  // that dodged the redirect fall through to the bare `return supabaseResponse`
  // at the end of this function — i.e. ungated.

  // ── /employee/* (skip public entry points) ────────────────────────────────
  // Note: /employee/login is consolidated to /login via a next.config redirect
  // (runs before middleware), so it never reaches here.
  if (
    pathname.startsWith('/employee') &&
    !pathname.startsWith('/employee/welcome')
  ) {
    if (!user) return toLogin()
    // Full admin + the 5 scoped roles have their own /admin shell and never used
    // these pages; send them there. Base `production` now ALSO lands in /admin,
    // but a few of its self-service pages (My Board, US Rotors) still live under
    // /employee — so it is deliberately NOT bounced and keeps reaching them.
    // (`isAdminSurfaceRole` includes production since the portal consolidation,
    // hence the explicit exclusion here.)
    //
    // The shared self-service leaves (Time Off, Submit a form, Directory, Apps)
    // are ported to '/admin/me/*' (open to all admin-surface roles), which is
    // where the Company Home hero links now point — so no /admin page sends an
    // admin-surface role into /employee anymore.
    if (isAdminSurfaceRole(role) && role !== 'production') return redirectTo(new URL('/admin', request.url))
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  // ── /tool-crib/* and /t/* (the Tool Crib scan surface — any staff) ─────────
  // Top-level, deliberately NOT under /employee/*: that block below bounces every
  // admin-surface role to /admin, which would include production_manager — the
  // person who actually runs the crib — and it would fail as a silent redirect,
  // not an error.
  //
  // Any signed-in staff member may scan, including base `production` who hold no
  // admin perms. Gating scans on the tool_crib perm would mean only managers
  // could take tools out, which defeats the feature. The `tool_crib` perm gates
  // /admin/tool-crib (the registry) only.
  //
  // /t/<code> is the URL printed on every physical label. toLogin() carries it
  // as ?redirect= so scanning while logged out lands back on the tool after
  // sign-in (see the safeRedirect fix in app/login/page.tsx).
  if (pathname.startsWith('/tool-crib') || pathname === '/t' || pathname.startsWith('/t/')) {
    if (!user) return toLogin()
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  // ── /tools/* (internal static HTML tools — staff only) ─────────────────────
  // public/tools/*.html are self-contained internal calculators/generators
  // (e.g. the confidential US Rotors pricing calculator). Staff only: anon → login,
  // customers → /customer (mirrors the /tool-crib block above).
  if (pathname.startsWith('/tools')) {
    if (!user) return toLogin()
    if (role === 'customer') return redirectTo(new URL('/customer', request.url))
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  // Both the bare path AND the :path* form are needed — '/tool-crib/:path*' alone
  // does NOT match '/tool-crib' itself, which would leave the scan home page
  // completely ungated.
  matcher: [
    '/admin/:path*',
    '/employee/:path*',
    '/customer/:path*',
    '/tools/:path*',
    '/tool-crib',
    '/tool-crib/:path*',
    '/t/:path*',
    '/login',
    '/home',
  ],
}
