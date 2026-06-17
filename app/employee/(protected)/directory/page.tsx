export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import DirectoryView from './DirectoryView'
import type { OrgEmployee } from '@/components/org-chart/OrgChart'

/* Directory = the org chart (with a list toggle). Rendered server-side through
   the service-role client (read-only) and handed to the client view, so it needs
   no extra RLS and gets the hierarchy fields the chart draws from. select('*')
   + defensive mapping → renders even before migration 023 lands (flat roster). */

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

export default async function DirectoryPage() {
  const employees = await getEmployees()
  return <DirectoryView employees={employees} />
}
