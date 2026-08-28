import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { suggestTheme, applySuggestion } from '@/lib/pp-match'
import { sendWalkaroundHandover } from '@/lib/resend-post-production'
import { dueFor, type Category } from '@/lib/post-production'

/* PATCH  — edit the walk's own fields (serial, customer, notes)
 * POST   — hand it to engineering. `?action=submit`
 * DELETE — abandon an unsubmitted walk
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json().catch(() => null)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // No `unit_serial` here either — see the note in the POST route. The unit's
  // number is `job_number` and it is set once, when the walk starts.
  if (typeof body?.customer_name === 'string') patch.customer_name = body.customer_name.trim()
  if (typeof body?.model_number === 'string') patch.model_number = body.model_number.trim() || null
  if (typeof body?.notes === 'string') patch.notes = body.notes.trim() || null

  const { data, error } = await supabaseAdmin
    .from('pp_walkarounds').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[post-production/walkarounds] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ walkaround: data })
}

/**
 * Hand the walk to engineering.
 *
 * This is the transition the whole feature turns on. Up to here the findings are
 * drafts on somebody's phone that nag nobody; after it they are in the queue with
 * the meeting's two-week clock running on each one — "it needs to be responded to
 * within two weeks on what the solution is."
 *
 * ⚠️ THE CLOCK STARTS HERE AND NOT AT CAPTURE. A finding dictated on Monday and
 * submitted on Friday is due two weeks from Friday, because Friday is when
 * engineering could first have known about it. Dating from capture would hand
 * out four days of unearned lateness for the crime of walking a unit carefully.
 *
 * Recurrence matching runs after the status change and CANNOT fail the submit —
 * see the note at the bottom.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: walk } = await supabaseAdmin
    .from('pp_walkarounds').select('*').eq('id', id).maybeSingle()
  if (!walk) return NextResponse.json({ error: 'That walkaround no longer exists.' }, { status: 404 })
  if (walk.status === 'submitted') {
    return NextResponse.json({ error: 'That walkaround has already been handed over.' }, { status: 409 })
  }

  const { data: drafts } = await supabaseAdmin
    .from('pp_findings')
    .select('id, note, category, media')
    .eq('walkaround_id', id)
    .eq('status', 'draft')
    .order('seq', { ascending: true })

  // A finding with no words and no media is an empty card somebody tapped by
  // accident. Dropping them here rather than refusing the whole submit means the
  // person at the unit never has to tidy up before handing over.
  const real = (drafts ?? []).filter(d =>
    String(d.note ?? '').trim().length > 0 || (Array.isArray(d.media) && d.media.length > 0))
  const empty = (drafts ?? []).filter(d => !real.some(r => r.id === d.id))

  if (!real.length) {
    return NextResponse.json(
      { error: 'Nothing has been recorded on this walkaround yet.' },
      { status: 400 },
    )
  }

  const now = new Date()
  if (empty.length) {
    await supabaseAdmin.from('pp_findings').delete().in('id', empty.map(e => e.id))
  }

  const { error: upErr } = await supabaseAdmin
    .from('pp_findings')
    .update({ status: 'open', due_date: dueFor(now), updated_at: now.toISOString() })
    .in('id', real.map(r => r.id))
  if (upErr) {
    console.error('[post-production/walkarounds] submit failed:', upErr.message)
    return NextResponse.json({ error: 'Could not hand the walkaround over.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('pp_walkarounds')
    .update({ status: 'submitted', submitted_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', id)

  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'post_production.submit',
    entityType: 'pp_walkaround',
    entityId: id,
    summary: `Handed over ${real.length} post-production finding${real.length === 1 ? '' : 's'} on job ${walk.job_number}`,
    metadata: { job_number: walk.job_number, findings: real.length, discarded_empty: empty.length },
  })

  /* ── Recurrence matching, and why it is down here and wrapped ──────────────
     "Has this issue been identified before?" is the best part of the feature and
     it is still a bonus. The findings are already recorded, already dated and
     already in the queue by this line. If Claude is slow, down, or answers with
     something unparseable, the correct outcome is un-grouped findings a person
     can link by hand — not a 500 in front of somebody standing next to a unit
     who has just lost what they dictated.

     Sequential, not Promise.all: a walk produces a handful of findings, and
     firing them concurrently at the API buys nothing and risks a rate limit
     turning a nice-to-have into a partial, confusing result. */
  let grouped = 0
  for (const f of real) {
    try {
      const s = await suggestTheme(String(f.note ?? ''), (f.category as Category) ?? 'other', f.id)
      if (s.kind !== 'none') {
        const { themeId } = await applySuggestion(f.id, s, createdBy)
        if (themeId) grouped += 1
      }
    } catch (err) {
      console.warn('[post-production] recurrence match skipped for', f.id, err)
    }
  }

  // Mail is best-effort for the same reason. A send that throws must not undo a
  // handover that already happened.
  try {
    await sendWalkaroundHandover(walk.job_number, real.length, walk.walked_by_name, id)
  } catch (err) {
    console.error('[post-production] handover mail failed:', err)
  }

  return NextResponse.json({ ok: true, submitted: real.length, discarded: empty.length, grouped })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  // Only an unsubmitted walk. Once it has been handed over it is somebody else's
  // work queue, and deleting it would silently remove findings an engineer may
  // already have been chased about. Those get closed, not deleted.
  const { data: walk } = await supabaseAdmin
    .from('pp_walkarounds').select('status, job_number').eq('id', id).maybeSingle()
  if (!walk) return NextResponse.json({ ok: true })
  if (walk.status === 'submitted') {
    return NextResponse.json(
      { error: 'That walkaround has been handed over — close its findings instead of deleting them.' },
      { status: 409 },
    )
  }

  // Findings cascade with the walkaround (098). Storage objects are left behind
  // — invisible and harmless, the same call the equipment and tool photos make,
  // and it avoids deleting a blob a retry might still be pointing at.
  const { error } = await supabaseAdmin.from('pp_walkarounds').delete().eq('id', id)
  if (error) {
    console.error('[post-production/walkarounds] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not discard that walkaround.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
