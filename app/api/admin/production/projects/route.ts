import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProductionAuth } from '@/lib/api-auth'

// Projects under a production department (migration 056). Manager-side; gated on
// `production_board`. The floor never writes here — it only checks tasks off via
// the public /api/board/[token]/check.

const MAX_NAME = 80
const MAX_TYPE = 60
const MAX_DETAIL = 500
const MAX_PEOPLE = 40 // names on one build; a generous ceiling, not a real limit
const STATUSES = ['active', 'complete'] as const

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

/** Clean the display-only people tags: an array of non-empty trimmed names,
 *  deduped, capped. Anything else becomes []. Never trusted for auth — these are
 *  labels shown on the board, not an assignee gate. */
function cleanPeople(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of v) {
    if (typeof raw !== 'string') continue
    const name = raw.trim().slice(0, 60)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= MAX_PEOPLE) break
  }
  return out
}

export async function POST(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))

  // Two shapes share this handler: a plain create, and "duplicate this project
  // (with its tasks)" — the headline ask, since most builds start from a
  // near-identical checklist. Branch early; they share almost nothing.
  const duplicateId = String(body.duplicate_id ?? '').trim()
  if (duplicateId) return duplicate(duplicateId, body)

  const departmentId = String(body.department_id ?? '').trim()
  const name = text(body.name, MAX_NAME)
  if (!departmentId || !name) {
    return NextResponse.json({ error: 'A department and a project name are required.' }, { status: 400 })
  }

  const { data: dept } = await supabaseAdmin
    .from('production_departments')
    .select('id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept) return NextResponse.json({ error: 'That department no longer exists.' }, { status: 404 })

  const { data: last } = await supabaseAdmin
    .from('production_projects')
    .select('sort_order')
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('production_projects')
    .insert({
      department_id: departmentId,
      name,
      type: text(body.type, MAX_TYPE),
      detail: text(body.detail, MAX_DETAIL),
      people: cleanPeople(body.people),
      sort_order: (last?.sort_order ?? 0) + 10,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[production/projects] insert failed', error)
    return NextResponse.json({ error: 'Could not add that project.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

/**
 * Copy a project and its live task list into a fresh project. The task TITLES,
 * details, phases, cadence and priority carry over (that's the reusable part of
 * a build); per-build facts are reset — status back to open, all done_* cleared,
 * and due dates + assignees dropped, because a new build has its own dates and
 * crew. The manager renames + re-dates from a running start.
 */
async function duplicate(sourceId: string, body: Record<string, unknown>): Promise<NextResponse> {
  const { data: src } = await supabaseAdmin
    .from('production_projects')
    .select('*')
    .eq('id', sourceId)
    .is('archived_at', null)
    .maybeSingle()
  if (!src) return NextResponse.json({ error: 'That project no longer exists.' }, { status: 404 })

  const name = text(body.name, MAX_NAME) ?? `Copy of ${src.name}`.slice(0, MAX_NAME)

  const { data: last } = await supabaseAdmin
    .from('production_projects')
    .select('sort_order')
    .eq('department_id', src.department_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: created, error: projErr } = await supabaseAdmin
    .from('production_projects')
    .insert({
      department_id: src.department_id,
      name,
      type: src.type,
      detail: src.detail,
      people: src.people ?? [],
      sort_order: (last?.sort_order ?? 0) + 10,
    })
    .select('id')
    .single()
  if (projErr || !created) {
    console.error('[production/projects] duplicate: project insert failed', projErr)
    return NextResponse.json({ error: 'Could not duplicate that project.' }, { status: 500 })
  }

  const { data: srcTasks } = await supabaseAdmin
    .from('production_tasks')
    .select('title, detail, phase, cadence, priority, sort_order')
    .eq('project_id', sourceId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })

  if (srcTasks && srcTasks.length) {
    const rows = srcTasks.map((t) => ({
      department_id: src.department_id,
      project_id: created.id,
      title: t.title,
      detail: t.detail,
      phase: t.phase,
      cadence: t.cadence,
      priority: t.priority,
      sort_order: t.sort_order,
      // fresh build: no dates, no crew, nothing done yet
      due_date: null,
      assignee: null,
      status: 'open',
    }))
    const { error: taskErr } = await supabaseAdmin.from('production_tasks').insert(rows)
    if (taskErr) {
      // The project landed but its tasks didn't — roll the empty shell back so the
      // manager isn't left with a blank duplicate that looks like it worked.
      await supabaseAdmin.from('production_projects').delete().eq('id', created.id)
      console.error('[production/projects] duplicate: task insert failed', taskErr)
      return NextResponse.json({ error: 'Could not copy the task list.' }, { status: 500 })
    }
  }

  return NextResponse.json({ id: created.id, copied: srcTasks?.length ?? 0 }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'Missing project.' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('production_projects')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'That project no longer exists.' }, { status: 404 })

  // Field-by-field, never a `...body` spread — a spread would let the caller set
  // department_id (moving a project's whole board) or archived_at directly.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in body) {
    const name = text(body.name, MAX_NAME)
    if (!name) return NextResponse.json({ error: 'A project name is required.' }, { status: 400 })
    patch.name = name
  }
  if ('type' in body) patch.type = text(body.type, MAX_TYPE)
  if ('detail' in body) patch.detail = text(body.detail, MAX_DETAIL)
  if ('people' in body) patch.people = cleanPeople(body.people)
  if ('sort_order' in body && typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.trunc(body.sort_order)
  }
  if (typeof body.status === 'string' && (STATUSES as readonly string[]).includes(body.status)) {
    patch.status = body.status
  }

  const { error: updErr } = await supabaseAdmin.from('production_projects').update(patch).eq('id', id)
  if (updErr) {
    console.error('[production/projects] update failed', updErr)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Missing project.' }, { status: 400 })

  // Soft delete: the project and its tasks drop off every board, but the tasks'
  // check-off trail survives (a hard delete would cascade the events away).
  const now = new Date().toISOString()
  const { error: projErr } = await supabaseAdmin
    .from('production_projects')
    .update({ archived_at: now, updated_at: now })
    .eq('id', id)
  if (projErr) {
    console.error('[production/projects] archive failed', projErr)
    return NextResponse.json({ error: 'Could not remove that project.' }, { status: 500 })
  }
  // Archive its tasks too so they can't be reached via a stale /board?project link.
  await supabaseAdmin
    .from('production_tasks')
    .update({ archived_at: now, updated_at: now })
    .eq('project_id', id)
    .is('archived_at', null)

  return NextResponse.json({ ok: true })
}
