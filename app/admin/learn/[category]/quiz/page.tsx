import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getCategoryWithModules } from '@/lib/learn'
import { getQuizForLearner, getAttemptSummaries } from '@/lib/learn-quiz'
import QuizRunner from '@/components/learn/QuizRunner'
import LearnPageShell from '../../LearnPageShell'
import PageChrome from '@/app/admin/PageChrome'

export const dynamic = 'force-dynamic'

/* The capstone quiz for a whole category.

   Unlike a subject quiz this gates nothing — it is a bigger, optional check
   across everything in the category, worth XP and a place on the leaderboard.
   Same static-beside-dynamic note as the module quiz: `quiz` wins over
   `[module]`, and no module uses that slug (verified against production). */

export default async function CategoryQuizPage(props: { params: Promise<{ category: string }> }) {
  const params = await props.params
  const data = await getCategoryWithModules(params.category)
  if (!data) notFound()
  const { category } = data

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/admin/learn/${params.category}/quiz`)

  const [quizData, attempts] = await Promise.all([
    getQuizForLearner('category', category.id),
    getAttemptSummaries(user.id),
  ])
  if (!quizData) notFound()

  const summary = attempts.get(quizData.quiz.id)
  const base = `/admin/learn/${category.slug}`

  return (
    <LearnPageShell
      chrome={<PageChrome record={[{ label: category.name, href: base }, { label: 'Quiz' }]} />}
    >
      <QuizRunner
        quiz={quizData.quiz}
        questions={quizData.questions}
        backHref={base}
        backLabel={`Back to ${category.name}`}
        previousBestPct={summary?.bestPct ?? null}
        alreadyPassed={summary?.passed === true}
      />
    </LearnPageShell>
  )
}
