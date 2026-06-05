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

  // If the auth user has no employee row yet (e.g. invite not fully set up),
  // sign them out so the middleware doesn't loop them back here
  if (!employee) {
    await supabase.auth.signOut()
    redirect('/employee/login')
  }

  return <EmployeeShell employee={employee}>{children}</EmployeeShell>
}
