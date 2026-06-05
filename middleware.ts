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

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect all /employee/* routes except /employee/login
  if (pathname.startsWith('/employee') && pathname !== '/employee/login') {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/employee/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect logged-in users away from the login page
  if (pathname === '/employee/login' && user) {
    const profileUrl = request.nextUrl.clone()
    profileUrl.pathname = '/employee/profile'
    return NextResponse.redirect(profileUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/employee/:path*'],
}
