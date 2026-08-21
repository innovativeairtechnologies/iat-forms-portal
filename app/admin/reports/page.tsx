export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LifeBuoy, ArrowRight } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { ListCardPage, ListCard, CardHead } from '@/components/admin/list-card'

/* /admin/reports — the index. One report today; the section exists so the next
   one is an entry in this array rather than another nav restructure. */

const REPORTS = [
  {
    href: '/admin/reports/tickets',
    icon: LifeBuoy,
    title: 'Support Tickets',
    blurb: 'Volume, backlog, how long tickets take to close, how often they come back, and which equipment keeps generating them.',
  },
]

export default async function ReportsIndexPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports')) notFound()

  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Reports" count={`${REPORTS.length} available`} />
        <div className="divide-y divide-hairline-soft">
          {REPORTS.map(r => (
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
