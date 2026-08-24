import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { employeeIdForEmail } from '@/lib/my-employee'
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
    .select('id, reference, track, application_label, company, contact_name, email, project_name, location, date_required, status, is_read, assignee_id, assignee_name, summary, created_at')
    .order('created_at', { ascending: false })

  // Two capabilities the bulk bar needs, resolved here because the client cannot
  // know either:
  //
  //   canDelete — /api/admin/bulk-delete is FULL-ADMIN only, but this page is
  //     gated on `deals`, which sales and engineering also hold. Rendering Delete
  //     for them would offer a button that 403s, which reads as broken rather
  //     than forbidden.
  //   myEmployeeId — "Assign to me" writes an employees.id, and the only join
  //     from an auth user to that row is the email (see lib/my-employee.ts).
  //     Null when the signed-in account has no employees row, which hides the
  //     action rather than sending an assignment nowhere.
  const myEmployeeId = await employeeIdForEmail(admin.user.email)

  return (
    <RfqClient
      rows={data ?? []}
      canDelete={admin.role === 'admin'}
      myEmployeeId={myEmployeeId}
    />
  )
}
