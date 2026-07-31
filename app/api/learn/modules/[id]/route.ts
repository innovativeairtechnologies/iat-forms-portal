import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getDeleteImpact } from '@/lib/learn'
import { logAudit } from '@/lib/audit'

// PATCH /api/learn/modules/[id]  { title?, description?, is_published? }
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (typeof body.description === 'string') update.description = body.description
  if (typeof body.is_published === 'boolean') update.is_published = body.is_published
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('learn_modules').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/learn/modules/[id]
// Irreversible, and wider than it looks: learn_lessons.module_id and
// learn_progress.lesson_id are both ON DELETE CASCADE, so this takes every
// lesson in the subject AND every completion of those lessons. XP, levels and
// badges are derived from learn_progress, so people's totals drop retroactively.
// Unpublishing (PATCH is_published:false) hides a subject without destroying it.
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: module } = await supabaseAdmin
    .from('learn_modules').select('title').eq('id', params.id).single()
  if (!module) return NextResponse.json({ error: 'Subject not found' }, { status: 404 })

  // If we cannot establish what is about to be destroyed, we do not destroy it.
  let impact
  try {
    impact = await getDeleteImpact('module', params.id)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not determine what would be deleted' },
      { status: 500 },
    )
  }

  const { error } = await supabaseAdmin.from('learn_modules').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.module.delete',
    entityType: 'learn_module',
    entityId: params.id,
    summary: `Deleted Learn subject "${module.title}" with ${impact.lessons} lesson${impact.lessons === 1 ? '' : 's'}`
      + (impact.completions > 0 ? ` (erased ${impact.completions} completion${impact.completions === 1 ? '' : 's'})` : ''),
    metadata: { title: module.title, ...impact },
  })

  return NextResponse.json({ ok: true, deleted: impact })
}
