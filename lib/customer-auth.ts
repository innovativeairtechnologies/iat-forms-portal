import type { User } from '@supabase/supabase-js'
import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'
import type { Customer } from './supabase'

export type CustomerUser = {
  user: User
  customerId: string
  customer: Customer
  displayName: string
}

/**
 * Resolve the logged-in CUSTOMER (mirrors lib/admin-auth.ts → getAdminUser).
 * Returns null for anon, employees, admins, or a customer login that isn't linked
 * to a company. Every /customer page derives the session this way and then fetches
 * data scoped to `customerId` via the service role, so a customer can only ever
 * see their own company's rows.
 */
export async function getCustomerUser(): Promise<CustomerUser | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name, customer_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'customer' || !profile.customer_id) return null

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', profile.customer_id)
    .single()

  if (!customer) return null

  return {
    user,
    customerId: profile.customer_id,
    customer: customer as Customer,
    displayName:
      profile.display_name ||
      (customer as Customer).primary_contact_name ||
      user.email?.split('@')[0] ||
      'Customer',
  }
}

export async function isCustomerAuthenticated(): Promise<boolean> {
  return (await getCustomerUser()) !== null
}
