'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, ArrowUpRight } from 'lucide-react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { initialsOf } from '@/components/admin/list'

/* The company home's own top bar — a clean canvas header (no sidebar). Logo +
   wordmark, a subtle Launch-into-your-workspace link, theme toggle, and the
   signed-in user with Sign Out. `launchHref` is computed per-role on the server
   (homeForRole) and passed in. */

export function HomeTopBar({ name, launchHref }: { name: string; launchHref: string }) {
  const router = useRouter()

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/home" className="flex min-w-0 items-center gap-2.5" aria-label="Company home">
          <Logo size={22} className="flex-shrink-0" />
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">Innovative Air Technologies</span>
            <span className="hidden text-[12px] text-ink-muted sm:inline">Company Home</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={launchHref}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:inline-flex"
          >
            Launch Portal <ArrowUpRight size={14} />
          </Link>

          <ThemeToggle />

          <span className="hidden items-center gap-2 md:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-strong text-[11px] font-semibold text-ink-secondary">
              {initialsOf(name || '?')}
            </span>
            <span className="max-w-[140px] truncate text-[13px] text-ink-secondary">{name}</span>
          </span>

          <button
            onClick={logout}
            title="Sign out"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
