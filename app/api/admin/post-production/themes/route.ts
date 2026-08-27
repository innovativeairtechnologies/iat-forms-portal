import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { isCategory } from '@/lib/post-production'

/* POST /api/admin/post-production/themes — group findings by hand.
 *
 * The model's shortlist is a shortcut, not the only way in. Somebody who already
 * knows two findings are the same issue should not have to talk a language model
 * into agreeing, so a theme can be created outright and findings attached to it
 * from the detail page. Human links are the ones that count on the board. */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const title = String(body?.title ?? '').trim().slice(0, 120)
  if (!title) return NextResponse.json({ error: 'The recurring issue needs a name.' }, { status: 400 })

  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  const { data, error } = await supabaseAdmin
    .from('pp_themes')
    .insert({
      title,
      summary: body?.summary ? String(body.summary).trim().slice(0, 800) : null,
      category: isCategory(body?.category) ? body.category : 'other',
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[post-production/themes] create failed:', error.message)
    return NextResponse.json({ error: 'Could not create that group.' }, { status: 500 })
  }

  // Attaching in the same request is the common case — a theme with no findings
  // in it is a label nobody asked for. Stamped 'human' because a person just
  // said these belong together.
  const findingIds: string[] = Array.isArray(body?.finding_ids)
    ? body.finding_ids.filter((v: unknown) => typeof v === 'string').slice(0, 50)
    : []
  if (findingIds.length) {
    await supabaseAdmin
      .from('pp_findings')
      .update({ theme_id: data.id, theme_source: 'human', updated_at: new Date().toISOString() })
      .in('id', findingIds)
  }

  return NextResponse.json({ theme: data, attached: findingIds.length })
}
