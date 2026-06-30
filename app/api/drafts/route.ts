import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Save & resume for in-progress form fills (migration 033). The draft id is
// client-generated (a uuid) so autosave is an idempotent upsert. The user always
// comes from the session — never the request body — so a user can only touch
// their own drafts.

// GET /api/drafts — the current user's in-progress drafts (newest first), joined
// with the form's title/slug for the "Resume" list. Drafts for deleted/inactive
// forms are dropped.
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('form_drafts')
    .select('id, form_id, label, data, current_step, updated_at, forms(title, slug, is_active)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Supabase types the to-one `forms` embed as an array; at runtime it's a single
  // object (or null). Cast to the real shape.
  const rows = (data || []) as unknown as Array<{
    id: string; form_id: string; label: string | null; data: unknown
    current_step: number; updated_at: string
    forms: { title: string; slug: string; is_active: boolean } | null
  }>
  const drafts = rows
    .filter((d) => d.forms?.is_active)
    .map((d) => ({
      id: d.id,
      form_id: d.form_id,
      title: d.forms!.title,
      slug: d.forms!.slug,
      label: d.label,
      data: d.data,
      current_step: d.current_step,
      updated_at: d.updated_at,
    }))
  return NextResponse.json({ drafts })
}

// PUT /api/drafts — upsert one of the current user's drafts (autosave).
export async function PUT(request: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; form_id?: string; data?: Record<string, unknown>; current_step?: number; label?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { id, form_id, data, current_step, label } = body
  if (!id || !form_id || typeof data !== 'object' || data === null) {
    return NextResponse.json({ error: 'id, form_id and data are required' }, { status: 400 })
  }

  // Never let a PUT clobber a row owned by someone else (the id is client-supplied).
  const { data: existing } = await supabaseAdmin.from('form_drafts').select('user_id').eq('id', id).maybeSingle()
  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('form_drafts').upsert({
    id,
    user_id: user.id,
    form_id,
    label: typeof label === 'string' ? label.slice(0, 200) : null,
    data,
    current_step: typeof current_step === 'number' ? current_step : 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id })
}

// DELETE /api/drafts?id=... — discard one of the current user's drafts (on submit
// or "Start over"). Scoped to user_id, so it can only delete their own.
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('form_drafts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
