import { supabaseAdmin } from '@/lib/supabase-admin'
import ProjectedSalesClient, { type ProjectedSale, type SyncMeta } from './ProjectedSalesClient'

export const dynamic = 'force-dynamic'

/* /admin/projected-sales — read-only mirror of the Dryware "projected sales by
   project" reporting API. The page reads whatever the last sync wrote into
   projected_sales; the "Sync now" button (client) refreshes it on demand. Gated
   by middleware on the `deals` permission (Sales + admin) — see ADMIN_PATH_PERMS. */

export default async function ProjectedSalesPage() {
  const [{ data: projects }, { data: sync }] = await Promise.all([
    supabaseAdmin.from('projected_sales').select('*').order('quote_total', { ascending: false }),
    supabaseAdmin.from('projected_sales_sync').select('*').maybeSingle(),
  ])
  return (
    <ProjectedSalesClient
      initialProjects={(projects ?? []) as ProjectedSale[]}
      initialSync={(sync ?? null) as SyncMeta}
    />
  )
}
