import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import ProposalsClient from './ProposalsClient'

/* /admin/proposals — the review queue.
 *
 * Perm-gated the same way middleware gates the path, so the page and the API can
 * never disagree.
 */

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('proposals')) redirect('/admin')

  // Only the columns the list renders — the sizing snapshot and the prose are
  // large jsonb blobs and have no business in a list payload.
  const { data } = await supabaseAdmin
    .from('proposals')
    .select('id, title, customer_name, job_name, status, verification, sizing_result, updated_at')
    .order('updated_at', { ascending: false })

  return <ProposalsClient proposals={data ?? []} />
}
