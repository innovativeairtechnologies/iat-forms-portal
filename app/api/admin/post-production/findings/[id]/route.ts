import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { sendFindingAssignment } from '@/lib/resend-post-production'
import { isCategory, isSeverity, type Media } from '@/lib/post-production'

/* PATCH  /api/admin/post-production/findings/[id]
 * DELETE /api/admin/post-production/findings/[id]  — drafts only
 *
 * One route handles capture edits (note, category, severity, media) and queue
 * work (assign, answer, close, group). Splitting them would mean two routes with
 * the same guard over the same row, and the phone genuinely does PATCH the same
 * fields the detail page does.
 */

function cleanMedia(v: unknown): Media[] {
  if (!Array.isArray(v)) return []
  const out: Media[] = []
  for (const m of v.slice(0, 12)) {
    if (!m || typeof m !== 'object') continue
    const kind = (m as Media).kind
    const path = String((m as Media).path ?? '')
    if (!['photo', 'video', 'audio'].includes(kind)) continue
    if (!/^(photo|video|audio)\/\d{10,}-[a-z0-9]+\.[a-z0-9]{2,5}$/i.test(path)) continue
    out.push({
      kind,
      path,
      mime: typeof (m as Media).mime === 'string' ? (m as Media).mime!.slice(0, 80) : undefined,
      bytes: Number.isFinite((m as Media).bytes) ? Number((m as Media).bytes) : undefined,
      duration_ms: Number.isFinite((m as Media).duration_ms) ? Number((m as Media).duration_ms) : undefined,
      // ⚠️ Carried THROUGH, not accepted as new input. Only the transcribe route
      // writes these; if they were dropped here, the walk client's next media
      // PATCH (removing an attachment, say) would silently erase a transcript
      // somebody had already paid a service to produce.
      transcript: typeof (m as Media).transcript === 'string' ? (m as Media).transcript!.slice(0, 20000) : undefined,
      transcribed_at: typeof (m as Media).transcribed_at === 'string' ? (m as Media).transcribed_at : undefined,
      transcript_by: typeof (m as Media).transcript_by === 'string' ? (m as Media).transcript_by!.slice(0, 40) : undefined,
    })
  }
  return out
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: before } = await supabaseAdmin
    .from('pp_findings').select('*').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'That finding no longer exists.' }, { status: 404 })

  const now = new Date()
  const actor = await getAdminSurfaceUser()
  const actorEmployee = await employeeIdForEmail(actor?.user.email)
  const patch: Record<string, unknown> = { updated_at: now.toISOString() }

  // ── Capture fields ────────────────────────────────────────────────────────
  if (typeof body.note === 'string') patch.note = body.note.slice(0, 8000)
  if (['typed', 'dictated', 'transcribed', 'mixed'].includes(body.note_source)) patch.note_source = body.note_source
  if (isCategory(body.category)) patch.category = body.category
  if (isSeverity(body.severity)) patch.severity = body.severity
  if (body.media !== undefined) patch.media = cleanMedia(body.media)

  // ── Ownership ─────────────────────────────────────────────────────────────
  let assignedTo: string | null = null
  if (body.assignee_id !== undefined) {
    const next = body.assignee_id ? String(body.assignee_id) : null
    patch.assignee_id = next
    patch.assigned_at = next ? now.toISOString() : null
    // A finding that has an owner is `assigned`; taking the owner away puts it
    // back to `open` rather than leaving it looking owned. Only from the two
    // pre-answer states — re-assigning something already answered must not
    // silently un-answer it.
    if (before.status === 'open' || before.status === 'assigned') {
      patch.status = next ? 'assigned' : 'open'
    }
    // ⚠️ Clear the chase stamps on a change of owner. The new owner's clock
    // starts fresh and the previous owner's silence is not their problem — same
    // rule as eng_tasks (096).
    if (next !== before.assignee_id) { patch.nudged_at = null; patch.escalated_at = null }
    if (next && next !== before.assignee_id) assignedTo = next
  }

  if (body.due_date !== undefined) {
    patch.due_date = body.due_date ? String(body.due_date).slice(0, 10) : null
  }

  // ── The answer ────────────────────────────────────────────────────────────
  //
  // ⚠️ An answer moves a finding to `answered`, NOT to `closed`. The person who
  // raised it accepts or reopens. An engineer writing "we changed the bracket"
  // does not also get to decide the matter is settled — a queue whose owner is
  // also its judge is a queue that empties itself, which is how the spreadsheet
  // this replaces ended up with hundreds of rows and no outcomes.
  if (typeof body.resolution === 'string') {
    const text = body.resolution.trim()
    patch.resolution = text || null
    if (text && before.status !== 'closed') {
      patch.status = 'answered'
      patch.resolved_by = actorEmployee
      patch.resolved_at = now.toISOString()
    }
    if (!text && before.status === 'answered') {
      patch.status = before.assignee_id ? 'assigned' : 'open'
      patch.resolved_by = null
      patch.resolved_at = null
    }
  }

  // ── Explicit status moves (accept, reopen, mark duplicate) ────────────────
  if (typeof body.status === 'string' && ['open', 'assigned', 'answered', 'closed', 'duplicate'].includes(body.status)) {
    patch.status = body.status
    if (body.status === 'closed' && !before.resolved_at) {
      patch.resolved_by = actorEmployee
      patch.resolved_at = now.toISOString()
    }
    // Reopening restarts the chase: clearing the stamp is what lets the sweep
    // pick it up again tomorrow instead of treating it as already-chased.
    if (body.status === 'open' || body.status === 'assigned') {
      patch.nudged_at = null
      patch.escalated_at = null
    }
  }

  // ── Grouping ──────────────────────────────────────────────────────────────
  //
  // Any theme change made through this route is a HUMAN one — a person opened
  // the finding and either agreed with the model's suggestion or picked a
  // different group. That is what makes the count on the themes board
  // defensible, so theme_source is stamped 'human' here and only lib/pp-match.ts
  // ever writes 'ai'.
  if (body.theme_id !== undefined) {
    const next = body.theme_id ? String(body.theme_id) : null
    patch.theme_id = next
    patch.theme_source = next ? 'human' : null
    if (!next) patch.theme_note = null
  }
  // Confirming the model's suggestion without changing which theme it is.
  if (body.confirm_theme === true && before.theme_id) {
    patch.theme_source = 'human'
  }

  const { data, error } = await supabaseAdmin
    .from('pp_findings').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[post-production/findings] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  // Audit only the consequential moves. Editing the wording of your own draft is
  // not an accountability event; handing somebody two weeks of work is.
  if (assignedTo || patch.status === 'closed' || patch.status === 'answered') {
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: assignedTo ? 'post_production.assign' : `post_production.${patch.status}`,
      entityType: 'pp_finding',
      entityId: id,
      summary: assignedTo
        ? `Assigned post-production finding on job ${before.job_number}`
        : `Post-production finding on job ${before.job_number} marked ${patch.status}`,
      metadata: { job_number: before.job_number, from: before.status, to: patch.status ?? before.status },
    })
  }

  // Best-effort, and deliberately AFTER the write. A finding that was assigned
  // and whose notification bounced is a finding that is assigned; the daily
  // sweep will chase it. A failed send must never roll back the assignment.
  if (assignedTo) {
    try {
      await sendFindingAssignment(assignedTo, data)
    } catch (err) {
      console.error('[post-production] assignment mail failed:', err)
    }
  }

  return NextResponse.json({ finding: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  // Drafts only. A submitted finding belongs to somebody's queue and may already
  // have been chased; those get closed, which leaves a record of the decision.
  const { data: f } = await supabaseAdmin
    .from('pp_findings').select('status').eq('id', id).maybeSingle()
  if (!f) return NextResponse.json({ ok: true })
  if (f.status !== 'draft') {
    return NextResponse.json(
      { error: 'That finding has been handed over — close it instead of deleting it.' },
      { status: 409 },
    )
  }

  const { error } = await supabaseAdmin.from('pp_findings').delete().eq('id', id)
  if (error) {
    console.error('[post-production/findings] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not remove that finding.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
