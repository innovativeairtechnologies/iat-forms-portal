import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'

export const dynamic = 'force-dynamic'

const METHODS = ['email', 'phone'] as const

/**
 * Bridge: customer updates their contact preferences on their own ticket.
 *
 * The update object is built field-by-field from an explicit allow-list. The
 * request body is NEVER spread into .update() — that's the whole reason a
 * customer can't set status, owner_id, or priority through this route.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket-contact')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  if (!customerId || !ticketId) {
    return NextResponse.json({ error: 'Missing customerId or ticketId' }, { status: 400 })
  }

  const owned = await getBridgeTicket(customerId, ticketId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = {}

  if ('customer_phone' in auth.body) {
    const phone = auth.body.customer_phone
    if (phone !== null && typeof phone !== 'string') {
      return NextResponse.json({ error: 'Invalid customer_phone' }, { status: 400 })
    }
    update.customer_phone = typeof phone === 'string' ? phone.trim().slice(0, 40) || null : null
  }

  if ('preferred_contact_method' in auth.body) {
    const method = auth.body.preferred_contact_method
    if (method !== null && !METHODS.includes(method as (typeof METHODS)[number])) {
      return NextResponse.json({ error: 'Invalid preferred_contact_method' }, { status: 400 })
    }
    update.preferred_contact_method = method ?? null
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update(update)
    .eq('id', ticketId)
    .select('customer_phone, preferred_contact_method')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update contact info' }, { status: 500 })
  return NextResponse.json(data)
}
