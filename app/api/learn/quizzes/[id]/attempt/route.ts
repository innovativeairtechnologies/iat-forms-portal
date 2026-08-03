import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { gradeAttempt } from '@/lib/learn-quiz'

/* POST /api/learn/quizzes/[id]/attempt  { answers: { [questionId]: optionId } }

   Session-scoped like /api/learn/progress: the user comes from the session,
   never the body, so nobody can record an attempt for someone else.

   The client posts CHOSEN OPTION IDS ONLY — never a score. Grading reads the
   answer key server-side in gradeAttempt (learn_quiz_options has no
   learner-facing RLS read policy at all), so a tampered payload can change
   which options were picked and nothing else. */

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { answers?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const raw = body.answers
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'answers must be an object of questionId → optionId' }, { status: 400 })
  }
  // Coerce to a clean string map; gradeAttempt independently rejects any option
  // id that doesn't belong to its question.
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && typeof v === 'string') answers[k] = v
  }

  const result = await gradeAttempt(user.id, id, answers)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, ...result })
}
