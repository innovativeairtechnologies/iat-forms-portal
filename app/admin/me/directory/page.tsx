export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import OrgDirectory from '@/components/org-chart/OrgDirectory'
import { type OrgEmployee } from '@/components/org-chart/OrgChart'

/* Self-service team directory in the admin shell — open to every admin-surface
   role via OPEN_ADMIN_PREFIXES ('/admin/me'). Read-only: OrgDirectory defaults to
   canEdit=false, so this is deliberately NOT /admin/org-chart (which is editable
   and stays gated behind the org_chart perm). Customers are excluded (they carry
   an employees row too — see lib/staff.ts). */

async function getEmployees(): Promise<OrgEmployee[]> {
  const [{ data }, customers] = await Promise.all([
    supabaseAdmin.from('employees').select('*').order('name'),
    getCustomerIds(),
  ])
  return (data || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((e: any) => e.is_active !== false && !customers.has(e.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => ({
      id: e.id,
      name: e.name || 'Unnamed',
      email: e.email ?? null,
      avatar_url: e.avatar_url ?? null,
      job_title: e.job_title ?? null,
      department: e.department ?? null,
      phone: e.phone ?? null,
      bio: e.bio ?? null,
      hire_date: e.hire_date ?? null,
      manager_id: e.manager_id ?? null,
      interests: Array.isArray(e.interests) ? e.interests : [],
      org_visible: e.org_visible !== false,
      org_sort: typeof e.org_sort === 'number' ? e.org_sort : null,
      org_x: typeof e.org_x === 'number' ? e.org_x : null,
      org_y: typeof e.org_y === 'number' ? e.org_y : null,
    }))
}

export default async function SelfServiceDirectoryPage() {
  const employees = await getEmployees()
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <OrgDirectory employees={employees} title="Directory" />
    </div>
  )
}
