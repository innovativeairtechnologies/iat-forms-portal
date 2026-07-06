import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/* Shared building blocks for the admin *detail* pages (submission + ticket), so
   they stay visually consistent and match the operations dashboard's language:
   zinc surfaces, rounded-xl cards, emerald accents, a sticky breadcrumb top bar.
   Pure presentational (no hooks) → usable from both server and client components. */

export type Crumb = { label: string; href?: string }

/** Sticky breadcrumb bar matching /admin and /admin/audit. `children` → right side. */
export function DetailTopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[13px] min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700 flex-shrink-0" />}
            {c.href ? (
              <Link href={c.href} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0">
                {c.label}
              </Link>
            ) : (
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{c.label}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex-1" />
      {children}
    </div>
  )
}

/** Page shell: scroll container + dashboard background + zinc text. */
export function DetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none ${className}`}>
      {children}
    </div>
  )
}

export function CardHead({ title, icon, action }: { title: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-zinc-400 dark:text-zinc-500 flex-shrink-0">{icon}</span>}
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{title}</h3>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

/** A label/value row for the right-rail "Details" summaries. */
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-2.5">
      <span className="text-[12px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200 text-right min-w-0 break-words">{children}</span>
    </div>
  )
}

/** A compact label/value row for card bodies — label in a fixed-width left
 *  column, value flowing right on the same line. Used inside a padded wrapper
 *  (e.g. `<div className="px-5 py-1">`) so rows only need their own vertical
 *  rhythm + divider. Shared by the ticket and submission detail pages so short
 *  answers read as a dense, scannable list rather than one row per screen. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
      <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1 min-w-0 break-words">{children}</span>
    </div>
  )
}
