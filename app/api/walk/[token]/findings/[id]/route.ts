import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_MEDIA_PER_FINDING, findingForTag, resolveTag } from '@/lib/pp-tag'
import { isCategory, isSeverity, type Media } from '@/lib/post-production'

/* PATCH  /api/walk/<token>/findings/<id> — save as you walk
 * DELETE /api/walk/<token>/findings/<id> — remove a note
 *
 * PUBLIC. findingForTag() verifies the note hangs off a walkaround belonging to
 * THIS tag and is still a draft, before anything is written.
 *
 * ⚠️ THE WHITELIST BELOW IS THE SECURITY BOUNDARY, and it is deliberately much
 * shorter than the admin PATCH route's. A scanner may write what they saw. They
 * may NOT set an assignee, a due date, a status, a resolution or a theme —
 * everything, in other words, that the accountability half of this feature is
 * made of. Those are engineering's to set from inside the portal, and a sticker
 * on a machine must never be able to close its own finding.
 */

const NOTE_SOURCES = ['typed', 'dictated', 'transcribed', 'mixed']

/** Media is written by the client, so it is re-shaped rather than trusted.
 *  Anything that is not one of the three kinds with a path in exactly the shape
 *  upload-url mints is dropped — a rogue entry would end up in an <img src> on
 *  an admin's screen. */
function cleanMedia(v: unknown): Media[] {
  if (!Array.isArray(v)) return []
  const out: Media[] = []
  for (const m of v.slice(0, MAX_MEDIA_PER_FINDING)) {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  // High: the note autosaves on a 700ms debounce while somebody dictates, and a
  // three-person walk on one shop IP is legitimately a few hundred writes.
  const limited = await rateLimit(req, { name: 'walk-patch', max: 900, windowSeconds: 600 })
  if (limited) return limited

  const { token, id } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const owned = await findingForTag(tag.id, id)
  if (owned instanceof NextResponse) return owned

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body?.note === 'string') patch.note = body.note.slice(0, 8000)
  if (NOTE_SOURCES.includes(body?.note_source)) patch.note_source = body.note_source
  if (isCategory(body?.category)) patch.category = body.category
  if (isSeverity(body?.severity)) patch.severity = body.severity
  if (body?.media !== undefined) patch.media = cleanMedia(body.media)

  const { data, error } = await supabaseAdmin
    .from('pp_findings')
    .update(patch)
    .eq('id', id)
    // Belt to findingForTag's braces: even if that check were ever loosened,
    // this route can still only touch a draft.
    .eq('status', 'draft')
    .select('*')
    .single()

  if (error) {
    console.error('[walk/findings] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ finding: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const limited = await rateLimit(req, { name: 'walk-delete', max: 200, windowSeconds: 600 })
  if (limited) return limited

  const { token, id } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const owned = await findingForTag(tag.id, id)
  if (owned instanceof NextResponse) return owned

  const { error } = await supabaseAdmin
    .from('pp_findings').delete().eq('id', id).eq('status', 'draft')
  if (error) {
    console.error('[walk/findings] delete failed:', error.message)
    return NextResponse.json({ error: 'Could not remove that note.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
