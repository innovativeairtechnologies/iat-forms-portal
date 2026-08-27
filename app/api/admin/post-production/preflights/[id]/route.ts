import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { carryForwardThemes } from '@/lib/pp-data'
import { PREFLIGHT_VERDICTS, type PreflightVerdict } from '@/lib/post-production'

/* PATCH /api/admin/post-production/preflights/[id]
 *
 * Three shapes, because a pre-production meeting only does three things:
 *   { item: { id, verdict, note } }  — tick one line
 *   { notes }                        — the meeting's own notes
 *   { complete: true }               — close it out
 *   { refresh: true }                — top up from themes raised since it opened
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: pf } = await supabaseAdmin
    .from('pp_preflights').select('*').eq('id', id).maybeSingle()
  if (!pf) return NextResponse.json({ error: 'That check no longer exists.' }, { status: 404 })

  const now = new Date()
  const actor = await getAdminSurfaceUser()

  // ── One line ──────────────────────────────────────────────────────────────
  if (body.item && typeof body.item === 'object') {
    const itemId = String(body.item.id ?? '')
    const verdict = body.item.verdict as PreflightVerdict
    if (!itemId || !(PREFLIGHT_VERDICTS as readonly string[]).includes(verdict)) {
      return NextResponse.json({ error: 'Invalid check.' }, { status: 400 })
    }

    const checkedBy = await employeeIdForEmail(actor?.user.email)
    const { data, error } = await supabaseAdmin
      .from('pp_preflight_items')
      .update({
        verdict,
        note: typeof body.item.note === 'string' ? body.item.note.trim().slice(0, 1000) || null : undefined,
        // Back to 'pending' clears the stamps, so an un-ticked line reads as
        // genuinely un-discussed rather than as decided-then-forgotten.
        checked_by: verdict === 'pending' ? null : checkedBy,
        checked_at: verdict === 'pending' ? null : now.toISOString(),
      })
      .eq('id', itemId)
      .eq('preflight_id', id)   // scoped: an id from another check must not be writable through this one
      .select('*')
      .single()

    if (error) {
      console.error('[post-production/preflights] item failed:', error.message)
      return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
    }
    return NextResponse.json({ item: data })
  }

  // ── Top up ────────────────────────────────────────────────────────────────
  // A check opened on Monday and finished on Thursday should pick up anything
  // raised in between rather than quietly missing it.
  if (body.refresh === true) {
    const themes = await carryForwardThemes()
    if (themes.length) {
      await supabaseAdmin
        .from('pp_preflight_items')
        .upsert(
          themes.map(t => ({ preflight_id: id, theme_id: t.id, title: t.title })),
          { onConflict: 'preflight_id,theme_id', ignoreDuplicates: true },
        )
    }
    return NextResponse.json({ ok: true, considered: themes.length })
  }

  // ── The check itself ──────────────────────────────────────────────────────
  const patch: Record<string, unknown> = { updated_at: now.toISOString() }
  if (typeof body.notes === 'string') patch.notes = body.notes.trim().slice(0, 8000) || null
  if (body.complete === true) {
    patch.status = 'complete'
    patch.completed_at = now.toISOString()
  }
  if (body.complete === false) {
    patch.status = 'in_progress'
    patch.completed_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('pp_preflights').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[post-production/preflights] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  if (body.complete === true) {
    const { count } = await supabaseAdmin
      .from('pp_preflight_items')
      .select('*', { count: 'exact', head: true })
      .eq('preflight_id', id)
      .eq('verdict', 'risk')

    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: 'post_production.preflight_complete',
      entityType: 'pp_preflight',
      entityId: id,
      summary: `Pre-production check completed for job ${pf.job_number}`,
      // The accepted risks are the part worth being able to find again later:
      // "we knew about this one and built it anyway" is the sentence a warranty
      // conversation two years from now turns on.
      metadata: { job_number: pf.job_number, accepted_risks: count ?? 0 },
    })
  }

  return NextResponse.json({ preflight: data })
}
