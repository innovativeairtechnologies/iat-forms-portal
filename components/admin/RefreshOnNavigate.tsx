'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Keeps server-rendered admin pages live.
 *
 * `/admin/*` pages are `force-dynamic` and `staleTimes.dynamic: 0` is set, yet
 * the App Router still restores cached RSC on back/forward navigation (staleTimes
 * only governs forward <Link> nav) — so dashboard metrics and the sidebar's
 * unread/ticket badges showed a stale snapshot until a manual refresh.
 *
 * Mounted once in the admin layout, this re-fetches the whole route tree (page +
 * layout) on every in-admin navigation after the first render, and whenever a
 * backgrounded tab is refocused. The initial server render is already fresh, so
 * the first mount is skipped. Renders nothing.
 */
export default function RefreshOnNavigate() {
  const pathname = usePathname()
  const router = useRouter()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    router.refresh()
  }, [pathname, router])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

  return null
}
