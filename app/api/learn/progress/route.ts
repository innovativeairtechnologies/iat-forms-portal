import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeAwardForCompletion } from '@/lib/learn'

// POST /api/learn/progress  { lessonId: string, completed: boolean }
// Upserts the current user's progress for a lesson. user_id is taken from the
// session — never from the request body — so a user can only write their own row.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { lessonId?: string; completed?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lessonId, completed } = body
  if (!lessonId || typeof lessonId !== 'string') {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('learn_progress')
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,lesson_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On completion, compute the XP gained + any newly-unlocked badges for the toast.
  // Best-effort: a failure here must never fail the progress write itself.
  if (completed) {
    try {
      const award = await computeAwardForCompletion(user.id, lessonId)
      return NextResponse.json({ ok: true, completed: true, award })
    } catch (e) {
      console.error('[learn] award computation failed:', e)
    }
  }
  return NextResponse.json({ ok: true, completed: !!completed })
}
