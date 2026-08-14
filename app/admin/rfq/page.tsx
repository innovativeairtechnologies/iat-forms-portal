import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import RfqClient from './RfqClient'

/* /admin/rfq — the inbound Request for Quote queue (migration 087).
 *
 * Gated on 'deals', the same perm as the sales pipeline, and mapped in
 * ADMIN_PATH_PERMS so the page and middleware can never disagree. Note an
 * UNMAPPED /admin/* path is not fail-closed — it falls back to 'dashboard',
 * which every scoped role holds — so this entry is what keeps a stranger's
 * contact details away from HR, marketing and production.
 */

export const dynamic = 'force-dynamic'

export default async function AdminRfqPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('deals')) redirect('/admin')

  // The list never needs `data` — it is the entire wizard state and is only read
  // on the detail page.
  const { data } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, track, application_label, company, contact_name, email, project_name, location, date_required, status, is_read, summary, created_at')
    .order('created_at', { ascending: false })

  return <RfqClient rows={data ?? []} />
}
