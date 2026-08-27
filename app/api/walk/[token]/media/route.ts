import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { resolveTag } from '@/lib/pp-tag'

/* GET /api/walk/<token>/media?path=… — read one attachment back, no login.
 *
 * Only exists so a thumbnail survives a page reload mid-walk. Freshly-uploaded
 * media previews from a local object URL and never touches this route.
 *
 * ⚠️ UNLIKE the admin media route, path SHAPE IS NOT ENOUGH HERE. That route is
 * behind requireEngineeringAuth and every viewer may see every object in the
 * bucket, so bucket membership is the authorization. This one is behind a
 * sticker taped to a machine, so it additionally proves the requested object is
 * attached to a finding on a walkaround belonging to THIS tag. Without that
 * check, one leaked token would read every photograph and voice note in
 * post-production, including walks filed by engineers about other customers'
 * units.
 *
 * The `media @> [{"path": …}]` containment test is why pp_findings.media is
 * jsonb rather than text — it is one indexed-shape query rather than pulling
 * every row and scanning arrays in JS.
 */

const PATH_RE = /^(photo|video|audio)\/\d{10,}-[a-z0-9]+\.[a-z0-9]{2,5}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, { name: 'walk-media', max: 600, windowSeconds: 600 })
  if (limited) return limited

  const { token } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!PATH_RE.test(path)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  // Does a finding on one of THIS tag's walkarounds actually carry this object?
  const { data: owned } = await supabaseAdmin
    .from('pp_findings')
    .select('id, walk:pp_walkarounds!inner(tag_id)')
    .contains('media', [{ path }])
    .limit(20)

  const mine = (owned ?? []).some(r => {
    const w = (Array.isArray(r.walk) ? r.walk[0] : r.walk) as { tag_id: string | null } | null
    return w?.tag_id === tag.id
  })
  // Same 404 as a missing object — never confirm that a path exists but belongs
  // to somebody else.
  if (!mine) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage
    .from('post-production').createSignedUrl(path, 60 * 5)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.redirect(data.signedUrl, 307)
}
