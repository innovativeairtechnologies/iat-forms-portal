import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound, redirect } from 'next/navigation'
import EmployeeDetailClient from './EmployeeDetailClient'
import { getAdminUser } from '@/lib/admin-auth'
import { normalizeRole, type StaffRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EmployeeDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [{ data: employee }, { data: requests }, { data: profile }, admin] = await Promise.all([
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
    getAdminUser(),
  ])

  if (!employee) notFound()

  const normalized = normalizeRole(profile?.role)
  // Customers also carry an employees row — never render the staff role editor for
  // one. It coerces them to 'production' and one save locks them out of /customer;
  // send the admin to the customer record instead.
  if (normalized === 'customer') redirect('/admin/customers')
  const currentRole: StaffRole = normalized ?? 'production'

  return (
    <EmployeeDetailClient
      employee={employee}
      requests={requests || []}
      currentRole={currentRole}
      currentAdminId={admin?.user.id ?? null}
    />
  )
}
