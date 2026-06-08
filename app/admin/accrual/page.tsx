export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AccrualClient from './AccrualClient'

export default async function AccrualPage() {
  const [{ data: employees }, { data: log }] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, email, job_title, pto_balance, sick_balance, pto_accrual_rate, sick_accrual_rate')
      .order('name'),
    supabaseAdmin
      .from('accrual_log')
      .select('*, employees(name, email)')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <AccrualClient
      employees={employees || []}
      recentLog={log || []}
    />
  )
}
