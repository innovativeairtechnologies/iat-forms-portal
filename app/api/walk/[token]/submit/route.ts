import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { resolveTag, walkForTag } from '@/lib/pp-tag'
import { applySuggestion, suggestTheme } from '@/lib/pp-match'
import { sendWalkaroundHandover } from '@/lib/resend-post-production'
import { dueFor, type Category } from '@/lib/post-production'

/* POST /api/walk/<token>/submit — hand a scanned walkaround to engineering.
 *
 * The same transition the signed-in route performs, and deliberately identical
 * in effect: findings go from draft to open, each gets the meeting's two-week
 * clock dated from TODAY (when engineering could first have known), recurrence
 * matching runs, and the leads get one email.
 *
 * A tag walk is not second-class work. The whole point of putting a sticker on
 * the machine was that the person who wired it has something to say and no
 * account to say it with; routing their findings into a lesser queue would
 * reproduce the problem. What differs is provenance, which is carried on the
 * row (source='tag', walked_by NULL, self-declared name) and shown on every
 * screen — not the priority.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, { name: 'walk-submit', max: 60, windowSeconds: 600 })
  if (limited) return limited

  const { token } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const body = await req.json().catch(() => ({}))
  const walk = await walkForTag(tag.id, String(body?.walkaround_id ?? ''))
  if (walk instanceof NextResponse) return walk

  const { data: drafts } = await supabaseAdmin
    .from('pp_findings')
    .select('id, note, category, media')
    .eq('walkaround_id', walk.id)
    .eq('status', 'draft')
    .order('seq', { ascending: true })

  // A note with no words and no media is a card somebody tapped by accident.
  // Dropping them here rather than refusing the whole submit means the person at
  // the unit never has to tidy up before handing over.
  const real = (drafts ?? []).filter(d =>
    String(d.note ?? '').trim().length > 0 || (Array.isArray(d.media) && d.media.length > 0))
  const empty = (drafts ?? []).filter(d => !real.some(r => r.id === d.id))

  if (!real.length) {
    return NextResponse.json({ error: 'Nothing has been recorded yet.' }, { status: 400 })
  }

  const now = new Date()
  if (empty.length) {
    await supabaseAdmin.from('pp_findings').delete().in('id', empty.map(e => e.id))
  }

  const { error } = await supabaseAdmin
    .from('pp_findings')
    .update({ status: 'open', due_date: dueFor(now), updated_at: now.toISOString() })
    .in('id', real.map(r => r.id))
  if (error) {
    console.error('[walk/submit] failed:', error.message)
    return NextResponse.json({ error: 'Could not hand it over.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('pp_walkarounds')
    .update({ status: 'submitted', submitted_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', walk.id)

  // ── Recurrence matching. Best-effort, exactly as on the signed-in route ────
  // The findings are already recorded, dated and in the queue by this line. If
  // Claude is slow or answers with something unparseable, the right outcome is
  // un-grouped findings a person can link by hand — not a 500 in front of
  // somebody standing next to a unit who has just lost what they dictated.
  //
  // created_by is null: nobody was signed in, and inventing an author for a
  // theme raised from the floor would be a small lie in a place that matters.
  let grouped = 0
  for (const f of real) {
    try {
      const s = await suggestTheme(String(f.note ?? ''), (f.category as Category) ?? 'other', f.id)
      if (s.kind !== 'none') {
        const { themeId } = await applySuggestion(f.id, s, null)
        if (themeId) grouped += 1
      }
    } catch (err) {
      console.warn('[walk/submit] recurrence match skipped for', f.id, err)
    }
  }

  try {
    const { data: w } = await supabaseAdmin
      .from('pp_walkarounds').select('walked_by_name').eq('id', walk.id).maybeSingle()
    await sendWalkaroundHandover(walk.job_number, real.length, (w?.walked_by_name as string) ?? '', walk.id)
  } catch (err) {
    console.error('[walk/submit] handover mail failed:', err)
  }

  return NextResponse.json({ ok: true, submitted: real.length, discarded: empty.length, grouped })
}
