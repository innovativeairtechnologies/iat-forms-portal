import { supabaseAdmin } from '@/lib/supabase-admin'
import EmployeesClient from './EmployeesClient'
import { normalizeRole, type StaffRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const [{ data: employees }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('employees').select('*').order('name'),
    supabaseAdmin.from('profiles').select('id, role'),
  ])

  // Customers ARE in the employees table — handle_new_user() (migration 001)
  // fires for every auth user, including the ones the customer-invite route
  // creates, and nothing removes the row (see lib/staff.ts). They must be
  // dropped BEFORE the role merge below, not folded into it: this page edits
  // roles, and rendering a customer as `production` invited an admin to "correct"
  // them into staff — which writes profiles.role and locks them out of their own
  // portal. Customers are managed on /admin/customers.
  const customerIds = new Set((profiles || []).filter(p => p.role === 'customer').map(p => p.id))

  // Merge the normalized profiles.role into each remaining (staff) record.
  // Unknown or missing → base `production` tier.
  const roleMap = Object.fromEntries(
    (profiles || [])
      .filter(p => !customerIds.has(p.id))
      .map(p => [p.id, (normalizeRole(p.role) ?? 'production') as StaffRole])
  )
  const employeesWithRole = (employees || [])
    .filter(e => !customerIds.has(e.id))
    .map(e => ({
      ...e,
      role: roleMap[e.id] ?? ('production' as StaffRole),
    }))

  return <EmployeesClient employees={employeesWithRole} />
}
