export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { RANGES, type RangeKey } from '@/lib/report-shared'
import { buildCribReport } from '@/lib/crib-report'
import CribReportClient from './CribReportClient'

/* Gated twice, deliberately: ADMIN_PATH_PERMS maps /admin/reports → `reports`,
   and this checks the same perm again, so a future matcher edit fails closed
   rather than exposing this through the permissive `dashboard` fallback. */

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports')) notFound()

  const { range } = await searchParams
  const key: RangeKey = RANGES.some(r => r.key === range) ? (range as RangeKey) : '12m'
  return <CribReportClient report={await buildCribReport(key)} />
}
