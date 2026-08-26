import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { generateTasksForJob, redateJob } from '@/lib/eng-data'
import { COMPLEXITIES, JOB_STATUSES, type EngJob } from '@/lib/engineering'

/* PATCH / DELETE one engineering job, plus the two plan actions.
 *
 * `action: 'regenerate'` adds any playbook steps this job is missing. It never
 * touches a task that already exists — see generateTasksForJob.
 * `action: 'redate'`     re-applies the playbook's cycle days to OPEN tasks
 *                        after the PO date moved.
 *
 * Redating is an explicit action and never a side effect of editing po_date. A
 * due date is a promise somebody made; moving five of them out from under the
 * person who owns them, silently, because a date field was corrected, is how a
 * schedule stops meaning anything.
 */

const EDITABLE = ['customer_name', 'project_name', 'model_number', 'po_date', 'ship_date', 'deal_id', 'customer_id', 'notes'] as const

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await props.params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: job } = await supabaseAdmin.from('eng_jobs').select('*').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const actor = await getAdminSurfaceUser()

  // ── Plan actions ──────────────────────────────────────────────────────────
  if (body.action === 'regenerate' || body.action === 'redate') {
    try {
      const createdBy = await employeeIdForEmail(actor?.user.email)
      const result = body.action === 'regenerate'
        ? await generateTasksForJob(job as EngJob, { createdBy })
        : await redateJob(job as EngJob)
      await logAudit({
        actor: { id: actor?.user.id, name: actor?.displayName },
        action: `eng.job.${body.action}`,
        entityType: 'eng_job',
        entityId: id,
        summary: body.action === 'regenerate'
          ? `Regenerated the plan for job ${job.job_number} — ${'inserted' in result ? result.inserted : 0} task(s) added`
          : `Re-dated job ${job.job_number} from its PO date — ${'updated' in result ? result.updated : 0} open task(s) moved`,
        metadata: { ...result, po_date: job.po_date },
      })
      return NextResponse.json({ ok: true, ...result })
    } catch (err) {
      console.error('[eng/jobs] action failed:', err)
      return NextResponse.json({ error: 'That action could not be completed.' }, { status: 500 })
    }
  }

  // ── Field edits ───────────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue
    patch[key] = body[key] === '' ? null : body[key]
  }
  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    patch.status = body.status
  }
  if (body.complexity !== undefined) {
    if (!COMPLEXITIES.includes(body.complexity)) return NextResponse.json({ error: 'Unknown complexity' }, { status: 400 })
    patch.complexity = body.complexity
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data: updated, error } = await supabaseAdmin
    .from('eng_jobs').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[eng/jobs] update failed:', error.message)
    return NextResponse.json({ error: 'Could not save the job.' }, { status: 500 })
  }

  // Only log what changed, and only when something consequential did. Every
  // keystroke in a notes field is not accountability, it is noise in the trail.
  const notable = Object.keys(patch).filter(k => k !== 'notes')
  if (notable.length) {
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: 'eng.job.update',
      entityType: 'eng_job',
      entityId: id,
      summary: `Updated job ${job.job_number} — ${notable.join(', ')}`,
      metadata: { before: Object.fromEntries(notable.map(k => [k, (job as Record<string, unknown>)[k]])), after: Object.fromEntries(notable.map(k => [k, patch[k]])) },
    })
  }

  return NextResponse.json({ job: updated })
}

/* Deleting a job cascades its tasks (ON DELETE CASCADE). FULL ADMIN ONLY —
 * narrower than the rest of this route on purpose: a job carries the lead-time
 * history every number on the leadership report is computed from, and one
 * mis-click would remove that silently. Everyone else marks it cancelled, which
 * keeps the record and takes it off the board. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only a full admin can delete a job. Set it to Cancelled to take it off the board and keep the record.' },
      { status: 403 },
    )
  }

  const { id } = await props.params
  const { data: job } = await supabaseAdmin.from('eng_jobs').select('job_number').eq('id', id).maybeSingle()
  const { error } = await supabaseAdmin.from('eng_jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete the job.' }, { status: 500 })

  const actor = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'eng.job.delete',
    entityType: 'eng_job',
    entityId: id,
    summary: `Deleted engineering job ${job?.job_number ?? id} and every task on it`,
  })
  return NextResponse.json({ ok: true })
}
