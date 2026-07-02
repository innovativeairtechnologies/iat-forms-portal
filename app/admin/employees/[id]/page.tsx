import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import EmployeeDetailClient from './EmployeeDetailClient'
import { normalizeRole, type StaffRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EmployeeDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [{ data: employee }, { data: requests }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('employees').select('*').eq('id', params.id).single(),
    supabaseAdmin
      .from('time_off_requests')
      .select('*')
      .eq('employee_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', params.id)
      .single(),
  ])

  if (!employee) notFound()

  const normalized = normalizeRole(profile?.role)
  const currentRole: StaffRole = normalized && normalized !== 'customer' ? normalized : 'production'

  return (
    <EmployeeDetailClient
      employee={employee}
      requests={requests || []}
      currentRole={currentRole}
    />
  )
}
