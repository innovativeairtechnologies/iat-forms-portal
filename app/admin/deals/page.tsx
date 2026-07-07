import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Deal } from '@/lib/supabase'
import DealsClient from './DealsClient'

export const dynamic = 'force-dynamic'

export default async function DealsPage() {
  const { data } = await supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false })
  return <DealsClient initialDeals={(data ?? []) as Deal[]} />
}
