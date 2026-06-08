import { supabaseAdmin } from '@/lib/supabase-admin'
import EmployeesClient from './EmployeesClient'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const [{ data: employees }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('employees').select('*').order('name'),
    supabaseAdmin.from('profiles').select('id, role'),
  ])

  // Merge profiles.role into each employee record
  const roleMap = Object.fromEntries((profiles || []).map(p => [p.id, p.role as 'admin' | 'employee']))
  const employeesWithRole = (employees || []).map(e => ({
    ...e,
    role: roleMap[e.id] ?? 'employee',
  }))

  return <EmployeesClient employees={employeesWithRole} />
}
