export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LifeBuoy, FileText, TrendingUp, Package, Users, Wrench, Clock, ArrowRight, type LucideIcon } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import type { Perm } from '@/lib/roles'
import { ListCardPage, ListCard, CardHead } from '@/components/admin/list-card'

/* /admin/reports — the index. Adding a report is an entry here plus a child in
   the sidebar's Reports group; the section exists so neither needs a restructure.

   Each blurb says what the report ANSWERS, not what it contains. "Volume,
   backlog, timings" tells a reader nothing about whether to open it.

   `perm` controls visibility: the actor must hold that perm to see the entry.
   All existing reports require `reports`; the time-off report requires `accrual`
   so HR staff (who have `accrual` but not necessarily all `reports`) see only it. */

const REPORTS: { href: string; icon: LucideIcon; title: string; blurb: string; perm: Perm }[] = [
  {
    href: '/admin/reports/tickets',
    icon: LifeBuoy,
    title: 'Support Tickets',
    blurb: 'Is the backlog growing, how long do customers wait, how often does work come back, and which equipment keeps generating it.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/rfq',
    icon: FileText,
    title: 'Quote Requests',
    blurb: 'What people are asking us to solve, how fast we pick it up, and whether anything is sitting unclaimed.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/sales',
    icon: TrendingUp,
    title: 'Sales Pipeline',
    blurb: 'What is quoted, what it is worth once weighted by confidence, whose it is, and when it is expected to land.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/warranty',
    icon: Package,
    title: 'Installed Base',
    blurb: 'What is out there, what is still covered, and which units come off warranty in the next 90 days.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/tools',
    icon: Wrench,
    title: 'Tools & Inventory',
    blurb: 'What is checked out and to whom, what is past due, and how long things have been off the shelf.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/adoption',
    icon: Users,
    title: 'Portal Adoption',
    blurb: 'Who actually uses what we built, who has never signed in, and how the move to Microsoft sign-in is going.',
    perm: 'reports',
  },
  {
    href: '/admin/reports/time-off',
    icon: Clock,
    title: 'Time Off',
    blurb: 'Current PTO and sick balances for every staff employee, accrual rates by tenure tier, and who is approaching or at their cap.',
    perm: 'accrual',
  },
]

export default async function ReportsIndexPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports') && !actor?.can('accrual')) notFound()

  const visible = REPORTS.filter(r => actor!.can(r.perm))

  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Reports" count={`${visible.length} available`} />
        <div className="divide-y divide-hairline-soft">
          {visible.map(r => (
            <Link
              key={r.href}
              href={r.href}
              className="flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-surface-soft"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                <r.icon size={18} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-ink">{r.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{r.blurb}</span>
              </span>
              <ArrowRight size={15} className="flex-shrink-0 text-ink-faint" />
            </Link>
          ))}
        </div>
      </ListCard>
    </ListCardPage>
  )
}
