import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { generateTasksForJob } from '@/lib/eng-data'
import { COMPLEXITIES, JOB_STATUSES, type Complexity, type EngJob } from '@/lib/engineering'

/* POST /api/admin/engineering/jobs — open a job and generate its plan.
 *
 * This is the automation the meeting asked for, in one request: a job number, a
 * customer and a PO date go in; every task the playbook says that job needs
 * comes out, dated from the PO and priced at the workbook's target hours.
 *
 * ⚠️ The job is created FIRST and the plan generated second, and a failed
 * generation does NOT roll the job back. That is deliberate. A job that exists
 * with no tasks is visible, obviously wrong, and one click from being fixed
 * ("Regenerate plan" on the detail page). A PO that silently created nothing
 * because step seven of the playbook had a bad cycle number is invisible until
 * somebody misses a ship date. Errors are reported, not swallowed — the response
 * carries `generated` so the caller can say what happened.
 */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const jobNumber = String(body.job_number ?? '').trim()
  if (!jobNumber) {
    return NextResponse.json({ error: 'A job number is required — it is how everyone already refers to the job.' }, { status: 400 })
  }

  const complexity: Complexity = COMPLEXITIES.includes(body.complexity) ? body.complexity : 'std_minor'
  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  const { data: job, error } = await supabaseAdmin
    .from('eng_jobs')
    .insert({
      job_number: jobNumber,
      customer_name: String(body.customer_name ?? '').trim(),
      project_name: String(body.project_name ?? '').trim(),
      model_number: body.model_number ? String(body.model_number).trim() : null,
      complexity,
      po_date: body.po_date || null,
      ship_date: body.ship_date || null,
      status: JOB_STATUSES.includes(body.status) ? body.status : 'active',
      deal_id: body.deal_id || null,
      customer_id: body.customer_id || null,
      notes: body.notes ? String(body.notes) : null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation on job_number. Say which job, because "duplicate
    // key value violates unique constraint" is not a sentence anyone can act on.
    if (error.code === '23505') {
      return NextResponse.json({ error: `Job ${jobNumber} is already open.` }, { status: 409 })
    }
    console.error('[eng/jobs] create failed:', error.message)
    return NextResponse.json({ error: 'Could not create the job.' }, { status: 500 })
  }

  let generated = 0
  let generateError: string | null = null
  try {
    generated = (await generateTasksForJob(job as EngJob, { createdBy })).inserted
  } catch (err) {
    generateError = err instanceof Error ? err.message : String(err)
    console.error('[eng/jobs] plan generation failed for', jobNumber, generateError)
  }

  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'eng.job.create',
    entityType: 'eng_job',
    entityId: job.id,
    summary: `Opened engineering job ${jobNumber}${generated ? ` with ${generated} tasks` : ' (no tasks generated)'}`,
    metadata: { job_number: jobNumber, complexity, po_date: job.po_date, generated, generateError },
  })

  return NextResponse.json({ job, generated, generateError })
}
