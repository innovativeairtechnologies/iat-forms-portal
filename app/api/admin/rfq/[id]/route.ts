import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireRfqAuth } from '@/lib/api-auth'
import { RFQ_STATUSES, type RfqStatus } from '@/lib/rfq-status'

// Triage writes for one inbound survey (/admin/rfq/[id], migration 087).
//
// Deliberately narrow: `status` and `internal_notes` are the ONLY writable
// columns. Everything else on the row is what the customer told us and what we
// told them back — the survey and its estimate are a record of a conversation,
// and a record you can quietly edit after the fact is not a record. If a figure
// is wrong, the fix is a new survey or a note saying so, not a silent overwrite.
//
// Gated on `deals`, the same perm as the page and as ADMIN_PATH_PERMS.

const MAX_NOTES = 8000

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const denied = await requireRfqAuth()
  if (denied) return denied

  const { id } = await props.params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    // The column carries a CHECK constraint, so an unknown value would surface
    // as a raw Postgres error. Reject it here with something a human can read.
    if (!RFQ_STATUSES.includes(body.status as RfqStatus)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.internal_notes !== undefined) {
    if (typeof body.internal_notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be text' }, { status: 400 })
    }
    patch.internal_notes = body.internal_notes.slice(0, MAX_NOTES)
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rfq_requests')
    .update(patch)
    .eq('id', id)
    .select('id, status, internal_notes, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[admin/rfq] update failed:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
