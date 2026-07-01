import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerUser } from '@/lib/customer-auth'

// Lets a logged-in customer update THEIR contact info on one of THEIR OWN
// tickets (phone + preferred contact method) from the ticket detail page's
// Contact card. Customer-only — admins already edit ticket contact info
// through the general admin ticket flow, so this route doesn't need to
// support the admin role.
//
// Ownership check mirrors the same customer_id/customer_email match used by
// requireTicketAccess / app/customer/page.tsx's "My Requests" query.
//
// SECURITY: the update object is built field-by-field from an explicit
// allow-list — the raw request body is never spread into `.update()`.

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, customer_email')
    .eq('id', params.id)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const email = (session.user.email || session.customer.contact_email || '').toLowerCase()
  const owns =
    ticket.customer_id === session.customerId ||
    (!!ticket.customer_email && ticket.customer_email.toLowerCase() === email)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Explicit allow-list, built field-by-field — never spread the raw body.
  const update: Record<string, unknown> = {}

  if ('customer_phone' in body) {
    if (body.customer_phone !== null && typeof body.customer_phone !== 'string') {
      return NextResponse.json({ error: 'Invalid customer_phone' }, { status: 400 })
    }
    update.customer_phone = typeof body.customer_phone === 'string'
      ? body.customer_phone.trim().slice(0, 40) || null
      : null
  }

  if ('preferred_contact_method' in body) {
    const v = body.preferred_contact_method
    if (v !== null && v !== 'email' && v !== 'phone') {
      return NextResponse.json({ error: "preferred_contact_method must be 'email' or 'phone'" }, { status: 400 })
    }
    update.preferred_contact_method = v
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update(update)
    .eq('id', params.id)
    .select('customer_phone, preferred_contact_method')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update contact info' }, { status: 500 })
  return NextResponse.json(data)
}
