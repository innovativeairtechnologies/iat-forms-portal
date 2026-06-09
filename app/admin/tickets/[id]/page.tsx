import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import TicketDetailClient from './TicketDetailClient'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const [{ data: ticket }, { data: notes }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('ticket_notes').select('*').eq('ticket_id', params.id).order('created_at', { ascending: true }),
  ])

  if (!ticket) notFound()

  return <TicketDetailClient ticket={ticket} initialNotes={notes ?? []} />
}
