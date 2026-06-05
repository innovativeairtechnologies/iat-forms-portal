import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import EmployeeShell from './EmployeeShell'

export const dynamic = 'force-dynamic'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/employee/login')

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!employee) redirect('/employee/login')

  return <EmployeeShell employee={employee}>{children}</EmployeeShell>
}
