export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import SooClient, { type SooListRow } from './SooClient'

/* /admin/soo — Sequence of Operation documents.
 *
 * Belt-and-braces gate: middleware already maps this prefix to the `soo` perm in
 * ADMIN_PATH_PERMS, but the page checks too, the same way the studios do. */

export default async function SooPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('soo')) redirect('/admin')

  const { data } = await supabaseAdmin
    .from('soo_documents')
    .select('id, title, customer_name, project_name, unit_tag, status, library_version, assembled, assembled_at, updated_at')
    .order('updated_at', { ascending: false })

  const rows: SooListRow[] = (data ?? []).map((d) => {
    const a = d.assembled as { sections?: { clauses: unknown[] }[]; excluded?: unknown[]; blocked?: unknown[] } | null
    return {
      id: d.id,
      title: d.title,
      customer_name: d.customer_name,
      project_name: d.project_name,
      unit_tag: d.unit_tag,
      status: d.status,
      library_version: d.library_version,
      assembled_at: d.assembled_at,
      updated_at: d.updated_at,
      excluded: a?.excluded?.length ?? 0,
      blocked: a?.blocked?.length ?? 0,
    }
  })

  return <SooClient rows={rows} />
}
