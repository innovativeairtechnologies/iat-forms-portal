'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { TopBarSearch, TopBarBell } from './TopBarActions'
import DashboardPresetPicker from './DashboardPresetPicker'
import type { Preset } from './dashboard-presets'
import { crumbsFor, type Crumb } from './crumbs'
import { usePageChromeTail } from './PageChrome'

/* ────────────────────────────────────────────────────────────────────────────
   AdminTopBar — the shared operations top bar.

   Lifted out of the dashboard page so EVERY /admin/* page carries the same
   chrome: breadcrumb · (page actions) · search · notification bell · profile
   avatar. Rendered once from app/admin/layout.tsx, above each page's own scroll
   container.

   Detail/editor pages feed their record crumb + action buttons UP into this one
   bar via <PageChrome> (see PageChrome.tsx), so there is never a second stacked
   breadcrumb bar. The record crumb arrives through usePageChromeTail(); the
   action buttons are portaled into the #admin-topbar-actions slot below.

   Desktop only (md+), matching PortalTopBar. On mobile the AdminSidebar's own
   fixed bar is the top chrome (and PageChrome renders its own mobile bar), so we
   don't stack two bars.
   ──────────────────────────────────────────────────────────────────────────── */

// Crumb + the Section › Page derivation now live in ./crumbs (shared with
// PageChrome). Re-exported for any existing importers.
export type { Crumb }

interface Props {
  displayName: string
  unreadCount: number
  ticketCount: number
  preset: Preset
  /** Override the derived breadcrumb (used by the standalone preview route). */
  crumbs?: Crumb[]
  /** Override where the view-switcher shows (default: the dashboard only). */
  showPresets?: boolean
}

export default function AdminTopBar({ displayName, unreadCount, ticketCount, preset, crumbs, showPresets }: Props) {
  const pathname = usePathname()
  const tail = usePageChromeTail()
  // Company Home (/admin/home) renders its own HomeTopBar, so suppress the
  // operations bar there — otherwise the page shows two stacked top bars.
  if (pathname === '/admin/home') return null
  // Explicit override (preview route) wins; otherwise derive Section › Page and
  // append the record crumb(s) a detail page fed up through <PageChrome>.
  const trail = crumbs ?? [...crumbsFor(pathname), ...(tail ?? [])]
  // Layout presets retired: the admin dashboard is now the customizable card
  // grid (add/remove/reorder/resize), so the old view-switcher no longer applies.
  const withPresets = showPresets ?? false
  const initial = (displayName || 'A').charAt(0).toUpperCase()

  return (
    <div className="relative z-30 hidden md:flex flex-shrink-0 items-center gap-2.5 px-5 h-14 border-b border-hairline bg-canvas">
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {trail.map((c, i) => {
          const last = i === trail.length - 1
          return (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight size={13} className="flex-shrink-0 text-ink-faint" />}
              {c.href && !last ? (
                <Link href={c.href} className="flex-shrink-0 text-ink-muted hover:text-ink transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? 'truncate font-semibold text-ink' : 'flex-shrink-0 text-ink-muted'}>
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Page-specific action buttons, portaled in by <PageChrome>. `empty:hidden`
          keeps it from taking layout space on list/overview pages. */}
      <div id="admin-topbar-actions" className="flex items-center gap-2 empty:hidden" />

      <TopBarSearch />
      {withPresets && <DashboardPresetPicker current={preset} />}
      <TopBarBell unreadCount={unreadCount} ticketCount={ticketCount} />
      <Link
        href="/admin/profile"
        title={displayName || 'Profile'}
        className="w-8 h-8 rounded-full bg-ink flex items-center justify-center flex-shrink-0 hover:opacity-85 transition-opacity"
      >
        <span className="text-[12px] font-semibold text-canvas">{initial}</span>
      </Link>
    </div>
  )
}
