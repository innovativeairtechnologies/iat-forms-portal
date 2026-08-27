import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { isCategory, isSeverity, type Media } from '@/lib/post-production'

/* POST /api/admin/post-production/findings — add a finding to a walk.
 *
 * Created as a DRAFT and saved the moment a card is opened, before there are any
 * words in it. That is what lets the phone stream every photo, clip and sentence
 * into a row that already exists instead of holding a growing payload in memory
 * until a Submit button that might never get pressed on shop wifi.
 */

const NOTE_SOURCES = ['typed', 'dictated', 'transcribed', 'mixed']

/** Media is written by the client, so it is re-shaped here rather than trusted.
 *  Anything that is not one of the three kinds with a plausible path is dropped
 *  — a rogue entry would end up in an <img src> or a <video src> on this page. */
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
    })
  }
  return out
}

export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const walkaroundId = String(body?.walkaround_id ?? '')
  if (!walkaroundId) return NextResponse.json({ error: 'Missing walkaround.' }, { status: 400 })

  const { data: walk } = await supabaseAdmin
    .from('pp_walkarounds').select('id, job_number, job_id, status').eq('id', walkaroundId).maybeSingle()
  if (!walk) return NextResponse.json({ error: 'That walkaround no longer exists.' }, { status: 404 })
  if (walk.status === 'submitted') {
    return NextResponse.json(
      { error: 'That walkaround has been handed over. Start a new one to add more.' },
      { status: 409 },
    )
  }

  // Next number in the walk, so a finding can be referred to out loud as "4153,
  // number three" while two people are standing next to the unit. A race here
  // would produce two number-threes, which is cosmetic — the id is the identity.
  const { data: last } = await supabaseAdmin
    .from('pp_findings').select('seq').eq('walkaround_id', walkaroundId)
    .order('seq', { ascending: false }).limit(1)
  const seq = ((last ?? [])[0]?.seq ?? 0) + 1

  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  const { data, error } = await supabaseAdmin
    .from('pp_findings')
    .insert({
      walkaround_id: walkaroundId,
      job_number: walk.job_number,
      job_id: walk.job_id,
      seq,
      note: String(body?.note ?? '').slice(0, 8000),
      note_source: NOTE_SOURCES.includes(body?.note_source) ? body.note_source : 'typed',
      category: isCategory(body?.category) ? body.category : 'other',
      severity: isSeverity(body?.severity) ? body.severity : 'should_fix',
      media: cleanMedia(body?.media),
      status: 'draft',
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[post-production/findings] create failed:', error.message)
    return NextResponse.json({ error: 'Could not add that finding.' }, { status: 500 })
  }
  return NextResponse.json({ finding: data })
}
