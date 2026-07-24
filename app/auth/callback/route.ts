import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logLoginEvent, type LoginMethod } from '@/lib/login-events'
import { normalizeRole, isAdminSurfaceRole, landingForRole } from '@/lib/roles'
import { safeRedirect } from '@/lib/redirect'

/**
 * The only email domain allowed to sign in with Microsoft. This is defence in
 * depth, NOT the primary control — the Entra app registration is single-tenant
 * and the Supabase Azure provider is pinned to the dehumidifiers.com tenant, so
 * an outside account can't get this far. We re-check anyway rather than trusting
 * the identity provider blindly (docs/microsoft-sso-mfa-plan.md §3.3).
 */
const SSO_EMAIL_DOMAIN = 'dehumidifiers.com'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')        // 'invite' | 'recovery' | etc.
  const nextParam = requestUrl.searchParams.get('next')
  const next = nextParam ?? '/home'

  let userId: string | null = null
  let userEmail: string | null = null
  let viaMicrosoft = false

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

    // ─── Microsoft (Entra ID) sign-in gates ──────────────────────────────────
    // Magic-link / invite / recovery all arrive here with a ?type=; an OAuth
    // redirect-back carries none. Combined with an azure identity on the
    // resolved user, that identifies a "Sign in with Microsoft" round-trip.
    // Both checks below read the VERIFIED session, never a URL param, so
    // neither can be spoofed by editing the callback URL.
    let identities = data.user?.identities ?? []

    // Defensive: an EMPTY identities array must never be read as "not an SSO
    // sign-in" — that would skip both gates below and fail open. If the token
    // response didn't carry identities, re-read them authoritatively with the
    // service-role client before deciding.
    if (!type && identities.length === 0 && userId) {
      const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      identities = adminUser?.user?.identities ?? []
    }

    viaMicrosoft = !type && identities.some((i) => i.provider === 'azure')

    if (viaMicrosoft) {
      const email = (userEmail ?? '').toLowerCase()

      // Gate 1 — domain. Fail closed on a missing email too: with only the
      // `openid` scope Entra returns no email claim, and we must never treat
      // "no email" as "allowed".
      if (!email.endsWith(`@${SSO_EMAIL_DOMAIN}`)) {
        await supabase.auth.signOut()
        console.warn('[auth/callback] Microsoft sign-in rejected — non-tenant email:', email || '(none)')
        return NextResponse.redirect(new URL('/login?error=sso_domain', requestUrl.origin))
      }

      // Gate 2 — the account must already have been provisioned by an admin.
      //
      // This one is load-bearing. A trigger on auth.users (migration 002,
      // handle_new_user_profile) creates a profiles row at the 'employee'
      // /production tier for EVERY new auth user. Since the portal
      // consolidation, production is an admin-surface role — so without this
      // gate, any member of the M365 tenant who clicked the button would
      // silently self-provision a working portal account. Portal accounts are
      // meant to exist only by admin invite, with a role set deliberately.
      //
      // An admin-invited account always carries an 'email' identity (invites go
      // through inviteUserByEmail). An account that holds ONLY an azure identity
      // was therefore created by this very sign-in — reject it.
      //
      // This is also the empirical answer to plan §3.4: if Supabase auto-links
      // by verified email, an existing staff member arrives here with BOTH
      // identities and passes. If it does not auto-link, they arrive azure-only
      // and are bounced with ?error=sso_no_account — which tells us we're in
      // case (b) and need explicit linking, rather than silently creating a
      // duplicate role-less profile. Rejected users keep an inert auth row (no
      // password, and blocked here on every retry); clean-up is deliberately
      // left to an admin rather than auto-deleting accounts from a callback.
      if (!identities.some((i) => i.provider === 'email')) {
        await supabase.auth.signOut()
        console.warn('[auth/callback] Microsoft sign-in rejected — no provisioned account for:', email)
        return NextResponse.redirect(new URL('/login?error=sso_no_account', requestUrl.origin))
      }
    }
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

    // Record this sign-in (magic-link / invite / recovery / Microsoft SSO all
    // land here, not /login — /login only handles the password form itself).
    const method: LoginMethod = viaMicrosoft
      ? 'microsoft'
      : type === 'invite' || type === 'signup' ? 'invite' : type === 'recovery' ? 'recovery' : 'magic_link'
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
      // A Microsoft sign-in can carry a deep link (?next=), set from /login when
      // middleware bounced the user off a gated page. Only honored for SSO —
      // invite / recovery deliberately force their own landing. safeRedirect
      // blocks off-site targets, and middleware re-gates whatever we send them
      // to, so an unpermitted path just bounces to that role's home.
      const dest =
        viaMicrosoft && nextParam
          ? safeRedirect(nextParam, landingForRole(role))
          : landingForRole(role)
      return NextResponse.redirect(new URL(dest, requestUrl.origin))
    }
  }

  // Fallback for a null / unknown role: invite & signup → employee welcome.
  if (type === 'invite' || type === 'signup') {
    return NextResponse.redirect(new URL('/employee/welcome', requestUrl.origin))
  }

  // Everything else (password reset, etc.)
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
