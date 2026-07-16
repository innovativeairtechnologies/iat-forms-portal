export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import AccrualClient from './AccrualClient'

export default async function AccrualPage() {
  const [
    { data: employees },
    { data: log },
    { data: tiers },
    { data: config },
    customers,
  ] = await Promise.all([
    // Customers hold an employees row (see lib/staff.ts) and are dropped below —
    // they were showing up here with editable PTO/sick balances.
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
    getCustomerIds(),
  ])

  return (
    <AccrualClient
      employees={(employees || []).filter(e => !customers.has(e.id))}
      recentLog={log || []}
      tiers={tiers || []}
      config={config?.[0] ?? null}
    />
  )
}
