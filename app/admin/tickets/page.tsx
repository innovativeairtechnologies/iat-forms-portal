import { supabaseAdmin } from '@/lib/supabase-admin'
import TicketsQueueClient from './TicketsQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminTicketsPage() {
  const { data: tickets } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })

  return <TicketsQueueClient tickets={tickets || []} />
}
