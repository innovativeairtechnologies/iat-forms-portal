import type { Metadata } from 'next'
import { getCustomerUser } from '@/lib/customer-auth'
import CustomerSessionError from '@/components/customer/CustomerSessionError'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Equipment } from '@/lib/supabase'
import SrvExperience, { type SrvUnitOption } from './SrvExperience'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Start-Up Readiness Verification — IAT',
}

export default async function SrvPage() {
  const session = await getCustomerUser()
  if (!session) return <CustomerSessionError />

  const { customerId, customer, displayName, user } = session

  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const units: SrvUnitOption[] = ((equipmentData || []) as Equipment[]).map((u) => ({
    id: u.id,
    model_number: u.model_number || '',
    serial_number: u.serial_number || '',
    location: u.location || null,
  }))

  return (
    <SrvExperience
      prefill={{
        companyName: customer.company_name,
        contactName: displayName,
        email: (user.email || customer.contact_email || '').toLowerCase(),
        phone: customer.phone || '',
        location: customer.location || '',
        units,
      }}
    />
  )
}
