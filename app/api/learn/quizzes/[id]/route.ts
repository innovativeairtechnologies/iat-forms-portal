import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

/* PATCH  /api/learn/quizzes/[id]  { title?, description?, pass_pct?, is_published? }
   DELETE /api/learn/quizzes/[id]

   Publishing is the moment an AI draft becomes something people are graded on,
   so it is guarded: a quiz cannot go live without questions, and every question
   must have exactly one correct option. A draft where a reviewer deleted the
   right answer would otherwise publish an unpassable quiz. */

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: quiz } = await supabaseAdmin
    .from('learn_quizzes').select('id, title, is_published, scope_type').eq('id', id).single()
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim().slice(0, 200)
  if (typeof body.description === 'string') update.description = body.description
  if (typeof body.pass_pct === 'number' && body.pass_pct >= 1 && body.pass_pct <= 100) {
    update.pass_pct = Math.round(body.pass_pct)
  }

  if (typeof body.is_published === 'boolean') {
    if (body.is_published) {
      // Integrity gate — only on the way UP. Unpublishing is always allowed.
      const { data: questions } = await supabaseAdmin
        .from('learn_quiz_questions').select('id, prompt').eq('quiz_id', id)
      if (!questions?.length) {
        return NextResponse.json({ error: 'Add at least one question before publishing.' }, { status: 400 })
      }
      const { data: options } = await supabaseAdmin
        .from('learn_quiz_options').select('question_id, is_correct').in('question_id', questions.map(q => q.id))
      const correctPerQuestion = new Map<string, number>()
      for (const o of options ?? []) {
        if (o.is_correct) correctPerQuestion.set(o.question_id, (correctPerQuestion.get(o.question_id) ?? 0) + 1)
      }
      const broken = questions.filter(q => (correctPerQuestion.get(q.id) ?? 0) !== 1)
      if (broken.length) {
        return NextResponse.json({
          error: `${broken.length} question${broken.length === 1 ? ' has' : 's have'} no single correct answer. Fix ${broken.length === 1 ? 'it' : 'them'} before publishing.`,
          questionIds: broken.map(q => q.id),
        }, { status: 400 })
      }
    }
    update.is_published = body.is_published
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('learn_quizzes').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (typeof update.is_published === 'boolean' && update.is_published !== quiz.is_published) {
    await logAudit({
      actor: { id: admin.user.id, name: admin.displayName },
      action: update.is_published ? 'learn.quiz.publish' : 'learn.quiz.unpublish',
      entityType: 'learn_quiz',
      entityId: id,
      summary: `${update.is_published ? 'Published' : 'Unpublished'} Learn quiz “${quiz.title}”`,
      metadata: { scopeType: quiz.scope_type },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: quiz } = await supabaseAdmin
    .from('learn_quizzes').select('id, title').eq('id', id).single()
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  // Questions, options, attempts and answers all cascade from the quiz row.
  const { count: attempts } = await supabaseAdmin
    .from('learn_quiz_attempts').select('*', { count: 'exact', head: true }).eq('quiz_id', id)

  const { error } = await supabaseAdmin.from('learn_quizzes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.quiz.delete',
    entityType: 'learn_quiz',
    entityId: id,
    summary: `Deleted Learn quiz “${quiz.title}”`
      + (attempts ? ` (erased ${attempts} attempt${attempts === 1 ? '' : 's'})` : ''),
    metadata: { attempts: attempts ?? 0 },
  })

  return NextResponse.json({ ok: true, deletedAttempts: attempts ?? 0 })
}
