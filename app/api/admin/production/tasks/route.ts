import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProductionAuth } from '@/lib/api-auth'
import { shopDate } from '@/lib/production'

// Tasks on the production boards (migration 055). Manager-side; gated on
// `production_board`. The floor writes through /api/board/[token]/check only.

const MAX_TITLE = 120
const MAX_TEXT = 300

const CADENCES = ['once', 'daily', 'weekly'] as const
const PRIORITIES = ['normal', 'high'] as const
const STATUSES = ['open', 'done', 'blocked'] as const

/** 'YYYY-MM-DD' or nothing. Rejects garbage rather than letting Postgres 500. */
function cleanDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? null : v
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

const oneOf = <T extends readonly string[]>(v: unknown, allowed: T): T[number] | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T[number]) : null

export async function POST(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))

  const departmentId = String(body.department_id ?? '').trim()
  const title = text(body.title, MAX_TITLE)
  if (!departmentId || !title) {
    return NextResponse.json({ error: 'A department and a title are required.' }, { status: 400 })
  }

  // Prove the department exists before writing — an unchecked FK violation would
  // surface as an opaque 500 instead of a legible message.
  const { data: dept } = await supabaseAdmin
    .from('production_departments')
    .select('id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept) return NextResponse.json({ error: 'That department no longer exists.' }, { status: 404 })

  const { data: last } = await supabaseAdmin
    .from('production_tasks')
    .select('sort_order')
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('production_tasks')
    .insert({
      department_id: departmentId,
      title,
      detail: text(body.detail, MAX_TEXT),
      // Blank project => a standing duty. That NULL is the only thing
      // distinguishing the two kinds of work.
      project: text(body.project, MAX_TEXT),
      cadence: oneOf(body.cadence, CADENCES) ?? 'once',
      priority: oneOf(body.priority, PRIORITIES) ?? 'normal',
      due_date: cleanDate(body.due_date),
      assignee: text(body.assignee, MAX_TEXT),
      sort_order: (last?.sort_order ?? 0) + 10,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[production/tasks] insert failed', error)
    return NextResponse.json({ error: 'Could not add that task.' }, { status: 500 })
  }

  await supabaseAdmin.from('production_task_events').insert({
    task_id: data.id,
    action: 'created',
    source: 'admin',
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'Missing task.' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('production_tasks')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'That task no longer exists.' }, { status: 404 })

  // Field-by-field, never a `...body` spread. A spread here would let a caller
  // set done_by/done_on/department_id directly — including moving a task onto
  // another department's board. (That exact bug is live in updateTicket today.)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('title' in body) {
    const t = text(body.title, MAX_TITLE)
    if (!t) return NextResponse.json({ error: 'A title is required.' }, { status: 400 })
    patch.title = t
  }
  if ('detail' in body) patch.detail = text(body.detail, MAX_TEXT)
  if ('project' in body) patch.project = text(body.project, MAX_TEXT)
  if ('assignee' in body) patch.assignee = text(body.assignee, MAX_TEXT)
  if ('blocked_note' in body) patch.blocked_note = text(body.blocked_note, MAX_TEXT)
  if ('due_date' in body) patch.due_date = cleanDate(body.due_date)

  const cadence = oneOf(body.cadence, CADENCES)
  if (cadence) patch.cadence = cadence
  const priority = oneOf(body.priority, PRIORITIES)
  if (priority) patch.priority = priority

  const status = oneOf(body.status, STATUSES)
  if (status) {
    patch.status = status
    // The done-provenance CHECK (055) refuses a 'done' row with no done_on /
    // done_at, so these must move together with the status — not as a separate
    // client-supplied field.
    if (status === 'done') {
      patch.done_on = shopDate()
      patch.done_at = new Date().toISOString()
      patch.done_by = 'Manager'
    } else {
      patch.done_on = null
      patch.done_at = null
      patch.done_by = null
    }
  }

  const { error: updErr } = await supabaseAdmin.from('production_tasks').update(patch).eq('id', id)
  if (updErr) {
    console.error('[production/tasks] update failed', updErr)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  if (status && status !== existing.status) {
    await supabaseAdmin.from('production_task_events').insert({
      task_id: id,
      action: status === 'done' ? 'done' : status === 'blocked' ? 'blocked' : 'reopened',
      actor_name: 'Manager',
      source: 'admin',
      note: typeof patch.blocked_note === 'string' ? (patch.blocked_note as string) : null,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Missing task.' }, { status: 400 })

  // Soft delete: the task leaves every board immediately, but its check-off
  // trail survives. "Who did this and when" must outlive the task itself —
  // hard-deleting would cascade the events away (055 uses ON DELETE CASCADE).
  const { error: updErr } = await supabaseAdmin
    .from('production_tasks')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updErr) {
    console.error('[production/tasks] archive failed', updErr)
    return NextResponse.json({ error: 'Could not remove that task.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
