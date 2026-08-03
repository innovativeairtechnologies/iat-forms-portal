import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { getAssignableStaff, resolveAudience, type AudienceType, type AssignmentScope } from '@/lib/learn-assignments'

/* POST /api/learn/assignments
     { scopeType, scopeId, audienceType, audienceValue?, dueOn?, note? }

   Creates a requirement. The audience is stored as a RULE, not a list, so a new
   hire inherits every role/department/everyone assignment automatically.

   Refuses an audience that currently resolves to NOBODY. Department is free
   text and blank for most staff, so "assign to Dept · Warehouse" could silently
   reach zero people and look like it worked — the admin UI shows the head-count
   before saving, and this is the server-side backstop for the same mistake. */

const AUDIENCES: AudienceType[] = ['user', 'role', 'department', 'everyone']

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const scopeType = body.scopeType as AssignmentScope
  const scopeId = body.scopeId
  const audienceType = body.audienceType as AudienceType

  if (scopeType !== 'module' && scopeType !== 'category') {
    return NextResponse.json({ error: 'scopeType must be "module" or "category"' }, { status: 400 })
  }
  if (typeof scopeId !== 'string' || !scopeId) {
    return NextResponse.json({ error: 'scopeId required' }, { status: 400 })
  }
  if (!AUDIENCES.includes(audienceType)) {
    return NextResponse.json({ error: 'audienceType must be user, role, department or everyone' }, { status: 400 })
  }

  const audienceValue = audienceType === 'everyone'
    ? null
    : (typeof body.audienceValue === 'string' && body.audienceValue.trim() ? body.audienceValue.trim() : null)
  if (audienceType !== 'everyone' && !audienceValue) {
    return NextResponse.json({ error: 'audienceValue required for this audience' }, { status: 400 })
  }

  // YYYY-MM-DD or nothing.
  let dueOn: string | null = null
  if (typeof body.dueOn === 'string' && body.dueOn.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueOn.trim())) {
      return NextResponse.json({ error: 'dueOn must be YYYY-MM-DD' }, { status: 400 })
    }
    dueOn = body.dueOn.trim()
  }

  const staff = await getAssignableStaff()
  const resolved = resolveAudience(staff, audienceType, audienceValue)
  if (resolved.length === 0) {
    return NextResponse.json({
      error: 'That audience matches nobody right now',
      hint: audienceType === 'department'
        ? 'Departments are free text on the employee record and most are blank — assign by role or by person instead, or fill in the department first.'
        : 'Nobody active on staff matches this audience.',
    }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin.from('learn_assignments').insert({
    scope_type: scopeType,
    scope_id: scopeId,
    audience_type: audienceType,
    audience_value: audienceValue,
    due_on: dueOn,
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    created_by: admin.user.id,
  }).select('id').single()

  if (error) {
    // The partial unique indexes make a repeat assignment a 23505.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That is already assigned to this audience.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.assignment.create',
    entityType: 'learn_assignment',
    entityId: data.id,
    summary: `Assigned Learn ${scopeType === 'module' ? 'subject' : 'category'} to ${resolved.length} ${resolved.length === 1 ? 'person' : 'people'}`
      + (dueOn ? `, due ${dueOn}` : ''),
    metadata: { scopeType, scopeId, audienceType, audienceValue, dueOn, headcount: resolved.length },
  })

  return NextResponse.json({ ok: true, id: data.id, headcount: resolved.length })
}
