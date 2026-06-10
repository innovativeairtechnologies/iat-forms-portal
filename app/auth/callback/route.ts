import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')        // 'invite' | 'recovery' | etc.
  const next = requestUrl.searchParams.get('next') ?? '/employee/profile'

  if (code) {
    const cookieStore = cookies()
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', requestUrl.origin))
    }
  }

  // Invite and signup flows → welcome / onboarding page
  if (type === 'invite' || type === 'signup') {
    return NextResponse.redirect(new URL('/employee/welcome', requestUrl.origin))
  }

  // Everything else (password reset, etc.)
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
