import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* PATCH  /api/learn/quizzes/questions/[id]
     { prompt?, explanation?, correctOptionId?, options?: [{id, label}] }
   DELETE /api/learn/quizzes/questions/[id]

   The reviewer's editing surface for an AI draft. `correctOptionId` moves the
   answer key: exactly one option per question is correct, so setting one clears
   the rest in the same pass rather than leaving two marked. */

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    prompt?: unknown; explanation?: unknown; correctOptionId?: unknown
    options?: { id?: unknown; label?: unknown }[]
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: question } = await supabaseAdmin
    .from('learn_quiz_questions').select('id, quiz_id').eq('id', id).single()
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (typeof body.prompt === 'string' && body.prompt.trim()) update.prompt = body.prompt.trim()
  if (typeof body.explanation === 'string') update.explanation = body.explanation.trim() || null
  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin.from('learn_quiz_questions').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Option labels
  if (Array.isArray(body.options)) {
    const { data: owned } = await supabaseAdmin
      .from('learn_quiz_options').select('id').eq('question_id', id)
    const ownedIds = new Set((owned ?? []).map(o => o.id))
    for (const o of body.options) {
      // Only touch options that belong to THIS question — an id from elsewhere
      // must not be editable through this route.
      if (typeof o.id !== 'string' || !ownedIds.has(o.id)) continue
      if (typeof o.label !== 'string' || !o.label.trim()) continue
      await supabaseAdmin.from('learn_quiz_options').update({ label: o.label.trim() }).eq('id', o.id)
    }
  }

  // Answer key — set exactly one.
  if (typeof body.correctOptionId === 'string') {
    const { data: owned } = await supabaseAdmin
      .from('learn_quiz_options').select('id').eq('question_id', id)
    const ownedIds = new Set((owned ?? []).map(o => o.id))
    if (!ownedIds.has(body.correctOptionId)) {
      return NextResponse.json({ error: 'That option does not belong to this question' }, { status: 400 })
    }
    await supabaseAdmin.from('learn_quiz_options').update({ is_correct: false }).eq('question_id', id)
    const { error } = await supabaseAdmin
      .from('learn_quiz_options').update({ is_correct: true }).eq('id', body.correctOptionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('learn_quiz_questions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
