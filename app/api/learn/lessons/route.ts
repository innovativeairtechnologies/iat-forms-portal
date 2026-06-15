import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { uniqueSlug } from '@/lib/learn-slug'

// POST /api/learn/lessons  { module_id, title }
// Creates a new (unpublished) lesson at the end of a module and returns its id.
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { module_id?: string; title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { module_id, title } = body
  if (!module_id || !title?.trim()) {
    return NextResponse.json({ error: 'module_id and title required' }, { status: 400 })
  }

  const { data: siblings } = await supabaseAdmin
    .from('learn_lessons')
    .select('slug, display_order')
    .eq('module_id', module_id)

  const slug = uniqueSlug(title, (siblings ?? []).map(s => s.slug))
  const nextOrder = (siblings ?? []).reduce((m, s) => Math.max(m, s.display_order), -1) + 1

  const { data, error } = await supabaseAdmin
    .from('learn_lessons')
    .insert({
      module_id,
      title: title.trim(),
      slug,
      content: '',
      display_order: nextOrder,
      is_published: false,
      estimated_minutes: 3,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
