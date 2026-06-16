export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import OrgChart, { type OrgEmployee } from './OrgChart'

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
  return <OrgChart employees={employees} adminName={admin?.displayName || 'Admin'} />
}
