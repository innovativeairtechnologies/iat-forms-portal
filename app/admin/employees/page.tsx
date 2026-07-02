import { supabaseAdmin } from '@/lib/supabase-admin'
import EmployeesClient from './EmployeesClient'
import { normalizeRole, type StaffRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const [{ data: employees }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('employees').select('*').order('name'),
    supabaseAdmin.from('profiles').select('id, role'),
  ])

  // Merge the normalized profiles.role into each employee record. Customers are
  // never in the employees table, so any staff role normalizes cleanly; unknown
  // → base `production` tier.
  const roleMap = Object.fromEntries(
    (profiles || []).map(p => {
      const r = normalizeRole(p.role)
      return [p.id, (r && r !== 'customer' ? r : 'production') as StaffRole]
    })
  )
  const employeesWithRole = (employees || []).map(e => ({
    ...e,
    role: roleMap[e.id] ?? ('production' as StaffRole),
  }))

  return <EmployeesClient employees={employeesWithRole} />
}
