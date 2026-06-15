import { supabaseAdmin } from '@/lib/supabase-admin'
import EquipmentClient from './EquipmentClient'

export const dynamic = 'force-dynamic'

export default async function EquipmentPage() {
  const [{ data: equipment }, { data: tix }] = await Promise.all([
    supabaseAdmin.from('equipment').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('tickets').select('serial_number, created_at').order('created_at', { ascending: false }),
  ])

  // Latest ticket per serial = last service date (drives the "due for PM" view).
  const lastBySerial: Record<string, string> = {}
  for (const t of tix ?? []) {
    if (t.serial_number && !(t.serial_number in lastBySerial)) lastBySerial[t.serial_number] = t.created_at
  }

  const rows = (equipment ?? []).map(e => ({ ...e, last_service_at: lastBySerial[e.serial_number] ?? null }))

  return <EquipmentClient equipment={rows} />
}
