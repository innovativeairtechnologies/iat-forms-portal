import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getModuleWithLessons } from '@/lib/learn'
import { getQuizForLearner, getAttemptSummaries } from '@/lib/learn-quiz'
import QuizRunner from '@/components/learn/QuizRunner'
import LearnPageShell from '../../../LearnPageShell'
import PageChrome from '@/app/admin/PageChrome'

export const dynamic = 'force-dynamic'

/* The knowledge check at the end of a subject.

   404s when no PUBLISHED quiz exists for the subject — a draft is invisible to
   learners, so there is no way to sit an unreviewed quiz.

   NOTE: this static `quiz` segment sits beside the dynamic `[lesson]` one. Next
   gives static precedence, so a lesson slugged "quiz" would become unreachable.
   Verified against production: no lesson or module uses that slug. `uniqueSlug`
   in lib/learn-slug.ts would happily mint one, so if lesson creation ever grows
   a slug field, exclude it there. */

export default async function ModuleQuizPage(
  props: { params: Promise<{ category: string; module: string }> },
) {
  const params = await props.params
  const ctx = await getModuleWithLessons(params.category, params.module)
  if (!ctx) notFound()
  const { category, module } = ctx

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/admin/learn/${params.category}/${params.module}/quiz`)

  const [quizData, attempts] = await Promise.all([
    getQuizForLearner('module', module.id),
    getAttemptSummaries(user.id),
  ])
  if (!quizData) notFound()

  const summary = attempts.get(quizData.quiz.id)
  const base = `/admin/learn/${category.slug}/${module.slug}`

  return (
    <LearnPageShell
      chrome={
        <PageChrome record={[
          { label: category.name, href: `/admin/learn/${category.slug}` },
          { label: module.title, href: base },
          { label: 'Quiz' },
        ]} />
      }
    >
      <QuizRunner
        quiz={quizData.quiz}
        questions={quizData.questions}
        backHref={base}
        backLabel={`Back to ${module.title}`}
        previousBestPct={summary?.bestPct ?? null}
        alreadyPassed={summary?.passed === true}
      />
    </LearnPageShell>
  )
}
