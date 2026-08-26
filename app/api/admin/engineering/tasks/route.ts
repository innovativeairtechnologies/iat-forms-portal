import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { getPlaybook, listAssignees } from '@/lib/eng-data'
import { STREAMS, addDays, type Stream } from '@/lib/engineering'

/* POST /api/admin/engineering/tasks — add one task by hand.
 *
 * Two shapes, one route:
 *
 *   { job_id, stream, step }  — an ON-DEMAND playbook step. A revision round, a
 *     production support call. The title, target hours, band, priority and cycle
 *     all come from the playbook, so a hand-added revision is measured against
 *     the same 1-hour / 3-day standard as any other.
 *
 *   { stream: 'support', title }  — free-form. Sales support, training, R&D. No
 *     job, no template. This is the row that makes "where did the week go"
 *     answerable, so it is deliberately as cheap to add as possible.
 */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const stream = body.stream as Stream
  if (!STREAMS.includes(stream)) return NextResponse.json({ error: 'Unknown stream' }, { status: 400 })

  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  // Resolve the playbook step if one was named, so a hand-added task inherits
  // the same standard a generated one gets.
  const pb = await getPlaybook()
  const stepDef = body.step
    ? pb.streams.find(s => s.stream === stream)?.steps.find(s => s.key === body.step)
    : undefined

  const title = String(body.title ?? stepDef?.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 })

  // The anchor for a generated due date: the job's PO date when there is a job,
  // otherwise today. A standing support task has no PO to count from, and today
  // is the honest anchor for work that starts now.
  let anchor: string | null = null
  if (body.job_id) {
    const { data: job } = await supabaseAdmin.from('eng_jobs').select('po_date').eq('id', body.job_id).maybeSingle()
    anchor = job?.po_date ?? null
  } else {
    anchor = new Date().toISOString().slice(0, 10)
  }

  // An assignee must be someone who can reach the board — the same rule the RFQ
  // queue applies. An unknown id is a 400, never a silently unassigned task.
  let assigneeId: string | null = null
  if (body.assignee_id) {
    const roster = await listAssignees()
    if (!roster.some(r => r.id === body.assignee_id)) {
      return NextResponse.json({ error: 'That person cannot be assigned engineering tasks.' }, { status: 400 })
    }
    assigneeId = body.assignee_id
  }

  const dueDate = body.due_date
    ?? (anchor && stepDef?.cycleDays != null ? addDays(anchor, stepDef.cycleDays) : null)

  const { data, error } = await supabaseAdmin
    .from('eng_tasks')
    .insert({
      job_id: body.job_id || null,
      stream,
      // ⚠️ A free-form task gets `custom:<slug-of-title>`, not a bare 'custom'.
      // The unique index is (job_id, stream, step), so every ad-hoc task on a job
      // sharing the literal key 'custom' would mean the SECOND one 409s — and
      // adding two support tasks to one job is an ordinary thing to do. The
      // `custom:` prefix still lets step-level reporting exclude ad-hoc work with
      // a prefix match, which is the reason the key is namespaced at all.
      step: stepDef?.key ?? `custom:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task'}`,
      title,
      assignee_id: assigneeId,
      progress_band: stepDef?.band ?? null,
      target_hours: body.target_hours ?? stepDef?.targetHours ?? null,
      due_date: dueDate,
      priority: body.priority ?? stepDef?.priority ?? 3,
      sort_order: body.sort_order ?? 999,
      notes: body.notes ? String(body.notes) : null,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = the (job_id, stream, step) unique index. A second revision round
    // on the same job hits this, which is a real thing people do — say so.
    if (error.code === '23505') {
      return NextResponse.json({ error: `This job already has a "${title}". Rename it (e.g. "${title} — round 2") to add another.` }, { status: 409 })
    }
    console.error('[eng/tasks] create failed:', error.message)
    return NextResponse.json({ error: 'Could not add the task.' }, { status: 500 })
  }

  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'eng.task.create',
    entityType: 'eng_task',
    entityId: data.id,
    summary: `Added engineering task "${title}"`,
    metadata: { stream, step: stepDef?.key ?? 'custom', job_id: body.job_id ?? null },
  })

  return NextResponse.json({ id: data.id })
}
