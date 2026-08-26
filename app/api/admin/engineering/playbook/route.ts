import { NextRequest, NextResponse } from 'next/server'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { savePlaybook } from '@/lib/eng-data'
import { coercePlaybook } from '@/lib/eng-playbook'

/* PUT /api/admin/engineering/playbook — the scheduling rules.
 *
 * Gated tighter than the rest of the section: `{ playbook: true }` requires
 * admin or the engineering role. Working the board and changing the standard
 * every job is measured against are different decisions.
 *
 * The body is passed through coercePlaybook before it is stored, so a client
 * that sends a string where a number belongs, or drops a stream, gets a valid
 * playbook rather than one that generates NaN hours into every future job.
 *
 * NOT versioned, unlike the SOO clause library. Tasks snapshot their title,
 * hours, band and dates at generation time, so editing this never rewrites what
 * a finished task said it was — which is the thing versioning would have been
 * protecting. The audit entry records who changed it and when.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireEngineeringAuth({ playbook: true })
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const actor = await getAdminSurfaceUser()
  const employeeId = await employeeIdForEmail(actor?.user.email)

  try {
    const saved = await savePlaybook(coercePlaybook(body.playbook ?? body), employeeId)
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: 'eng.playbook.update',
      entityType: 'eng_playbook',
      entityId: '1',
      summary: 'Updated the engineering scheduling rules',
      metadata: {
        // The whole blob would flood the trail. What a reader needs is a shape
        // they can compare against the next entry.
        steps: saved.streams.map(s => ({ stream: s.stream, steps: s.steps.length, auto: s.autoGenerate })),
        nudgeLeadDays: saved.nudgeLeadDays,
        escalateAfterDays: saved.escalateAfterDays,
        staleAfterDays: saved.staleAfterDays,
      },
    })
    return NextResponse.json({ playbook: saved })
  } catch (err) {
    console.error('[eng/playbook] save failed:', err)
    return NextResponse.json({ error: 'Could not save the scheduling rules.' }, { status: 500 })
  }
}
