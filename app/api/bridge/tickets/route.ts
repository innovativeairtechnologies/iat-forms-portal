import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'

export const dynamic = 'force-dynamic'

// Customer-safe ticket columns — the same allow-list the customer ticket detail
// page uses, minus customer_id (kept internal; used only for the ownership
// re-filter below). NEVER select('*') here: the internal page gets away with it
// because RequestView drops everything before the RSC boundary, but a JSON
// bridge would put owner_id, staff notes, resolved_reason, ai_recommendations
// and viewed_kb_articles straight on the wire.
const TICKET_COLUMNS =
  'id, customer_id, ticket_number, status, priority, created_at, problem_description, serial_number, customer_email'

/** PostgREST .or() takes a raw, unescaped string — a serial containing a comma,
 *  paren or dot would corrupt the filter (or widen it). Drop anything unsafe
 *  rather than interpolate it. */
function safeSerial(serial: string): boolean {
  return /^[A-Za-z0-9_\- ]+$/.test(serial)
}

/**
 * Bridge: this customer's support requests ("My Requests").
 *
 * SECURITY NARROWING vs. the internal page: app/customer/page.tsx matches
 * tickets by the logged-in user's email, which it can trust because it owns the
 * session. This bridge cannot — an email supplied by the caller would let a
 * compromised customer deployment read another company's tickets by passing
 * their address. So the email is derived HERE from the customer's own record,
 * and every result is re-filtered to drop rows linked to a different customer.
 *
 * Practical effect: a ticket that matches only a customer's personal email (not
 * the company contact email, no serial, no customer_id) won't appear. Those are
 * anonymous /support submissions; they still surface once linked or matched by
 * serial. Trading that edge case for a closed cross-tenant hole is the right call.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/tickets')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  // Derive the match keys internally — never from the request body.
  const [{ data: customer }, { data: equipment }] = await Promise.all([
    supabaseAdmin.from('customers').select('contact_email').eq('id', customerId).maybeSingle(),
    supabaseAdmin.from('equipment').select('serial_number').eq('customer_id', customerId),
  ])

  const email = (customer?.contact_email || '').toLowerCase()
  const serials = (equipment ?? [])
    .map((e) => e.serial_number)
    .filter((s): s is string => !!s && safeSerial(s))

  const orParts = [`customer_id.eq.${customerId}`]
  if (email && safeSerial(email.replace(/[@.]/g, ''))) orParts.push(`customer_email.ilike.${email}`)
  if (serials.length) orParts.push(`serial_number.in.(${serials.join(',')})`)

  const [ticketsRes, intakesRes] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select(TICKET_COLUMNS)
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(50),
    email || serials.length
      ? supabaseAdmin
          .from('troubleshooting_intakes')
          .select('reference_number, problem_description, serial_number, status, created_at')
          .or(orParts.slice(1).join(','))
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ])

  const tickets = (ticketsRes.data ?? [])
    // Ownership re-filter: an email/serial match must never pull in a ticket
    // that belongs to a DIFFERENT customer. Unlinked (null) rows are allowed —
    // they matched on this customer's own email or serial.
    .filter((t) => !t.customer_id || t.customer_id === customerId)
    .map((t) => ({
      kind: 'ticket' as const,
      id: t.id,
      ref: t.ticket_number,
      title: t.problem_description,
      serial: t.serial_number ?? '',
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
    }))

  const intakes = (intakesRes.data ?? []).map((i) => ({
    kind: 'troubleshooting' as const,
    ref: i.reference_number,
    title: i.problem_description,
    serial: i.serial_number ?? '',
    status: i.status,
    created_at: i.created_at,
  }))

  // Same merge + descending string sort the dashboard uses.
  const requests = [...tickets, ...intakes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return NextResponse.json({ tickets: requests })
}
