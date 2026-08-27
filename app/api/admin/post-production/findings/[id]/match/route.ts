import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { suggestTheme, findCandidates, applySuggestion } from '@/lib/pp-match'
import type { Category } from '@/lib/post-production'

/* POST /api/admin/post-production/findings/[id]/match
 *
 * "Has this been raised before?" on demand, from the finding detail page. Runs
 * automatically on hand-over too (see the walkaround submit route); this is the
 * button for re-running it after somebody has edited the wording, or for a
 * finding that was submitted before anything similar existed.
 *
 * `{ apply: true }` writes the suggestion as an 'ai' link. Without it the route
 * only reports what it found, which is what the "show me why" panel uses.
 *
 * GET returns the keyword shortlist alone — no model call, no cost, no wait.
 * That is what the detail page's "similar findings" list renders, and it is
 * genuinely useful on its own: a human scanning five nearby findings is often
 * faster than any amount of automation.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { data: f } = await supabaseAdmin
    .from('pp_findings').select('note').eq('id', id).maybeSingle()
  if (!f) return NextResponse.json({ error: 'That finding no longer exists.' }, { status: 404 })

  return NextResponse.json({ candidates: await findCandidates(String(f.note ?? ''), id) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json().catch(() => ({}))

  const { data: f } = await supabaseAdmin
    .from('pp_findings').select('note, category').eq('id', id).maybeSingle()
  if (!f) return NextResponse.json({ error: 'That finding no longer exists.' }, { status: 404 })

  const suggestion = await suggestTheme(String(f.note ?? ''), (f.category as Category) ?? 'other', id)

  if (body?.apply === true && suggestion.kind !== 'none') {
    const actor = await getAdminSurfaceUser()
    const createdBy = await employeeIdForEmail(actor?.user.email)
    const { themeId, created } = await applySuggestion(id, suggestion, createdBy)
    return NextResponse.json({ suggestion, applied: true, themeId, created })
  }

  return NextResponse.json({ suggestion, applied: false })
}
