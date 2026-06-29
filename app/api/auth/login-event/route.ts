import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logLoginEvent, type LoginMethod } from '@/lib/login-events'

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/auth/login-event
   Records a successful sign-in (table: login_events, mig 031).

   Called by the client right after signInWithPassword succeeds. We DON'T trust
   the client for identity — the user is re-resolved from the session cookie
   server-side, so only the portal/method hints come from the request body. IP,
   geo and device are read from the request headers (Vercel-populated).
   Best-effort: always returns 200 so a logging hiccup never blocks the user.
   ──────────────────────────────────────────────────────────────────────────── */

const VALID_METHODS: LoginMethod[] = ['password', 'magic_link', 'invite', 'recovery']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    // No valid session → nothing trustworthy to log. Quietly succeed.
    if (!user) return NextResponse.json({ ok: true })

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const portal = typeof body.portal === 'string' ? body.portal : null
    const method = VALID_METHODS.includes(body.method as LoginMethod)
      ? (body.method as LoginMethod)
      : 'password'

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .single()

    await logLoginEvent({
      userId: user.id,
      email: user.email ?? null,
      name: profile?.display_name ?? user.email ?? null,
      role: profile?.role ?? null,
      portal,
      method,
      headers: request.headers,
    })
  } catch (err) {
    console.error('[login-event] route failed:', err)
  }

  return NextResponse.json({ ok: true })
}
