export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AccrualClient from './AccrualClient'

export default async function AccrualPage() {
  const [
    { data: employees },
    { data: log },
    { data: tiers },
    { data: config },
  ] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('*')
      .order('name'),
    supabaseAdmin
      .from('accrual_log')
      .select('*, employees(name, email)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('accrual_tiers')
      .select('*')
      .order('sort_order'),
    supabaseAdmin
      .from('accrual_config')
      .select('*')
      .eq('id', 1)
      .limit(1),
  ])

  return (
    <AccrualClient
      employees={employees || []}
      recentLog={log || []}
      tiers={tiers || []}
      config={config?.[0] ?? null}
    />
  )
}
