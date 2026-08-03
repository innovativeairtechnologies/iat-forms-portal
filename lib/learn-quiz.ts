import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUIZ_PASS_XP } from '@/lib/learn-gamification'

/* IAT Learn quizzes — data layer (migration 074).

   Two hard rules the rest of the feature depends on:

   1. THE ANSWER KEY NEVER LEAVES THE SERVER. `learn_quiz_options.is_correct`
      has no learner-facing read policy, and `getQuizForLearner` strips it.
      Grading happens in `gradeAttempt` against a fresh server read — the client
      posts option ids only, never a claimed score.

   2. A QUIZ ONLY GATES ONCE PUBLISHED. `subjectIsComplete` treats a subject
      with no published quiz exactly as before (all lessons = done), so adding a
      quiz later can never retroactively un-complete someone who has already
      finished the reading. */

export type QuizScope = 'module' | 'category'

export type QuizOption = { id: string; label: string; displayOrder: number }

export type QuizQuestion = {
  id: string
  prompt: string
  explanation: string | null
  sourceLessonId: string | null
  displayOrder: number
  options: QuizOption[]
}

/** Admin shape — carries the answer key. Never send this to a learner. */
export type QuizOptionWithKey = QuizOption & { isCorrect: boolean }
export type QuizQuestionWithKey = Omit<QuizQuestion, 'options'> & { options: QuizOptionWithKey[] }

export type Quiz = {
  id: string
  scopeType: QuizScope
  scopeId: string
  title: string
  description: string | null
  passPct: number
  isPublished: boolean
  generatedMeta: Record<string, unknown>
  questionCount: number
}

export type QuizAttemptSummary = {
  quizId: string
  bestScore: number
  total: number
  bestPct: number
  passed: boolean
  attempts: number
  lastSubmittedAt: string
}

// ── Reads ────────────────────────────────────────────────────────────────────

function rowToQuiz(q: Record<string, unknown>, questionCount: number): Quiz {
  return {
    id: q.id as string,
    scopeType: q.scope_type as QuizScope,
    scopeId: q.scope_id as string,
    title: q.title as string,
    description: (q.description as string) ?? null,
    passPct: q.pass_pct as number,
    isPublished: q.is_published as boolean,
    generatedMeta: (q.generated_meta as Record<string, unknown>) ?? {},
    questionCount,
  }
}

/** Every quiz, for the admin content tree. */
export async function listQuizzes(): Promise<Quiz[]> {
  const { data: quizzes } = await supabaseAdmin.from('learn_quizzes').select('*')
  if (!quizzes?.length) return []
  const { data: qs } = await supabaseAdmin
    .from('learn_quiz_questions').select('quiz_id').in('quiz_id', quizzes.map(q => q.id))
  const counts = new Map<string, number>()
  for (const q of qs ?? []) counts.set(q.quiz_id, (counts.get(q.quiz_id) ?? 0) + 1)
  return quizzes.map(q => rowToQuiz(q, counts.get(q.id) ?? 0))
}

/** Full quiz WITH the answer key — admin review/edit only. */
export async function getQuizForAdmin(quizId: string): Promise<{ quiz: Quiz; questions: QuizQuestionWithKey[] } | null> {
  const { data: q } = await supabaseAdmin.from('learn_quizzes').select('*').eq('id', quizId).single()
  if (!q) return null

  const { data: questions } = await supabaseAdmin
    .from('learn_quiz_questions').select('*').eq('quiz_id', quizId).order('display_order')
  const ids = (questions ?? []).map(x => x.id)
  const { data: options } = ids.length
    ? await supabaseAdmin.from('learn_quiz_options').select('*').in('question_id', ids).order('display_order')
    : { data: [] as Record<string, unknown>[] }

  const byQuestion = new Map<string, QuizOptionWithKey[]>()
  for (const o of options ?? []) {
    const arr = byQuestion.get(o.question_id as string) ?? []
    arr.push({
      id: o.id as string,
      label: o.label as string,
      isCorrect: o.is_correct as boolean,
      displayOrder: o.display_order as number,
    })
    byQuestion.set(o.question_id as string, arr)
  }

  return {
    quiz: rowToQuiz(q, (questions ?? []).length),
    questions: (questions ?? []).map(x => ({
      id: x.id,
      prompt: x.prompt,
      explanation: x.explanation,
      sourceLessonId: x.source_lesson_id,
      displayOrder: x.display_order,
      options: byQuestion.get(x.id) ?? [],
    })),
  }
}

/** Published quiz for a scope, WITHOUT the answer key. Safe to send to a browser. */
export async function getQuizForLearner(
  scopeType: QuizScope,
  scopeId: string,
): Promise<{ quiz: Quiz; questions: QuizQuestion[] } | null> {
  const { data: q } = await supabaseAdmin
    .from('learn_quizzes').select('*')
    .eq('scope_type', scopeType).eq('scope_id', scopeId).eq('is_published', true)
    .maybeSingle()
  if (!q) return null

  const { data: questions } = await supabaseAdmin
    .from('learn_quiz_questions').select('*').eq('quiz_id', q.id).order('display_order')
  const ids = (questions ?? []).map(x => x.id)
  const { data: options } = ids.length
    // NB: `is_correct` is deliberately NOT selected. Even though this runs with
    // the service role, not fetching it means it cannot leak through a later
    // refactor that spreads the row.
    ? await supabaseAdmin.from('learn_quiz_options').select('id, question_id, label, display_order')
        .in('question_id', ids).order('display_order')
    : { data: [] as Record<string, unknown>[] }

  const byQuestion = new Map<string, QuizOption[]>()
  for (const o of options ?? []) {
    const arr = byQuestion.get(o.question_id as string) ?? []
    arr.push({ id: o.id as string, label: o.label as string, displayOrder: o.display_order as number })
    byQuestion.set(o.question_id as string, arr)
  }

  return {
    quiz: rowToQuiz(q, (questions ?? []).length),
    questions: (questions ?? []).map(x => ({
      id: x.id,
      prompt: x.prompt,
      explanation: x.explanation,
      sourceLessonId: x.source_lesson_id,
      displayOrder: x.display_order,
      options: byQuestion.get(x.id) ?? [],
    })),
  }
}

/** Best attempt per quiz for one user. Best score wins (Jacob's call). */
export async function getAttemptSummaries(userId: string): Promise<Map<string, QuizAttemptSummary>> {
  const { data } = await supabaseAdmin
    .from('learn_quiz_attempts')
    .select('quiz_id, score, total, passed, submitted_at')
    .eq('user_id', userId)

  const out = new Map<string, QuizAttemptSummary>()
  for (const a of data ?? []) {
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
    const cur = out.get(a.quiz_id)
    if (!cur) {
      out.set(a.quiz_id, {
        quizId: a.quiz_id, bestScore: a.score, total: a.total, bestPct: pct,
        passed: a.passed, attempts: 1, lastSubmittedAt: a.submitted_at,
      })
      continue
    }
    cur.attempts += 1
    if (a.submitted_at > cur.lastSubmittedAt) cur.lastSubmittedAt = a.submitted_at
    if (pct > cur.bestPct) {
      cur.bestScore = a.score; cur.total = a.total; cur.bestPct = pct
    }
    // `passed` is sticky: once passed, always passed, even if a later attempt
    // scored worse. Best-score-kept would be a lie otherwise.
    cur.passed = cur.passed || a.passed
  }
  return out
}

/** Published module-scoped quizzes, keyed by module id. Drives subject gating. */
export async function getPublishedModuleQuizzes(): Promise<Map<string, { id: string; passPct: number }>> {
  const { data } = await supabaseAdmin
    .from('learn_quizzes').select('id, scope_id, pass_pct')
    .eq('scope_type', 'module').eq('is_published', true)
  return new Map((data ?? []).map(q => [q.scope_id as string, { id: q.id as string, passPct: q.pass_pct as number }]))
}

/**
 * Is a subject finished?
 *
 * Lessons alone when the subject has no PUBLISHED quiz — so publishing a quiz
 * later never retroactively un-completes someone. With one, the quiz must also
 * be passed.
 */
export function subjectIsComplete(
  lessonsDone: number,
  lessonsTotal: number,
  quiz: { id: string } | undefined,
  attempts: Map<string, QuizAttemptSummary>,
): boolean {
  const read = lessonsTotal > 0 && lessonsDone >= lessonsTotal
  if (!read) return false
  if (!quiz) return true
  return attempts.get(quiz.id)?.passed === true
}

/** XP from passed quizzes — awarded once per quiz, on the best attempt. */
export function quizXpFrom(attempts: Map<string, QuizAttemptSummary>): number {
  let xp = 0
  for (const a of attempts.values()) if (a.passed) xp += QUIZ_PASS_XP
  return xp
}

/** Headline quiz numbers for the dashboard tiles. */
export function quizStatsFrom(attempts: Map<string, QuizAttemptSummary>) {
  const all = [...attempts.values()]
  const passed = all.filter(a => a.passed)
  const avg = all.length ? Math.round(all.reduce((n, a) => n + a.bestPct, 0) / all.length) : 0
  return { taken: all.length, passed: passed.length, avgPct: avg }
}

// ── Grading ──────────────────────────────────────────────────────────────────

export type GradedQuestion = {
  questionId: string
  chosenOptionId: string | null
  correctOptionId: string | null
  isCorrect: boolean
  explanation: string | null
}

export type GradeResult = {
  attemptId: string
  score: number
  total: number
  pct: number
  passed: boolean
  passPct: number
  /** True the first time this user passes this quiz — the moment to award XP. */
  firstPass: boolean
  questions: GradedQuestion[]
}

/**
 * Grade and record an attempt. The client sends { questionId → optionId } and
 * NOTHING else — the key is read fresh here, so a tampered payload can only
 * change which options were chosen, never the score.
 *
 * Unanswered questions are graded wrong rather than rejected: a half-finished
 * attempt is a real thing a person can do, and failing loudly on it would lose
 * the answers they did give.
 */
export async function gradeAttempt(
  userId: string,
  quizId: string,
  chosen: Record<string, string>,
): Promise<GradeResult | { error: string }> {
  const { data: quiz } = await supabaseAdmin
    .from('learn_quizzes').select('id, pass_pct, is_published').eq('id', quizId).single()
  if (!quiz) return { error: 'Quiz not found' }
  if (!quiz.is_published) return { error: 'This quiz is not published' }

  const { data: questions } = await supabaseAdmin
    .from('learn_quiz_questions').select('id, explanation').eq('quiz_id', quizId).order('display_order')
  if (!questions?.length) return { error: 'This quiz has no questions' }

  const { data: options } = await supabaseAdmin
    .from('learn_quiz_options').select('id, question_id, is_correct')
    .in('question_id', questions.map(q => q.id))

  const correctByQuestion = new Map<string, string>()
  const optionQuestion = new Map<string, string>()
  for (const o of options ?? []) {
    optionQuestion.set(o.id, o.question_id)
    if (o.is_correct) correctByQuestion.set(o.question_id, o.id)
  }

  const graded: GradedQuestion[] = questions.map(q => {
    const picked = chosen[q.id] ?? null
    // An option id that belongs to a different question is not a valid answer —
    // treat it as unanswered rather than crediting it.
    const valid = picked && optionQuestion.get(picked) === q.id ? picked : null
    const correct = correctByQuestion.get(q.id) ?? null
    return {
      questionId: q.id,
      chosenOptionId: valid,
      correctOptionId: correct,
      isCorrect: valid != null && valid === correct,
      explanation: q.explanation ?? null,
    }
  })

  const score = graded.filter(g => g.isCorrect).length
  const total = graded.length
  const pct = Math.round((score / total) * 100)
  const passed = pct >= quiz.pass_pct

  const priorSummaries = await getAttemptSummaries(userId)
  const firstPass = passed && priorSummaries.get(quizId)?.passed !== true

  const { data: attempt, error: attErr } = await supabaseAdmin
    .from('learn_quiz_attempts')
    .insert({ quiz_id: quizId, user_id: userId, score, total, passed })
    .select('id').single()
  if (attErr || !attempt) return { error: attErr?.message ?? 'Could not save the attempt' }

  const { error: ansErr } = await supabaseAdmin.from('learn_quiz_answers').insert(
    graded.map(g => ({
      attempt_id: attempt.id,
      question_id: g.questionId,
      option_id: g.chosenOptionId,
      is_correct: g.isCorrect,
    })),
  )
  // The attempt (the graded outcome) is the record that matters; a failure to
  // store the per-question breakdown costs the review screen, not the score.
  if (ansErr) console.error('[learn-quiz] answer rows failed:', ansErr.message)

  return { attemptId: attempt.id, score, total, pct, passed, passPct: quiz.pass_pct, firstPass, questions: graded }
}
