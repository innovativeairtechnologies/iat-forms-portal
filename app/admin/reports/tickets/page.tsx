export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { buildTicketReport, RANGES, type RangeKey } from '@/lib/ticket-report'
import TicketReportClient from './TicketReportClient'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/reports/tickets — support-ticket reporting (server data layer).

   Gated twice, deliberately. The middleware maps /admin/reports → `reports` in
   ADMIN_PATH_PERMS, and this page checks the same perm again before rendering.
   Belt and braces is worth four lines here: an unmapped /admin/* path falls back
   to `dashboard`, which every scoped role holds, so a future edit to the matcher
   that dropped this prefix would silently expose the whole report rather than
   failing closed. The second check makes that impossible.

   notFound() rather than a redirect, so an unauthorized caller cannot tell the
   difference between "not allowed" and "not a page".
   ──────────────────────────────────────────────────────────────────────────── */

export default async function TicketReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports')) notFound()

  const { range } = await searchParams
  const key: RangeKey = RANGES.some(r => r.key === range) ? (range as RangeKey) : '12m'
  const report = await buildTicketReport(key)

  return <TicketReportClient report={report} />
}
