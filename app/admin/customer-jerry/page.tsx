export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CustomerJerryPreview from './CustomerJerryPreview'

// Internal preview of the customer-facing Jerry. Admin-only ('customer_jerry' is
// non-delegatable, so only a full admin's can() is true; middleware gates the
// path too). Loads the customer list so the admin can ground the preview in a
// real customer's equipment.
export default async function CustomerJerryPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('customer_jerry')) redirect('/admin')

  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('id, company_name')
    .order('company_name', { ascending: true })

  return <CustomerJerryPreview customers={(customers ?? []) as { id: string; company_name: string }[]} />
}
