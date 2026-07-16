import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { sanitizeNoteHtml, sanitizeAttachments } from '@/lib/sanitize'
import { getEmployeesWithPerm } from '@/lib/staff'
import TicketDetailClient from './TicketDetailClient'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Assignable owners = everyone holding `tickets`, which is what the page itself
  // is gated on — so anyone who can work this ticket can own it. (This used to
  // list `is_admin` staff only, which locked out the sales / engineering /
  // production_manager roles who hold the perm and work the queue daily.)
  const [{ data: ticket }, { data: notes }, permitted] = await Promise.all([
    supabaseAdmin.from('tickets').select('*, owner:employees(id, name)').eq('id', params.id).single(),
    supabaseAdmin.from('ticket_notes').select('*').eq('ticket_id', params.id).order('created_at', { ascending: true }),
    getEmployeesWithPerm('tickets'),
  ])

  if (!ticket) notFound()

  // Keep the current owner in the list even if they no longer qualify (role
  // changed, deactivated, or the roster read failed). Otherwise the <select>
  // holds a value with no matching <option> and renders blank — the ticket would
  // read as unowned while the DB still says otherwise.
  const owner = ticket.owner as { id: string; name: string } | null
  const owners = owner && !permitted.some(p => p.id === owner.id)
    ? [...permitted, owner].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    : permitted

  // Sanitize stored note HTML server-side so the client only ever renders a safe
  // subset (covers rows written before sanitization existed).
  const safeNotes = (notes ?? []).map(n => ({
    ...n,
    content: sanitizeNoteHtml(n.content),
    attachments: sanitizeAttachments(n.attachments, params.id),
  }))

  // Link to the equipment registry record for this serial, if one exists.
  let equipmentId: string | null = null
  if (ticket.serial_number) {
    const { data: eq } = await supabaseAdmin
      .from('equipment').select('id').eq('serial_number', ticket.serial_number).maybeSingle()
    equipmentId = eq?.id ?? null
  }

  return <TicketDetailClient ticket={ticket} initialNotes={safeNotes} owners={owners} equipmentId={equipmentId} />
}
