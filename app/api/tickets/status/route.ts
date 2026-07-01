import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { matchKbArticlesForTicket } from '@/lib/kb'
import { rateLimit } from '@/lib/rate-limit'

// Neutralize LIKE/ILIKE wildcards so a value like "%" can't match every row.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

export async function POST(req: NextRequest) {
  // Also slows brute-forcing of ticket-number + email combinations.
  const limited = await rateLimit(req, { name: 'ticket-status', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const ticketNumber = String(body.ticket_number ?? '').trim()
    const email = String(body.email ?? '').trim()

    if (!ticketNumber || !email) {
      return NextResponse.json(
        { error: 'Ticket number and email are both required.' },
        { status: 400 }
      )
    }

    // Ticket number is generated uppercase (e.g. TKT-123456-789); match exactly,
    // case-insensitively. Email is matched case-insensitively. Both are escaped
    // so user-supplied wildcards can't be used to enumerate other tickets.
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .ilike('ticket_number', escapeLike(ticketNumber))
      .ilike('customer_email', escapeLike(email))
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json(
        { error: 'No ticket found matching that number and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    const articles = await matchKbArticlesForTicket(ticket)

    // Lets the client show the right "Request portal access" CTA state
    // without a second round trip.
    let hasPendingRequest = false
    if (!ticket.customer_id) {
      const { data: pendingReq } = await supabaseAdmin
        .from('customer_portal_requests')
        .select('id')
        .eq('ticket_id', ticket.id)
        .eq('status', 'pending')
        .maybeSingle()
      hasPendingRequest = !!pendingReq
    }

    // Return only customer-safe fields — never internal notes, owner, photos, etc.
    return NextResponse.json({
      ticket: {
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        problem_description: ticket.problem_description,
        customer_name: ticket.customer_name,
        ai_recommendations: ticket.ai_recommendations ?? [],
        resolved_reason: ticket.resolved_reason ?? null,
        created_at: ticket.created_at,
        customer_id_linked: !!ticket.customer_id,
        has_pending_request: hasPendingRequest,
      },
      related_articles: articles.map(a => ({
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        category: a.category,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
