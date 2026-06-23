import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

// Neutralize LIKE/ILIKE wildcards so a value like "%" can't match every row.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

// Map the intake lifecycle (new/reviewed/closed) onto the same vocab the status
// page already renders for tickets, so the page needs no result-shape changes.
const STATUS_MAP: Record<string, 'open' | 'in_progress' | 'closed'> = {
  new: 'open',
  reviewed: 'in_progress',
  closed: 'closed',
}

export async function POST(req: NextRequest) {
  // Also slows brute-forcing of reference + email combinations.
  const limited = await rateLimit(req, { name: 'troubleshooting-status', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const reference = String(body.ticket_number ?? body.reference_number ?? '').trim()
    const email = String(body.email ?? '').trim()

    if (!reference || !email) {
      return NextResponse.json({ error: 'Reference number and email are both required.' }, { status: 400 })
    }

    const { data: intake } = await supabaseAdmin
      .from('troubleshooting_intakes')
      .select('*')
      .ilike('reference_number', escapeLike(reference))
      .ilike('customer_email', escapeLike(email))
      .maybeSingle()

    if (!intake) {
      return NextResponse.json(
        { error: 'No checklist found matching that reference and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // Return only customer-safe fields, in the ticket-status response shape.
    return NextResponse.json({
      ticket: {
        ticket_number: intake.reference_number,
        status: STATUS_MAP[intake.status as string] ?? 'open',
        problem_description: intake.problem_description,
        customer_name: intake.customer_name,
        ai_recommendations: intake.ai_recommendations ?? [],
        resolved_reason: null,
        created_at: intake.created_at,
      },
      related_articles: [],
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
