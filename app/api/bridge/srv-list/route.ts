import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getSrvForm, getSrvReview } from '@/lib/srv-form'

export const dynamic = 'force-dynamic'

/**
 * Bridge: this customer's SRV submissions, for "My Requests".
 *
 * Filtered to data->>_customer_id and projected to a handful of safe fields.
 * `submissions` holds every internal and public form response in one table, so a
 * broad select here would leak other customers' data and internal form results —
 * the filter and the projection are both load-bearing.
 *
 * Superseded revisions are dropped: once a returned SRV has been resubmitted,
 * only the live revision is the customer's business.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/srv-list')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  const form = await getSrvForm()
  if (!form) return NextResponse.json({ submissions: [] })

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('id, data, status, submitted_at')
    .eq('form_id', form.id)
    .eq('data->>_customer_id', customerId)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })

  const submissions = (data ?? [])
    .filter((s) => !getSrvReview(s.data)?.superseded_by)
    .map((s) => {
      const review = getSrvReview(s.data)
      const revision = String(s.data?.['Revision'] || '1')
      return {
        id: s.id,
        ref: `SRV-${s.id.slice(0, 8).toUpperCase()}`,
        serial: String(s.data?.['Unit Serial Number'] || ''),
        revision,
        status: s.status || 'open',
        submitted_at: s.submitted_at,
        // A returned SRV is the one the customer can reopen and revise.
        returned: review?.decision === 'return',
        reviewerNotes: review?.decision === 'return' ? review.notes : null,
      }
    })

  return NextResponse.json({ submissions })
}
