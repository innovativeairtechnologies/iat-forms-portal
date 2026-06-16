import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/* Shared sticky top bar for portal dashboards — mirrors the /admin operations
   top bar (breadcrumb on the left, actions slot on the right). Sits above each
   page's own scroll container, so it stays put while content scrolls. Desktop
   only (md+); mobile uses the shell's hamburger bar. Presentational. */

export type Crumb = { label: string; href?: string }

export function PortalTopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="hidden md:flex flex-shrink-0 items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="flex-shrink-0 text-zinc-300 dark:text-zinc-700" />}
            {c.href ? (
              <Link href={c.href} className="flex-shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{c.label}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex-1" />
      {children}
    </div>
  )
}
