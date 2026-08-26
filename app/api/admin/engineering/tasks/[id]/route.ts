import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { listAssignees } from '@/lib/eng-data'
import { TASK_STATUSES, type TaskStatus } from '@/lib/engineering'

/* PATCH / DELETE one engineering task. This is the write path behind the status
 * board, the task queue, My Work and the job detail — one route, so the four of
 * them can never drift on what a status change means.
 *
 * started_at / completed_at are NOT settable here. A database trigger owns them
 * (migration 096, eng_task_stamp) precisely because there are four callers and
 * one of them forgetting to stamp a start would not error — it would quietly
 * produce a task that can never be projected and a median that silently excludes
 * it. Every lead-time number on the leadership report rests on those two columns.
 */

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await props.params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: before } = await supabaseAdmin
    .from('eng_tasks').select('id, title, status, progress, assignee_id, due_date, job_id').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!TASK_STATUSES.includes(body.status as TaskStatus)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    }
    patch.status = body.status
    // Moving a task off "not started" is what stops the reminder sweep chasing
    // it. Clear both stamps so that if it ever lands back there, chasing starts
    // fresh rather than being suppressed by a month-old nudge. Same idiom as
    // the RFQ triage route.
    if (body.status !== 'not_started') {
      patch.nudged_at = null
      patch.escalated_at = null
    }
  }

  if (body.progress !== undefined) {
    const n = Number(body.progress)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100.' }, { status: 400 })
    }
    patch.progress = Math.round(n)
    // Dragging the bar off zero IS starting the task — anything else means the
    // board shows 40% next to "Not started", and the projection refuses to run
    // on a task that is visibly underway. The trigger stamps started_at.
    if (patch.status === undefined && Math.round(n) > 0 && before.status === 'not_started') {
      patch.status = 'in_progress'
    }
  }

  if (body.assignee_id !== undefined) {
    if (body.assignee_id === null) {
      patch.assignee_id = null
      patch.nudged_at = null
    } else {
      const roster = await listAssignees()
      if (!roster.some(r => r.id === body.assignee_id)) {
        return NextResponse.json({ error: 'That person cannot be assigned engineering tasks.' }, { status: 400 })
      }
      patch.assignee_id = body.assignee_id
      // A fresh owner restarts the nudge clock — the previous owner's silence is
      // not the new owner's problem.
      patch.nudged_at = null
    }
  }

  for (const key of ['due_date', 'blocked_reason', 'notes', 'title'] as const) {
    if (body[key] !== undefined) patch[key] = body[key] === '' ? null : body[key]
  }
  for (const key of ['target_hours', 'actual_hours'] as const) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === '') { patch[key] = null; continue }
    const n = Number(body[key])
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Hours must be a positive number.' }, { status: 400 })
    patch[key] = n
  }
  if (body.priority !== undefined) {
    const n = Math.round(Number(body.priority))
    if (!Number.isFinite(n) || n < 0 || n > 9) return NextResponse.json({ error: 'Priority must be 0–9.' }, { status: 400 })
    patch.priority = n
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data: after, error } = await supabaseAdmin
    .from('eng_tasks').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[eng/tasks] update failed:', error.message)
    return NextResponse.json({ error: 'Could not save the task.' }, { status: 500 })
  }

  // Audit the two changes that carry accountability — who owns it, and whether
  // it is done. Progress drags and note edits are working, not decisions, and
  // logging every one of them would bury the entries that matter.
  const statusChanged = patch.status !== undefined && patch.status !== before.status
  const ownerChanged = patch.assignee_id !== undefined && patch.assignee_id !== before.assignee_id
  if (statusChanged || ownerChanged) {
    const actor = await getAdminSurfaceUser()
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: statusChanged ? 'eng.task.status' : 'eng.task.assign',
      entityType: 'eng_task',
      entityId: id,
      summary: statusChanged
        ? `"${before.title}" moved ${before.status} → ${after.status}`
        : `"${before.title}" reassigned`,
      metadata: { from: before.status, to: after.status, job_id: before.job_id, assignee_from: before.assignee_id, assignee_to: after.assignee_id },
    })
  }

  return NextResponse.json({ task: after })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await props.params
  const { data: task } = await supabaseAdmin.from('eng_tasks').select('title, status').eq('id', id).maybeSingle()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // A finished task is evidence. Deleting one removes a lead-time the report has
  // already counted, so the answer is "mark it Not required", which keeps the row
  // and takes it out of every open-work total.
  if (task.status === 'done') {
    return NextResponse.json(
      { error: 'A completed task cannot be deleted — it is part of the lead-time record. Reopen it first if it was finished by mistake.' },
      { status: 409 },
    )
  }

  const { error } = await supabaseAdmin.from('eng_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete the task.' }, { status: 500 })

  const actor = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'eng.task.delete',
    entityType: 'eng_task',
    entityId: id,
    summary: `Deleted engineering task "${task.title}"`,
  })
  return NextResponse.json({ ok: true })
}
