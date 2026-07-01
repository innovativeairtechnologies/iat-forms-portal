import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { sendWarrantyDecisionEmail } from '@/lib/resend-customer'
import type { Customer, Equipment } from '@/lib/supabase'

// Approves a pending warranty claim: opens a real ticket (request_type='warranty')
// so the EXISTING ticket workflow handles servicing it, marks the claim approved,
// and emails the customer. Mirrors app/api/tickets/route.ts's insert shape.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: reqRow, error: reqError } = await supabaseAdmin
    .from('warranty_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })
  if (!reqRow) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been decided.' }, { status: 400 })
  }

  const [{ data: equipment }, { data: customer }] = await Promise.all([
    supabaseAdmin.from('equipment').select('*').eq('id', reqRow.equipment_id).maybeSingle(),
    supabaseAdmin.from('customers').select('*').eq('id', reqRow.customer_id).maybeSingle(),
  ])
  if (!equipment) return NextResponse.json({ error: 'Unit not found.' }, { status: 404 })
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })

  const eq = equipment as Equipment
  const cust = customer as Customer

  // Ticket number: IAT-YYYY-NNNN, same sequential RPC app/api/tickets/route.ts uses.
  const year = new Date().getFullYear()
  let ticket_number: string
  const { data: seq, error: seqError } = await supabaseAdmin.rpc('next_ticket_number', { p_year: year })
  if (seqError || typeof seq !== 'number') {
    console.error('[warranty-requests/approve] next_ticket_number RPC failed — using fallback number:', seqError)
    ticket_number = `IAT-${year}-${Date.now().toString().slice(-5)}`
  } else {
    ticket_number = `IAT-${year}-${String(seq).padStart(4, '0')}`
  }

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .insert({
      ticket_number,
      request_type: 'warranty',
      customer_id: reqRow.customer_id,
      customer_name: cust.primary_contact_name || cust.company_name,
      customer_company: cust.company_name,
      customer_email: cust.contact_email,
      customer_phone: cust.phone,
      serial_number: eq.serial_number,
      model_number: eq.model_number,
      voltage: eq.voltage,
      problem_description: `Warranty claim (${reqRow.resolution}): ${reqRow.description}`,
      problem_started: reqRow.problem_started,
      status: 'open',
      priority: 'med',
    })
    .select()
    .single()

  if (ticketError || !ticket) {
    console.error('[warranty-requests/approve] ticket insert error:', ticketError)
    return NextResponse.json({ error: 'Failed to create the ticket.' }, { status: 500 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('warranty_requests')
    .update({
      status: 'approved',
      decided_by: admin.user.id,
      decided_at: new Date().toISOString(),
      resulting_ticket_id: ticket.id,
    })
    .eq('id', id)
    .eq('status', 'pending')

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Best-effort — an email hiccup must not undo the approval or the ticket.
  if (cust.contact_email) {
    try {
      const res = await sendWarrantyDecisionEmail({
        to: cust.contact_email,
        contactName: cust.primary_contact_name,
        companyName: cust.company_name,
        serialNumber: eq.serial_number,
        outcome: 'approved',
        ticketNumber: ticket.ticket_number,
        appUrl: req.nextUrl.origin,
      })
      if (res.error) console.error('[warranty-requests/approve] decision email failed:', res.error)
    } catch (e) {
      console.error('[warranty-requests/approve] decision email threw:', e)
    }
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'warranty_request.approve',
    entityType: 'warranty_request',
    entityId: id,
    summary: `Approved warranty claim for ${cust.company_name} (${eq.serial_number}) → ${ticket.ticket_number}`,
    metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
  })

  return NextResponse.json({ ok: true, ticket_id: ticket.id })
}
