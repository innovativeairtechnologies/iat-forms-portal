import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { cleanActorName } from '@/lib/production'
import { resolveTag } from '@/lib/pp-tag'
import { isWalkRole, normalizeJobNumber } from '@/lib/post-production'

/* POST /api/walk/<token> — start a walkaround from a scanned sticker.
 *
 * PUBLIC AND UNAUTHENTICATED. The URL token is the entire capability, so:
 *
 *   • The tag resolves SERVER-side and is never taken from the body.
 *   • A unit tag's job number WINS over anything posted. The sticker on the
 *     machine is the more trustworthy of the two, and letting the body override
 *     it would mean a scanner could file findings against a unit they are not
 *     standing next to.
 *   • The name is cleaned, capped and understood to be UNVERIFIED — the row is
 *     stamped source='tag' and walked_by stays NULL so every screen downstream
 *     can say where it came from.
 *
 * Same discipline as app/api/board/[token]/check/route.ts, which is the page
 * this one is modelled on.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Before parsing the body, so malformed floods are limited too. Generous
  // because the whole shop shares one NAT IP — this is per-building, not
  // per-person — and because rateLimit fails OPEN by design. The token is the
  // security control; this is a backstop.
  const limited = await rateLimit(req, { name: 'walk-start', max: 60, windowSeconds: 600 })
  if (limited) return limited

  const { token } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const body = await req.json().catch(() => ({}))

  const name = cleanActorName(body?.name)
  if (!name) {
    return NextResponse.json({ error: 'Put your name on it so engineering knows who to ask.' }, { status: 400 })
  }

  const role = isWalkRole(body?.role) ? body.role : null
  if (!role) {
    return NextResponse.json({ error: 'Say how you worked on this unit.' }, { status: 400 })
  }

  // A unit tag carries its own number; a standing tag makes the scanner type it.
  const jobNumber = tag.job_number ?? normalizeJobNumber(String(body?.job_number ?? ''))
  if (!jobNumber) {
    return NextResponse.json({ error: 'Which unit? The serial is on the nameplate.' }, { status: 400 })
  }

  // Link to the engineering job when one exists, and inherit its customer and
  // model. Snapshots, not a join — and note this is the ONLY place a customer
  // name enters a page with no login. It is shown back to somebody standing in
  // our own shop holding our own sticker, which is the same trust boundary the
  // production board already accepts.
  const { data: job } = await supabaseAdmin
    .from('eng_jobs')
    .select('id, customer_name, model_number')
    .eq('job_number', jobNumber)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('pp_walkarounds')
    .insert({
      job_number: jobNumber,
      job_id: job?.id ?? null,
      customer_name: job?.customer_name ?? '',
      model_number: job?.model_number ?? null,
      // NULL: nobody was signed in. The name beside it is an honor-system
      // signature, not an identity, and `source` is what makes that legible.
      walked_by: null,
      walked_by_name: name,
      walked_by_role: role,
      source: 'tag',
      tag_id: tag.id,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[walk/start] create failed:', error.message)
    return NextResponse.json({ error: 'Could not start the walkaround.' }, { status: 500 })
  }

  return NextResponse.json({ walkaround: data })
}
