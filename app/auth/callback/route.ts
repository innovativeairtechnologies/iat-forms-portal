import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logLoginEvent, type LoginMethod } from '@/lib/login-events'
import { normalizeRole, isAdminSurfaceRole, landingForRole } from '@/lib/roles'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')        // 'invite' | 'recovery' | etc.
  const next = requestUrl.searchParams.get('next') ?? '/home'

  let userId: string | null = null
  let userEmail: string | null = null

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', requestUrl.origin))
    }
    userId = data.user?.id ?? null
    userEmail = data.user?.email ?? null
  }

  // Role-aware routing: customers land inside /customer; admin-surface roles land
  // in their /admin home (no employee onboarding flow); base production uses the
  // employee shell.
  if (userId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', userId)
      .single()

    const role = normalizeRole(profile?.role)

    // Record this sign-in (magic-link / invite / recovery land here, not /login).
    const method: LoginMethod =
      type === 'invite' || type === 'signup' ? 'invite' : type === 'recovery' ? 'recovery' : 'magic_link'
    await logLoginEvent({
      userId,
      email: userEmail,
      name: profile?.display_name ?? userEmail ?? null,
      role: profile?.role ?? null,
      portal: role === 'customer' ? 'customer' : role === 'production' ? 'employee' : 'admin',
      method,
      headers: request.headers,
    })

    if (role === 'customer') {
      const onboarding = type === 'invite' || type === 'signup' || type === 'recovery'
      const dest = onboarding
        ? '/customer/welcome'
        : next.startsWith('/customer') ? next : '/customer'
      return NextResponse.redirect(new URL(dest, requestUrl.origin))
    }

    // Base production invite / signup still routes through the set-password
    // welcome page, even though production now lands in /admin afterward.
    if (role === 'production' && (type === 'invite' || type === 'signup')) {
      return NextResponse.redirect(new URL('/employee/welcome', requestUrl.origin))
    }

    // Admin-surface roles — full admin, the 5 scoped roles, AND set-up production
    // (isAdminSurfaceRole now includes it) — land in their /admin home. A
    // production invite is caught just above, so this only fires post-setup.
    if (isAdminSurfaceRole(role)) {
      return NextResponse.redirect(new URL(landingForRole(role), requestUrl.origin))
    }
  }

  // Fallback for a null / unknown role: invite & signup → employee welcome.
  if (type === 'invite' || type === 'signup') {
    return NextResponse.redirect(new URL('/employee/welcome', requestUrl.origin))
  }

  // Everything else (password reset, etc.)
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
