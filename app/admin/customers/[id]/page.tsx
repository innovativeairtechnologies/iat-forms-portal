import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import CustomerDetailClient from './CustomerDetailClient'
import type { Equipment } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const { data: customer } = await supabaseAdmin.from('customers').select('*').eq('id', id).single()
  if (!customer) notFound()

  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
  const equipment = (equipmentData || []) as Equipment[]

  // Does this customer have a portal login? (drives the action labels)
  const { count: loginCount } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)
    .eq('role', 'customer')

  // Support history tied to this customer (by login email, their serials, or
  // an explicit customer_id link) — same matching the /customer dashboard
  // uses, just counted here. troubleshooting_intakes has no customer_id (it's
  // historical-only since migration 027), so it stays email/serial-only.
  const email = (customer.contact_email || '').toLowerCase()
  const serials = equipment.map((e) => e.serial_number).filter(Boolean)
  const orParts: string[] = []
  if (email) orParts.push(`customer_email.ilike.${email}`)
  if (serials.length) orParts.push(`serial_number.in.(${serials.join(',')})`)
  const orFilter = orParts.join(',')
  const ticketOrFilter = [...orParts, `customer_id.eq.${id}`].join(',')

  const [{ count: tc }, { count: ic }] = await Promise.all([
    supabaseAdmin.from('tickets').select('id', { count: 'exact', head: true }).or(ticketOrFilter),
    orFilter
      ? supabaseAdmin.from('troubleshooting_intakes').select('id', { count: 'exact', head: true }).or(orFilter)
      : Promise.resolve({ count: 0 }),
  ])
  const requestCount = (tc ?? 0) + (ic ?? 0)

  return (
    <CustomerDetailClient
      customer={customer}
      equipment={equipment}
      hasLogin={(loginCount ?? 0) > 0}
      requestCount={requestCount}
    />
  )
}
