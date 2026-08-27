import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { carryForwardThemes } from '@/lib/pp-data'
import { normalizeJobNumber } from '@/lib/post-production'

/* POST /api/admin/post-production/preflights — open a pre-production check.
 *
 * The other half of the loop, and the half the old spreadsheet never had:
 *
 *   "Let's click on pre-production meeting. Does it have this issue? Nope, I
 *    resolved that. Does it have this? … All those issues are automatically
 *    carried over to the next pre-production meeting."
 *
 * The checklist is GENERATED, not authored. Every recurring issue that is still
 * open, has genuinely happened more than once, and has been seen inside the
 * lookback window becomes a line — so nobody has to remember to add anything,
 * and nobody gets to quietly leave the awkward one off.
 *
 * ── The titles are SNAPSHOTS ───────────────────────────────────────────────
 * pp_preflight_items.title copies the theme's name at the moment of the meeting.
 * A pre-production record is a record of a conversation people had; re-titling a
 * theme next year must not silently rewrite what the room signed off on.
 */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const jobNumber = normalizeJobNumber(String(body?.job_number ?? ''))
  if (!jobNumber) return NextResponse.json({ error: 'Which job is this for?' }, { status: 400 })

  const actor = await getAdminSurfaceUser()
  const heldBy = await employeeIdForEmail(actor?.user.email)

  const { data: job } = await supabaseAdmin
    .from('eng_jobs').select('id').eq('job_number', jobNumber).maybeSingle()

  const { data: pf, error } = await supabaseAdmin
    .from('pp_preflights')
    .insert({
      job_number: jobNumber,
      job_id: job?.id ?? null,
      held_by: heldBy,
      held_by_name: actor?.displayName ?? '',
    })
    .select('*')
    .single()

  if (error || !pf) {
    console.error('[post-production/preflights] create failed:', error?.message)
    return NextResponse.json({ error: 'Could not start the pre-production check.' }, { status: 500 })
  }

  const themes = await carryForwardThemes()
  if (themes.length) {
    // upsert on (preflight_id, theme_id) — the unique index in 098 — so that
    // re-running the generator on an in-progress check tops it up with anything
    // new rather than duplicating what is already ticked.
    const { error: itemErr } = await supabaseAdmin
      .from('pp_preflight_items')
      .upsert(
        themes.map(t => ({ preflight_id: pf.id, theme_id: t.id, title: t.title })),
        { onConflict: 'preflight_id,theme_id', ignoreDuplicates: true },
      )
    if (itemErr) console.error('[post-production/preflights] items failed:', itemErr.message)
  }

  // An empty checklist is a RESULT, not an error — it is the state the whole
  // exercise is aiming at ("our goal here is to get these post production
  // meetings down where there's really not much to share at all"). The page says
  // so in words rather than showing a blank card.
  return NextResponse.json({ preflight: pf, items: themes.length })
}
