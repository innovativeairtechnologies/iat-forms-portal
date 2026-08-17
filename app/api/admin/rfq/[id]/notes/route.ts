import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireRfqAuth } from '@/lib/api-auth'
import { shortStaffName } from '@/lib/staff'

// Internal note trail for one survey (migration 088).
//
// POST only, by design. There is no PATCH and no DELETE, and adding one would
// defeat the point: these notes are the record of what we promised a customer
// and why we priced it the way we did. A correction is a NEW note. Attribution
// and timestamp are taken from the verified session and the database clock —
// never from the request body, so neither can be forged or backdated.

const MAX_BODY = 4000

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const denied = await requireRfqAuth()
  if (denied) return denied

  const { id } = await props.params
  const payload = await req.json().catch(() => null)
  const body = typeof payload?.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Write something first' }, { status: 400 })

  // Resolve the author server-side. requireRfqAuth already proved there is a
  // session with the right perm; this re-reads it for the identity only.
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('rfq_notes')
    .insert({
      rfq_id: id,
      body: body.slice(0, MAX_BODY),
      author_id: user.id,
      // Snapshot, not a join: deleting the account later must not erase who
      // said what. Falls back to the login email's local part if the roster has
      // no row for them — an odd byline beats an anonymous note.
      author_name: shortStaffName(employee?.name ?? user.email?.split('@')[0] ?? ''),
    })
    .select('id, body, author_name, created_at')
    .single()

  if (error) {
    // 23503 = FK violation, i.e. no survey with that id.
    if (error.code === '23503') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('[admin/rfq/notes] insert failed:', error)
    return NextResponse.json({ error: 'Could not save the note' }, { status: 500 })
  }

  // Touch the parent so the queue's "updated" reflects the activity.
  await supabaseAdmin
    .from('rfq_requests')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json(data)
}
