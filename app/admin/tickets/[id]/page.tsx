import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { sanitizeNoteHtml } from '@/lib/sanitize'
import TicketDetailClient from './TicketDetailClient'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const [{ data: ticket }, { data: notes }, { data: admins }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*, owner:employees(id, name)').eq('id', params.id).single(),
    supabaseAdmin.from('ticket_notes').select('*').eq('ticket_id', params.id).order('created_at', { ascending: true }),
    supabaseAdmin.from('employees').select('id, name').eq('is_admin', true).eq('is_active', true).order('name'),
  ])

  if (!ticket) notFound()

  // Sanitize stored note HTML server-side so the client only ever renders a safe
  // subset (covers rows written before sanitization existed).
  const safeNotes = (notes ?? []).map(n => ({ ...n, content: sanitizeNoteHtml(n.content) }))

  // Link to the equipment registry record for this serial, if one exists.
  let equipmentId: string | null = null
  if (ticket.serial_number) {
    const { data: eq } = await supabaseAdmin
      .from('equipment').select('id').eq('serial_number', ticket.serial_number).maybeSingle()
    equipmentId = eq?.id ?? null
  }

  return <TicketDetailClient ticket={ticket} initialNotes={safeNotes} admins={admins ?? []} equipmentId={equipmentId} />
}
