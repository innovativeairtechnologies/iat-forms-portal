import { supabaseAdmin } from '@/lib/supabase-admin'
import type { USRotorsOrder } from '@/lib/supabase'
import USRotorsOrdersClient from './USRotorsOrdersClient'

export const dynamic = 'force-dynamic'

export default async function USRotorsOrdersPage() {
  const { data: orders } = await supabaseAdmin
    .from('us_rotors_orders')
    .select('*')
    .order('created_at', { ascending: false })

  return <USRotorsOrdersClient orders={(orders ?? []) as USRotorsOrder[]} />

}
