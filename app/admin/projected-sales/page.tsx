import { supabaseAdmin } from '@/lib/supabase-admin'
import ProjectedSalesClient, { type ProjectedSale, type SyncMeta } from './ProjectedSalesClient'

export const dynamic = 'force-dynamic'

/* /admin/projected-sales — read-only mirror of the Dryware "projected sales by
   project" reporting API. The page reads whatever the last sync wrote into
   projected_sales; the "Sync now" button (client) refreshes it on demand. Gated
   by middleware on the `deals` permission (Sales + admin) — see ADMIN_PATH_PERMS. */

export default async function ProjectedSalesPage() {
  const [{ data: projects }, { data: sync }, dealsQ] = await Promise.all([
    supabaseAdmin.from('projected_sales').select('*').order('quote_total', { ascending: false }),
    supabaseAdmin.from('projected_sales_sync').select('*').maybeSingle(),
    // 366 keyed deals today. NOTE: PostgREST's own db-max-rows (Supabase "Max
    // rows", 1000 by default) caps this regardless of any .limit() we ask for —
    // past that it truncates SILENTLY and links just stop appearing for some
    // rows. If deals approaches 1000, this needs range-paging, not a bigger
    // number here.
    supabaseAdmin.from('deals').select('id, dryware_key').not('dryware_key', 'is', null),
  ])

  /* deals.dryware_key → deals.id, so the Performance list can link across to the
     CRM Board. The two tables have no FK; the only tie is the computed key
     (customer|project) that materializeDealsFromProjectedSales() writes onto
     `deals`.

     Keyed by dryware_key and NOT by projected_sales.id: that id is regenerated
     for every row on every sync (the table is wiped and re-inserted, and DELETE
     doesn't reset an identity sequence). An id-keyed map goes 100% stale the
     moment someone clicks "Sync now" — the client swaps in freshly-ided rows
     while this server prop still describes the old ones, and every link
     disappears. The key survives that.

     Deliberately non-fatal: if the query errors (e.g. migration 063 not applied
     in some environment), the map is empty and rows simply show no link — never
     a broken page over a convenience affordance. */
  const dealIdByKey: Record<string, string> = {}
  for (const d of (dealsQ.data ?? []) as { id: string; dryware_key: string | null }[]) {
    if (d.dryware_key) dealIdByKey[d.dryware_key] = d.id
  }

  return (
    <ProjectedSalesClient
      initialProjects={(projects ?? []) as ProjectedSale[]}
      initialSync={(sync ?? null) as SyncMeta}
      dealIdByKey={dealIdByKey}
    />
  )
}
