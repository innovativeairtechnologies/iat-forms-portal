'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { TopBarSearch, TopBarBell } from './TopBarActions'
import DashboardPresetPicker from './DashboardPresetPicker'
import type { Preset } from './dashboard-presets'

/* ────────────────────────────────────────────────────────────────────────────
   AdminTopBar — the shared operations top bar.

   Lifted out of the dashboard page so EVERY /admin/* page carries the same
   chrome: breadcrumb · search · (page-specific actions) · notification bell ·
   profile avatar. Rendered once from app/admin/layout.tsx, above each page's
   own scroll container.

   The "page-specific actions" slot is contextual: on the dashboard it holds the
   layout view-switcher (DashboardPresetPicker); on every other page it's empty
   for now — the slot is the hook for per-page actions later.

   Desktop only (md+), matching PortalTopBar. On mobile the AdminSidebar's own
   fixed bar (logo + hamburger) is the top chrome, so we don't stack two bars.
   ──────────────────────────────────────────────────────────────────────────── */

export type Crumb = { label: string; href?: string }

// Route → breadcrumb map. Longest matching prefix wins, so
// /admin/requests/pto beats /admin/requests beats /admin. Mirrors the sidebar
// section names (Operations / Sales / People / Jerry / System).
const ROUTES: { prefix: string; section: string; label: string }[] = [
  // Operations
  { prefix: '/admin/submissions',     section: 'Operations', label: 'Submissions' },
  { prefix: '/admin/tickets',         section: 'Operations', label: 'Tickets' },
  { prefix: '/admin/troubleshooting', section: 'Operations', label: 'Troubleshooting' },
  { prefix: '/admin/forms',           section: 'Operations', label: 'Forms' },
  { prefix: '/admin/equipment',       section: 'Operations', label: 'Equipment' },
  { prefix: '/admin/tool-crib',       section: 'Operations', label: 'Tool Crib' },
  { prefix: '/admin/production',      section: 'Operations', label: 'Production Board' },
  { prefix: '/admin/srv',             section: 'Operations', label: 'SRV Form' },
  { prefix: '/admin/gantt',           section: 'Operations', label: 'Gantt' },
  // Sales
  { prefix: '/admin/deals',           section: 'Sales',   label: 'CRM' },
  { prefix: '/admin/projected-sales', section: 'Sales',   label: 'Performance' },
  { prefix: '/admin/customers',       section: 'Sales',   label: 'Customers' },
  { prefix: '/admin/presentations',   section: 'Sales',   label: 'Presentations' },
  // People
  { prefix: '/admin/employees',       section: 'People',  label: 'Accounts' },
  { prefix: '/admin/org-chart',       section: 'People',  label: 'Org Chart' },
  { prefix: '/admin/employee-forms',  section: 'People',  label: 'Employee Forms' },
  { prefix: '/admin/requests/pto',    section: 'People',  label: 'PTO' },
  { prefix: '/admin/requests/sick',   section: 'People',  label: 'Sick Time' },
  { prefix: '/admin/requests',        section: 'People',  label: 'Requests' },
  { prefix: '/admin/schedule',        section: 'People',  label: 'Scheduling' },
  { prefix: '/admin/scheduling',      section: 'People',  label: 'Scheduling' },
  { prefix: '/admin/accrual',         section: 'People',  label: 'Accrual' },
  // Jerry
  { prefix: '/admin/customer-jerry',  section: 'Jerry',   label: 'Customer Jerry' },
  { prefix: '/admin/jerry',           section: 'Jerry',   label: 'Ask Jerry' },
  { prefix: '/admin/knowledge',       section: 'Jerry',   label: "Jerry's Brain" },
  // System
  { prefix: '/admin/home-content',    section: 'System',  label: 'Company Home' },
  { prefix: '/admin/audit',           section: 'System',  label: 'Audit Log' },
  { prefix: '/admin/permissions',     section: 'System',  label: 'Permissions' },
  // US Rotors
  { prefix: '/admin/us-rotors',       section: 'US Rotors', label: 'Orders' },
  // Standalone
  { prefix: '/admin/tools',           section: 'Operations', label: 'Internal Apps' },
  { prefix: '/admin/home',            section: 'Company',    label: 'Home' },
  { prefix: '/admin/profile',         section: 'Account',    label: 'Profile' },
  // Dashboard (shortest — matched last)
  { prefix: '/admin',                 section: 'Operations', label: 'Overview' },
]

function crumbsFor(pathname: string): Crumb[] {
  const hit = ROUTES
    .filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (!hit) return [{ label: 'Operations' }]
  return [{ label: hit.section }, { label: hit.label }]
}

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
  const trail = crumbs ?? crumbsFor(pathname)
  const withPresets = showPresets ?? pathname === '/admin'
  const initial = (displayName || 'A').charAt(0).toUpperCase()

  return (
    <div className="hidden md:flex flex-shrink-0 items-center gap-2.5 px-5 h-14 border-b border-hairline bg-canvas">
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
