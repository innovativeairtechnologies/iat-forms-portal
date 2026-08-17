import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

// Customer-facing status lookup for RFQ / moisture-survey references.
//
// The RFQ confirmation email (lib/resend-rfq.ts) has always pointed the customer
// at /support/status?ticket=RFQ-YYYY-NNNN, but that page only ever resolved
// `tickets` (IAT-…) and `troubleshooting_intakes` (TSC-…) — so every RFQ
// reference came back "No ticket found matching that number and email." This is
// the third resolver the page needed; it returns the same response shape as
// /api/tickets/status so the client needs no new result plumbing.

// Neutralize LIKE/ILIKE wildcards so a value like "%" can't match every row.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

// rfq_requests.status is new | reviewing | quoted | closed (migration 087).
// Mapped onto the vocab the status page already renders.
const STATUS_MAP: Record<string, 'open' | 'in_progress' | 'resolved' | 'closed'> = {
  new: 'open',
  reviewing: 'in_progress',
  quoted: 'resolved',
  closed: 'closed',
}

export async function POST(req: NextRequest) {
  // Also slows brute-forcing of reference + email combinations.
  const limited = await rateLimit(req, { name: 'rfq-status', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const reference = String(body.ticket_number ?? body.reference ?? '').trim()
    const email = String(body.email ?? '').trim()

    if (!reference || !email) {
      return NextResponse.json({ error: 'Reference number and email are both required.' }, { status: 400 })
    }

    const { data: rfq } = await supabaseAdmin
      .from('rfq_requests')
      .select('reference, status, application_label, project_name, location, date_required, contact_name, created_at')
      .ilike('reference', escapeLike(reference))
      .ilike('email', escapeLike(email))
      .maybeSingle()

    if (!rfq) {
      return NextResponse.json(
        { error: 'No request found matching that reference and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // An RFQ has no "problem" — echo back what they asked us to quote so the
    // customer can confirm we captured the right project.
    const recap = [
      rfq.application_label && `Application: ${rfq.application_label}`,
      rfq.project_name && `Project: ${rfq.project_name}`,
      rfq.location && `Location: ${rfq.location}`,
      rfq.date_required && `Needed by: ${rfq.date_required}`,
    ].filter(Boolean).join('\n')

    // Customer-safe fields only — never internal notes, assignee, or the full
    // survey payload.
    return NextResponse.json({
      kind: 'rfq',
      ticket: {
        ticket_number: rfq.reference,
        status: STATUS_MAP[rfq.status as string] ?? 'open',
        problem_description: recap || 'Request for quote received.',
        customer_name: rfq.contact_name,
        ai_recommendations: [],
        resolved_reason: null,
        created_at: rfq.created_at,
      },
      related_articles: [],
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
