import { supabaseAdmin } from '@/lib/supabase-admin'
import RequestsQueueClient from './RequestsQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminRequestsPage() {
  const { data: requests } = await supabaseAdmin
    .from('time_off_requests')
    .select('*, employees(*)')
    .order('created_at', { ascending: false })

  return <RequestsQueueClient requests={requests || []} />
}
