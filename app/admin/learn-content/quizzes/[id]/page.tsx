import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getQuizForAdmin } from '@/lib/learn-quiz'
import QuizEditor from '@/components/learn/admin/QuizEditor'

export const dynamic = 'force-dynamic'

/* Review an AI-drafted quiz before it goes live. Admin-only: this page carries
   the ANSWER KEY, and it sits under /admin/learn-content, whose layout gates on
   the strict getAdminUser() and whose prefix is mapped to `learn_admin` in
   ADMIN_PATH_PERMS. */

export default async function QuizReviewPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const data = await getQuizForAdmin(id)
  if (!data) notFound()
  const { quiz, questions } = data

  // Scope label + the lesson titles each question cites, so a reviewer can check
  // the key against the source without leaving the page.
  const [scopeLabel, lessonTitles, attemptCount] = await Promise.all([
    (async () => {
      if (quiz.scopeType === 'module') {
        const { data: m } = await supabaseAdmin.from('learn_modules').select('title').eq('id', quiz.scopeId).maybeSingle()
        return m ? `Subject · ${m.title}` : 'Subject'
      }
      const { data: c } = await supabaseAdmin.from('learn_categories').select('name').eq('id', quiz.scopeId).maybeSingle()
      return c ? `Category · ${c.name}` : 'Category'
    })(),
    (async () => {
      const ids = questions.map(q => q.sourceLessonId).filter((x): x is string => !!x)
      if (!ids.length) return {} as Record<string, string>
      const { data: rows } = await supabaseAdmin.from('learn_lessons').select('id, title').in('id', ids)
      return Object.fromEntries((rows ?? []).map(r => [r.id, r.title])) as Record<string, string>
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from('learn_quiz_attempts').select('*', { count: 'exact', head: true }).eq('quiz_id', id)
      return count ?? 0
    })(),
  ])

  return (
    <QuizEditor
      quiz={quiz}
      questions={questions}
      scopeLabel={scopeLabel}
      lessonTitles={lessonTitles}
      attemptCount={attemptCount}
    />
  )
}
