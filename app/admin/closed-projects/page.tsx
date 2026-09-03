import { supabaseAdmin } from '@/lib/supabase-admin'
import ClosedProjectsClient, { type ClosedProject, type SyncMeta } from './ClosedProjectsClient'

export const dynamic = 'force-dynamic'

/* /admin/closed-projects — read-only mirror of the Dryware "closed projects"
   (won-only) reporting API. The page reads whatever the last sync wrote into
   closed_projects; the "Sync now" button (client) refreshes it on demand and
   also transitions each matching CRM deal to stage='won'. Gated by middleware
   on the `deals` permission (Sales + admin) — see ADMIN_PATH_PERMS. */

export default async function ClosedProjectsPage() {
  const [{ data: projects }, { data: sync }, dealsQ] = await Promise.all([
    supabaseAdmin.from('closed_projects').select('*').order('actual_closing_date', { ascending: false }),
    supabaseAdmin.from('closed_projects_sync').select('*').maybeSingle(),
    // Same cross-link pattern as the Performance page (app/admin/projected-sales/
    // page.tsx) — see its comment for why this is keyed by dryware_key, not id.
    supabaseAdmin.from('deals').select('id, dryware_key').not('dryware_key', 'is', null),
  ])

  const dealIdByKey: Record<string, string> = {}
  for (const d of (dealsQ.data ?? []) as { id: string; dryware_key: string | null }[]) {
    if (d.dryware_key) dealIdByKey[d.dryware_key] = d.id
  }

  return (
    <ClosedProjectsClient
      initialProjects={(projects ?? []) as ClosedProject[]}
      initialSync={(sync ?? null) as SyncMeta}
      dealIdByKey={dealIdByKey}
    />
  )
}
