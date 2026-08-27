import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_FINDINGS_PER_WALK, resolveTag, walkForTag } from '@/lib/pp-tag'

/* POST /api/walk/<token>/findings — add a draft finding to a scanned walk.
 *
 * PUBLIC. The walkaround id comes from the body, so it is verified to belong to
 * THIS tag and to still be open before anything is written — walkForTag() is
 * what stops the sticker from the test bay being a write key for every walk in
 * the building. See lib/pp-tag.ts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, { name: 'walk-finding', max: 200, windowSeconds: 600 })
  if (limited) return limited

  const { token } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const body = await req.json().catch(() => ({}))
  const walk = await walkForTag(tag.id, String(body?.walkaround_id ?? ''))
  if (walk instanceof NextResponse) return walk

  // Hard ceiling that holds even when the rate limiter is down (it fails open by
  // design). Far above any real walk — the biggest review anybody described was
  // a dozen observations — and it says so in a sentence rather than truncating.
  const { count } = await supabaseAdmin
    .from('pp_findings')
    .select('*', { count: 'exact', head: true })
    .eq('walkaround_id', walk.id)

  if ((count ?? 0) >= MAX_FINDINGS_PER_WALK) {
    return NextResponse.json(
      { error: `That is ${MAX_FINDINGS_PER_WALK} notes on one walkaround. Hand this one over and start another.` },
      { status: 400 },
    )
  }

  const { data: last } = await supabaseAdmin
    .from('pp_findings').select('seq').eq('walkaround_id', walk.id)
    .order('seq', { ascending: false }).limit(1)
  const seq = ((last ?? [])[0]?.seq ?? 0) + 1

  // Nothing from the body survives except the walkaround it hangs off. The note,
  // category, severity and media all arrive later through PATCH, which validates
  // them; creating an empty draft here is what lets the phone save as it goes.
  const { data, error } = await supabaseAdmin
    .from('pp_findings')
    .insert({
      walkaround_id: walk.id,
      job_number: walk.job_number,
      job_id: walk.job_id,
      seq,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    console.error('[walk/findings] create failed:', error.message)
    return NextResponse.json({ error: 'Could not add that note.' }, { status: 500 })
  }
  return NextResponse.json({ finding: data })
}
