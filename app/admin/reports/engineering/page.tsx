export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { RANGES, type RangeKey } from '@/lib/report-shared'
import { buildEngReport } from '@/lib/eng-report'
import EngReportClient from './EngReportClient'

/* /admin/reports/engineering — the leadership report.
 *
 * Gated twice, like every other report. The middleware maps /admin/reports →
 * `reports` in ADMIN_PATH_PERMS and this page checks the same perm again: an
 * unmapped /admin/* path falls back to `dashboard`, which every scoped role
 * holds, so a future edit to the matcher that dropped the prefix would open the
 * whole department's per-person performance rather than failing closed.
 *
 * ⚠️ `reports` is admin-only BY OMISSION — it appears in no scoped role's
 * defaults and no migration seeds it. That is deliberate here: this report scores
 * named people on on-time delivery, which is a narrower trust boundary than
 * `engineering_jobs` (the working board). Grant it per person from
 * /admin/permissions when James or leadership need it.
 */
export default async function EngineeringReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports')) notFound()

  const { range } = await searchParams
  const key: RangeKey = RANGES.some(r => r.key === range) ? (range as RangeKey) : '12m'

  return <EngReportClient report={await buildEngReport(key)} />
}
