import { supabaseAdmin } from '@/lib/supabase-admin'
import { warrantyState, isExpiringSoon } from '@/lib/equipment'
import TicketsQueueClient from './TicketsQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminTicketsPage() {
  const [{ data: tickets }, { data: equipment }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*, owner:employees(id, name)').order('created_at', { ascending: false }),
    supabaseAdmin.from('equipment').select('serial_number, ship_date, warranty_months, warranty_end'),
  ])

  // serial → warranty state, for an at-intake badge in the queue
  const warrantyBySerial: Record<string, 'in' | 'expiring' | 'out' | 'unknown'> = {}
  for (const e of equipment ?? []) {
    const s = warrantyState(e)
    warrantyBySerial[e.serial_number] = s === 'in' && isExpiringSoon(e) ? 'expiring' : s
  }

  return <TicketsQueueClient tickets={tickets || []} warrantyBySerial={warrantyBySerial} />
}
