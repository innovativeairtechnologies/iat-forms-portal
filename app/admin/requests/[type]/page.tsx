import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import RequestsQueueClient from '../RequestsQueueClient'

export const dynamic = 'force-dynamic'

const TYPE_META: Record<string, { type: 'pto' | 'sick'; title: string }> = {
  pto:  { type: 'pto',  title: 'PTO Requests' },
  sick: { type: 'sick', title: 'Sick Time Requests' },
}

export default async function AdminRequestsByTypePage({
  params,
}: {
  params: { type: string }
}) {
  const meta = TYPE_META[params.type]
  if (!meta) notFound()

  const { data: requests } = await supabaseAdmin
    .from('time_off_requests')
    .select('*, employees!time_off_requests_employee_id_fkey(*)')
    .eq('type', meta.type)
    .order('created_at', { ascending: false })

  return <RequestsQueueClient requests={requests || []} title={meta.title} />
}
