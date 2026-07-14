export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import OrgDirectory from '@/components/org-chart/OrgDirectory'
import { type OrgEmployee } from '@/components/org-chart/OrgChart'

/* The org chart is derived live from the employees table. We select('*') and map
   defensively so the page renders even before migration 023 adds the hierarchy
   columns (it just shows a flat roster until manager_id is populated). */

async function getEmployees(): Promise<OrgEmployee[]> {
  const { data } = await supabaseAdmin.from('employees').select('*').order('name')
  return (data || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((e: any) => e.is_active !== false)
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
    }))
}

export default async function OrgChartPage() {
  const [admin, employees] = await Promise.all([getAdminUser(), getEmployees()])
  return (
    // flex-1 fills the layout column (viewport minus the mobile top bar) — a
    // hard h-screen would overflow by the bar's 56px and clip the canvas
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <OrgDirectory employees={employees} canEdit title="Org Chart" adminName={admin?.displayName || 'Admin'} />
    </div>
  )
}
