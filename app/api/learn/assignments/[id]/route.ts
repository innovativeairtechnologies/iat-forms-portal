import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

/* PATCH  /api/learn/assignments/[id]  { dueOn?: string|null, note?: string }
   DELETE /api/learn/assignments/[id]

   Deleting an assignment removes a REQUIREMENT, not any progress — completion
   is derived from learn_progress, which is untouched here. Someone who has
   finished the training stays finished; it just stops being required. */

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  if ('dueOn' in body) {
    if (body.dueOn === null || body.dueOn === '') update.due_on = null
    else if (typeof body.dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueOn.trim())) update.due_on = body.dueOn.trim()
    else return NextResponse.json({ error: 'dueOn must be YYYY-MM-DD or null' }, { status: 400 })
  }
  if (typeof body.note === 'string') update.note = body.note.trim() || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('learn_assignments').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row } = await supabaseAdmin
    .from('learn_assignments').select('scope_type, audience_type, audience_value').eq('id', id).single()
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  const { error } = await supabaseAdmin.from('learn_assignments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.assignment.delete',
    entityType: 'learn_assignment',
    entityId: id,
    summary: `Removed a Learn ${row.scope_type === 'module' ? 'subject' : 'category'} requirement`,
    metadata: { audienceType: row.audience_type, audienceValue: row.audience_value },
  })

  return NextResponse.json({ ok: true })
}
