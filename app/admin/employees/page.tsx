import { supabaseAdmin } from '@/lib/supabase-admin'
import EmployeesClient from './EmployeesClient'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('*')
    .order('name')

  return <EmployeesClient employees={employees || []} />
}
