import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, ExternalLink, Presentation, Gauge, Workflow } from 'lucide-react'
import { ListPageHeader } from '@/components/admin/list'
import { TOOL_APPS } from '@/lib/tools'
import type { Perm } from '@/lib/roles'
import { getAdminSurfaceUser } from '@/lib/admin-auth'

/* Admin-side launcher for the internal apps (washdown load, burner guide, duct
   traverse, calculators, card generator) — labeled "Internal Apps" in the nav to
   keep it distinct from the Tool Crib check-out registry. The self-contained HTML
   apps come from the shared catalog (lib/tools.ts), same list the employee page
   shows; they open in a new tab.

   Above them sit the IN-APP tools — Presentations, Sizing Studio, Application
   Diagrams — which are admin routes rather than standalone HTML, so they're
   rendered as internal links and gated on their OWN perm (a `tools` holder
   without `sizing` must not see a dead link). Each was pulled off the sidebar's
   Sales group so every internal tool has one home; the routes and perms are
   unchanged, so bookmarks and the middleware gate still work. */

export const dynamic = 'force-dynamic'

type InternalApp = { href: string; title: string; desc: string; icon: LucideIcon; perm: Perm }

const INTERNAL_APPS: InternalApp[] = [
  {
    href: '/admin/presentations',
    title: 'Presentations',
    desc: 'Build, brand, and manage sales & customer presentation decks.',
    icon: Presentation,
    perm: 'presentations',
  },
  {
    href: '/admin/sizing-studio',
    title: 'Sizing Studio',
    desc: 'Psychrometric unit selection — size a desiccant unit against the space load and plot the process.',
    icon: Gauge,
    perm: 'sizing',
  },
  {
    href: '/admin/diagram-studio',
    title: 'Application Diagrams',
    desc: 'Draw the airflow figures that go into proposals and submittals.',
    icon: Workflow,
    perm: 'diagrams',
  },
]

export default async function AdminToolsPage() {
  // The middleware `tools` gate guarantees an admin-surface user here; the guard
  // is just defensive. `can(...)` reads the live perm matrix per app.
  const admin = await getAdminSurfaceUser()
  const internal = INTERNAL_APPS.filter(a => admin?.can(a.perm) ?? false)
  const count = TOOL_APPS.length + internal.length

  return (
    <div className="flex-1 overflow-auto">
      <ListPageHeader
        overline="Workshop"
        title="Internal Apps"
        count={`${count} internal apps`}
      />

      <div className="p-4 sm:p-8">
        <div className="bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {internal.map(app => {
              const Icon = app.icon
              return (
                <li key={app.href}>
                  <Link
                    href={app.href}
                    className="group grid grid-cols-[1fr_auto] items-center gap-3 px-5 sm:px-6 py-4 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
                        <Icon size={16} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate group-hover:text-[#089447] transition-colors">
                          {app.title}
                        </p>
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                          {app.desc}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-zinc-300 dark:text-zinc-600 group-hover:text-[#089447] transition-colors">
                      Open <ChevronRight size={14} />
                    </span>
                  </Link>
                </li>
              )
            })}
            {TOOL_APPS.map(app => {
              const Icon = app.icon
              return (
                <li key={app.title}>
                  <a
                    href={app.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid grid-cols-[1fr_auto] items-center gap-3 px-5 sm:px-6 py-4 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
                        <Icon size={16} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate group-hover:text-[#089447] transition-colors flex items-center gap-2">
                          {app.title}
                          {app.tag && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#089447] bg-[#089447]/10 px-1.5 py-0.5 rounded-full">{app.tag}</span>
                          )}
                        </p>
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{app.desc}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-zinc-300 dark:text-zinc-600 group-hover:text-[#089447] transition-colors">
                      <ExternalLink size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      Open <ChevronRight size={14} />
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
