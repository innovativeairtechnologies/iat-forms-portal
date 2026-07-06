import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerUser } from '@/lib/customer-auth'
import { rateLimit } from '@/lib/rate-limit'
import { ensureSrvForm, getSrvForm } from '@/lib/srv-form'

export const dynamic = 'force-dynamic'

// Server-side save & resume for the interactive SRV (reuses form_drafts,
// migration 033) so a draft started on a phone at the unit can be finished at
// a desk. One draft per customer login: PUT upserts, submit deletes. The
// draft body is the structured client state (NOT flattened label data) —
// form_drafts.data is just a jsonb bag and this draft never renders through
// the form-builder pipeline.

/** GET /api/customer/srv/draft — the caller's SRV draft, or null. */
export async function GET() {
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const form = await getSrvForm()
  if (!form) return NextResponse.json({ draft: null })

  const { data } = await supabaseAdmin
    .from('form_drafts')
    .select('data, updated_at')
    .eq('user_id', session.user.id)
    .eq('form_id', form.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ draft: data?.data ?? null, updated_at: data?.updated_at ?? null })
}

/** PUT /api/customer/srv/draft — upsert the caller's single SRV draft. */
export async function PUT(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'srv-draft', max: 120, windowSeconds: 600 })
  if (limited) return limited

  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { draft?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const draft = body?.draft
  if (!draft || typeof draft !== 'object') {
    return NextResponse.json({ error: 'draft required' }, { status: 400 })
  }
  if (JSON.stringify(draft).length > 400_000) {
    return NextResponse.json({ error: 'Draft too large' }, { status: 400 })
  }

  // First draft can precede first submit — make sure the form row exists.
  const ensured = await ensureSrvForm()
  if (!ensured) return NextResponse.json({ error: 'SRV unavailable' }, { status: 500 })

  const label =
    typeof (draft as { project?: { project_name?: unknown } }).project?.project_name === 'string'
      ? ((draft as { project: { project_name: string } }).project.project_name || 'SRV draft').slice(0, 200)
      : 'SRV draft'

  const { data: existing } = await supabaseAdmin
    .from('form_drafts')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('form_id', ensured.form.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = {
    user_id: session.user.id,
    form_id: ensured.form.id,
    label,
    data: draft,
    updated_at: new Date().toISOString(),
  }
  const { error } = existing
    ? await supabaseAdmin.from('form_drafts').update(row).eq('id', existing.id)
    : await supabaseAdmin.from('form_drafts').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/** DELETE /api/customer/srv/draft — discard the caller's SRV draft ("Start over"). */
export async function DELETE() {
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const form = await getSrvForm()
  if (form) {
    await supabaseAdmin
      .from('form_drafts')
      .delete()
      .eq('user_id', session.user.id)
      .eq('form_id', form.id)
  }
  return NextResponse.json({ ok: true })
}
