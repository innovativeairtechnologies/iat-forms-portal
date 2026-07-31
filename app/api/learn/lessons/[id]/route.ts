import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getDeleteImpact } from '@/lib/learn'
import { logAudit } from '@/lib/audit'

// PATCH /api/learn/lessons/[id]  { title?, content?, is_published?, estimated_minutes? }
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
  if (typeof body.content === 'string') update.content = body.content
  if (typeof body.is_published === 'boolean') update.is_published = body.is_published
  if (typeof body.estimated_minutes === 'number' && body.estimated_minutes >= 0) {
    update.estimated_minutes = Math.round(body.estimated_minutes)
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('learn_lessons').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/learn/lessons/[id]
// Irreversible. learn_progress.lesson_id is ON DELETE CASCADE, so this also
// erases every completion of this lesson — and since XP/levels/badges are
// derived from learn_progress, people's totals drop retroactively. Counts are
// read BEFORE the delete; afterwards the rows are gone and uncountable.
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: lesson } = await supabaseAdmin
    .from('learn_lessons').select('title').eq('id', params.id).single()
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  // If we cannot establish what is about to be destroyed, we do not destroy it —
  // the count is the only pre-image of the rows, and an unaudited cascade is
  // worse than a failed request.
  let impact
  try {
    impact = await getDeleteImpact('lesson', params.id)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not determine what would be deleted' },
      { status: 500 },
    )
  }

  const { error } = await supabaseAdmin.from('learn_lessons').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.lesson.delete',
    entityType: 'learn_lesson',
    entityId: params.id,
    summary: `Deleted Learn lesson "${lesson.title}"`
      + (impact.completions > 0 ? ` (erased ${impact.completions} completion${impact.completions === 1 ? '' : 's'})` : ''),
    metadata: { title: lesson.title, ...impact },
  })

  return NextResponse.json({ ok: true, deleted: impact })
}
