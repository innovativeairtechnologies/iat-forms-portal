import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { normalizeJobNumber } from '@/lib/post-production'

/* POST /api/admin/post-production/walkarounds — start a walk.
 *
 * Called the instant somebody has typed a job number, BEFORE they have recorded
 * anything. That is the point: capture happens on a shop floor with unreliable
 * signal, and the row has to exist before the first photo so every subsequent
 * action is a small save against something that is already there. A dropped
 * connection then costs the last action, never the walk.
 *
 * ⚠️ Nothing here is unique and nothing here blocks. Two people walking job 4153
 * make two walkarounds — "maybe I'll fill one out, Devin might fill one out…
 * there might be two underneath the same job, which is fine" — and a job number
 * with no matching eng_jobs row still starts a walk. A capture surface that can
 * refuse to capture is a capture surface people stop opening.
 */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const jobNumber = normalizeJobNumber(String(body?.job_number ?? ''))
  if (!jobNumber) {
    return NextResponse.json(
      { error: 'A job number is needed — it is how the finding gets back to the right unit.' },
      { status: 400 },
    )
  }

  const actor = await getAdminSurfaceUser()
  const walkedBy = await employeeIdForEmail(actor?.user.email)

  // Link to the engineering job when one exists, and inherit its customer and
  // model so nobody types them at the unit. Snapshots, not a join: a walk is a
  // record of what was in front of somebody on a day.
  const { data: job } = await supabaseAdmin
    .from('eng_jobs')
    .select('id, customer_name, model_number')
    .eq('job_number', jobNumber)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('pp_walkarounds')
    .insert({
      job_number: jobNumber,
      job_id: job?.id ?? null,
      unit_serial: body?.unit_serial ? String(body.unit_serial).trim().slice(0, 64) : null,
      customer_name: job?.customer_name ?? String(body?.customer_name ?? '').trim(),
      model_number: job?.model_number ?? (body?.model_number ? String(body.model_number).trim() : null),
      walked_by: walkedBy,
      // Snapshot the name too. employees rows get deactivated and renamed, and a
      // walkaround from two years ago should still say who walked it.
      //
      // `displayName` and not the raw profile field: display_name is
      // invite-typed and a good number of rows hold an email local-part
      // ("lee.childers"). getAdminSurfaceUser has already put it through
      // prettyName, so what gets snapshotted here is what a person would read.
      walked_by_name: actor?.displayName ?? '',
    })
    .select('*')
    .single()

  if (error) {
    console.error('[post-production/walkarounds] create failed:', error.message)
    return NextResponse.json({ error: 'Could not start the walkaround.' }, { status: 500 })
  }

  return NextResponse.json({ walkaround: data })
}
