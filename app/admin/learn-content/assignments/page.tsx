import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAssignmentReports, getAssignableStaff } from '@/lib/learn-assignments'
import AssignmentsClient from '@/components/learn/admin/AssignmentsClient'

export const dynamic = 'force-dynamic'

/* Required training + completion reporting.

   Sits under /admin/learn-content, so it inherits that layout's strict
   getAdminUser() gate and the `learn_admin` entry in ADMIN_PATH_PERMS — no new
   permission, and no route that could be reached without one. */

export default async function AssignmentsPage() {
  const [reports, staff, { data: cats }, { data: mods }] = await Promise.all([
    getAssignmentReports(),
    getAssignableStaff(),
    supabaseAdmin.from('learn_categories').select('id, name, display_order').order('display_order'),
    supabaseAdmin.from('learn_modules').select('id, category_id, title, display_order')
      .eq('is_published', true).order('display_order'),
  ])

  const catName = new Map((cats ?? []).map(c => [c.id, c.name]))

  // Categories first (the broader ask), then subjects grouped under theirs.
  const scopes = [
    ...(cats ?? []).map(c => ({ type: 'category' as const, id: c.id, label: `${c.name} (whole category)`, group: 'Category' })),
    ...(mods ?? []).map(m => ({ type: 'module' as const, id: m.id, label: m.title, group: catName.get(m.category_id) ?? 'Subject' })),
  ]

  return <AssignmentsClient reports={reports} staff={staff} scopes={scopes} />
}
