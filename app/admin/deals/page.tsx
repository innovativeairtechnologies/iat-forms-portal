import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Deal, DealFollowUp, Company, Contact } from '@/lib/supabase'
import DealsClient from './DealsClient'

export const dynamic = 'force-dynamic'

export default async function DealsPage() {
  const { data } = await supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false })
  // Follow-ups arrive with migration 048; pre-migration the query errors and
  // we simply start with none (the Calendar tab shows its empty/setup state).
  const { data: followUps } = await supabaseAdmin.from('deal_follow_ups').select('*').order('due_date')
  // Companies + contacts arrive with migration 062 — same graceful degradation.
  const { data: companies } = await supabaseAdmin.from('companies').select('*').order('name')
  const { data: contacts } = await supabaseAdmin.from('contacts').select('*').order('name')
  return (
    <DealsClient
      initialDeals={(data ?? []) as Deal[]}
      initialFollowUps={(followUps ?? []) as DealFollowUp[]}
      initialCompanies={(companies ?? []) as Company[]}
      initialContacts={(contacts ?? []) as Contact[]}
    />
  )
}
