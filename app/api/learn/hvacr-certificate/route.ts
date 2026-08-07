import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getAttemptSummaries,
  getPublishedModuleQuizzes,
  subjectIsComplete,
} from '@/lib/learn-quiz'

/* GET /api/learn/hvacr-certificate
 *
 * Is the signed-in learner finished with the Refrigeration & HVAC/R course, and
 * if so, when?
 *
 * Session-scoped like /api/learn/progress: the user id comes from the session
 * and never from the request, so this can only ever report on yourself.
 *
 * Completion is derived with the SAME `subjectIsComplete()` the library pages
 * and the assignments report use — including the quiz gate. That agreement is
 * the point: a certificate that used its own rule could congratulate someone the
 * compliance report still lists as overdue. (docs/learn.md records the earlier
 * incident where Company Home skipped the quiz check to save a query.)
 */

const CATEGORY_SLUG = 'refrigeration-hvacr'

/** The closing subject holds the exam explainer and this certificate, not
 *  teaching content — it must not count toward the subjects you have to pass. */
const EXCLUDED_MODULE_SLUG = 'course-completion'

export async function GET() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: category, error: catErr } = await supabaseAdmin
    .from('learn_categories')
    .select('id, name')
    .eq('slug', CATEGORY_SLUG)
    .maybeSingle()
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 })
  if (!category) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const { data: modules, error: modErr } = await supabaseAdmin
    .from('learn_modules')
    .select('id, slug, title, learn_lessons(id, is_published)')
    .eq('category_id', category.id)
    .eq('is_published', true)
  if (modErr) return NextResponse.json({ error: modErr.message }, { status: 500 })

  const subjects = (modules ?? []).filter((m) => m.slug !== EXCLUDED_MODULE_SLUG)
  const lessonIds = subjects.flatMap((m) =>
    (m.learn_lessons ?? []).filter((l) => l.is_published).map((l) => l.id as string),
  )

  const { data: progress, error: progErr } = await supabaseAdmin
    .from('learn_progress')
    .select('lesson_id, completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .in('lesson_id', lessonIds.length ? lessonIds : ['00000000-0000-0000-0000-000000000000'])
  if (progErr) return NextResponse.json({ error: progErr.message }, { status: 500 })

  // Both of these THROW rather than returning empty on a read error — an empty
  // map would silently un-gate every subject and hand out a certificate nobody
  // earned. A 500 is the correct outcome.
  let quizzes: Awaited<ReturnType<typeof getPublishedModuleQuizzes>>
  let attempts: Awaited<ReturnType<typeof getAttemptSummaries>>
  try {
    ;[quizzes, attempts] = await Promise.all([
      getPublishedModuleQuizzes(),
      getAttemptSummaries(user.id),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not load quiz gating' },
      { status: 500 },
    )
  }

  const doneLessons = new Set((progress ?? []).map((p) => p.lesson_id as string))

  const outstanding: string[] = []
  for (const m of subjects) {
    const published = (m.learn_lessons ?? []).filter((l) => l.is_published)
    const done = published.filter((l) => doneLessons.has(l.id as string)).length
    if (!subjectIsComplete(done, published.length, quizzes.get(m.id as string), attempts)) {
      outstanding.push(m.title as string)
    }
  }

  // The capstone is category-scoped, so it gates nothing on its own — but it is
  // exactly what the certificate waits for.
  const { data: capstone, error: capErr } = await supabaseAdmin
    .from('learn_quizzes')
    .select('id')
    .eq('scope_type', 'category')
    .eq('scope_id', category.id)
    .eq('is_published', true)
    .maybeSingle()
  if (capErr) return NextResponse.json({ error: capErr.message }, { status: 500 })

  const capstoneAttempt = capstone ? attempts.get(capstone.id as string) : undefined
  const capstonePassed = !capstone || !!capstoneAttempt?.passed

  // `employees.id` IS the auth user id (see getLeaderboard in lib/learn.ts).
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const eligible = outstanding.length === 0 && capstonePassed

  /* The award date is the last thing that had to happen, not "now" — otherwise
     the certificate would re-date itself on every page load. */
  const lastLesson = (progress ?? [])
    .map((p) => p.completed_at as string)
    .sort()
    .at(-1)
  const awardedAt = eligible
    ? ([lastLesson, capstoneAttempt?.lastSubmittedAt].filter(Boolean) as string[]).sort().at(-1) ?? null
    : null

  return NextResponse.json({
    eligible,
    name: employee?.name?.trim() || user.email?.split('@')[0] || 'Technician',
    courseName: category.name,
    awardedAt,
    subjectsTotal: subjects.length,
    subjectsComplete: subjects.length - outstanding.length,
    outstanding,
    capstone: capstone
      ? { passed: !!capstoneAttempt?.passed, bestPct: capstoneAttempt?.bestPct ?? null }
      : null,
  })
}
