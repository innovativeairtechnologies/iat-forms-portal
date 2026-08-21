export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { RANGES, type RangeKey } from '@/lib/report-shared'
import { buildWarrantyReport } from '@/lib/warranty-report'
import WarrantyReportClient from './WarrantyReportClient'

/* Gated twice, deliberately: ADMIN_PATH_PERMS maps /admin/reports → `reports`,
   and this checks the same perm again. An unmapped /admin/* path falls back to
   `dashboard`, which every scoped role holds, so the second check is what makes
   a future matcher edit fail closed. notFound() rather than a redirect, so an
   unauthorized caller cannot tell "not allowed" from "not a page". */

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('reports')) notFound()

  const { range } = await searchParams
  const key: RangeKey = RANGES.some(r => r.key === range) ? (range as RangeKey) : '12m'
  return <WarrantyReportClient report={await buildWarrantyReport(key)} />
}
