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
