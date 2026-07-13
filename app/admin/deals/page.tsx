import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Deal, DealFollowUp } from '@/lib/supabase'
import DealsClient from './DealsClient'

export const dynamic = 'force-dynamic'

export default async function DealsPage() {
  const { data } = await supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false })
  // Follow-ups arrive with migration 048; pre-migration the query errors and
  // we simply start with none (the Calendar tab shows its empty/setup state).
  const { data: followUps } = await supabaseAdmin.from('deal_follow_ups').select('*').order('due_date')
  return (
    <DealsClient
      initialDeals={(data ?? []) as Deal[]}
      initialFollowUps={(followUps ?? []) as DealFollowUp[]}
    />
  )
}
