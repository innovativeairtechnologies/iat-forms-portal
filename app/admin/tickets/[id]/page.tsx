import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import TicketDetailClient from './TicketDetailClient'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!ticket) notFound()

  return <TicketDetailClient ticket={ticket} />
}
