import { supabaseAdmin } from '@/lib/supabase-admin'
import CustomersClient from './CustomersClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const [{ data: customers }, { data: equipment }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('equipment').select('id, customer_id'),
  ])

  // Units owned per customer → the "Units" column.
  const unitCounts: Record<string, number> = {}
  for (const e of equipment ?? []) {
    if (e.customer_id) unitCounts[e.customer_id] = (unitCounts[e.customer_id] ?? 0) + 1
  }

  const rows = (customers ?? []).map((c) => ({ ...c, unit_count: unitCounts[c.id] ?? 0 }))

  return <CustomersClient customers={rows} />
}
