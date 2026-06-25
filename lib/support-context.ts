import { getCustomerUser } from '@/lib/customer-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { SupportCustomerContext } from '@/components/support/EquipmentTicketForm'

// If a portal customer is signed in, returns their account + units so the public
// support form can prefill. Anonymous (or non-customer) visitors → null, and the
// form renders exactly as it does today. Read-only; scoped to the logged-in customer.
export async function getSupportCustomerContext(): Promise<SupportCustomerContext | null> {
  const session = await getCustomerUser()
  if (!session) return null
  const { customerId, customer, displayName, user } = session

  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('id, serial_number, model_number, voltage, location')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  const units = (equipmentData || []).map((e) => ({
    id: e.id as string,
    serial_number: e.serial_number as string,
    model_number: (e.model_number as string | null) ?? null,
    voltage: (e.voltage as string | null) ?? null,
    location: (e.location as string | null) ?? null,
  }))

  return {
    email: (user.email || customer.contact_email || '').toLowerCase(),
    name: displayName || customer.primary_contact_name || null,
    company: customer.company_name || null,
    phone: customer.phone || null,
    units,
  }
}

// ── Status lookup context ────────────────────────────────────────────────────
export type StatusCustomerContext = {
  email: string
  requests: Array<{ ref: string; kind: 'ticket' | 'troubleshooting'; status: string; title: string }>
}

// For the "Check status" page: the signed-in customer's email + their own requests,
// matched by their account email so a one-click lookup always passes the email check.
// Anonymous visitors → null and the page stays the plain public lookup.
export async function getStatusCustomerContext(): Promise<StatusCustomerContext | null> {
  const session = await getCustomerUser()
  if (!session) return null
  const { customer, user } = session
  const email = (user.email || customer.contact_email || '').toLowerCase()
  if (!email) return { email: '', requests: [] }

  const [tRes, iRes] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('ticket_number, status, problem_description')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(25),
    supabaseAdmin
      .from('troubleshooting_intakes')
      .select('reference_number, status, problem_description')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const requests: StatusCustomerContext['requests'] = []
  for (const t of tRes.data || []) {
    requests.push({ ref: t.ticket_number as string, kind: 'ticket', status: t.status as string, title: (t.problem_description as string | null) || '' })
  }
  for (const i of iRes.data || []) {
    requests.push({ ref: i.reference_number as string, kind: 'troubleshooting', status: i.status as string, title: (i.problem_description as string | null) || '' })
  }
  return { email, requests }
}
