'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, Trophy, RotateCcw, ArrowLeft, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Quiz, QuizQuestion, GradeResult } from '@/lib/learn-quiz'

/* Take a quiz.

   The answer key is NOT in this component's props — `questions` comes from
   getQuizForLearner, which never selects is_correct. Submitting posts option
   ids and the server grades. That means "view source" tells you nothing, and
   the result below is the server's, not a local calculation. */

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export default function QuizRunner({
  quiz, questions, backHref, backLabel, previousBestPct, alreadyPassed,
}: {
  quiz: Quiz
  questions: QuizQuestion[]
  backHref: string
  backLabel: string
  previousBestPct: number | null
  alreadyPassed: boolean
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GradeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const answered = Object.keys(answers).length
  const allAnswered = answered === questions.length

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/learn/quizzes/${quiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data.error ?? 'Could not submit.')); return }
      setResult(data as GradeResult)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      router.refresh() // completion + XP may have changed
    } catch {
      setError('Could not submit — check your connection.')
    } finally { setBusy(false) }
  }

  function retake() {
    setAnswers({}); setResult(null); setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const byQuestion = new Map(result?.questions.map(q => [q.questionId, q]) ?? [])

  return (
    <article className="mx-auto max-w-2xl">
      <Link href={backHref} className={cn('mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:text-ink', FOCUS)}>
        <ArrowLeft size={15} /> {backLabel}
      </Link>

      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-ink">
          <ClipboardList size={11} /> Knowledge check
        </span>
        <h1 className="mt-2 text-[24px] font-[650] leading-tight tracking-tight text-ink">{quiz.title}</h1>
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          {questions.length} questions · {quiz.passPct}% to pass
          {previousBestPct != null && <> · your best so far {previousBestPct}%</>}
          {alreadyPassed && <> · <span className="font-semibold text-emerald-700 dark:text-emerald-400">passed</span></>}
        </p>
      </header>

      {/* ── Result banner ─────────────────────────────────────────────── */}
      {result && (
        <section className={cn(
          'mb-6 rounded-xl border p-5',
          result.passed
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10',
        )}>
          <div className="flex items-start gap-3">
            <span className={cn(
              'grid h-11 w-11 flex-shrink-0 place-items-center rounded-full',
              result.passed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white',
            )}>
              {result.passed ? <Trophy size={20} /> : <RotateCcw size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-[650] tracking-tight text-ink">
                {result.score} of {result.total} — {result.pct}%
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">
                {result.passed ? (
                  result.firstPass
                    ? <>Passed. This subject now counts as complete, and you&apos;ve earned XP for it.</>
                    : <>Passed again — your best score stands.</>
                ) : (
                  <>You need {quiz.passPct}% to pass. Read the explanations below, then try again — retakes are unlimited and your best score is the one that counts.</>
                )}
              </p>
              {!result.passed && (
                <button onClick={retake} className={cn('mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover', FOCUS)}>
                  <RotateCcw size={13} /> Try again
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* ── Questions ─────────────────────────────────────────────────── */}
      <ol className="space-y-4">
        {questions.map((q, i) => {
          const graded = byQuestion.get(q.id)
          return (
            <li key={q.id} className="rounded-xl border border-hairline bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-surface-strong text-[11.5px] font-semibold tabular-nums text-ink-secondary">
                  {i + 1}
                </span>
                <p className="flex-1 text-[14px] font-medium leading-snug text-ink">{q.prompt}</p>
              </div>

              <div className="mt-3 space-y-1.5 pl-9">
                {q.options.map(o => {
                  const picked = answers[q.id] === o.id
                  const isCorrect = graded?.correctOptionId === o.id
                  const isWrongPick = graded && graded.chosenOptionId === o.id && !graded.isCorrect
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] transition-colors',
                        result ? 'cursor-default' : 'cursor-pointer hover:bg-surface-soft',
                        isCorrect && 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10',
                        isWrongPick && 'border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/10',
                        !result && picked && 'border-brand bg-brand-soft',
                        !result && !picked && 'border-hairline',
                        result && !isCorrect && !isWrongPick && 'border-hairline',
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={picked}
                        disabled={!!result}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: o.id }))}
                        className="sr-only"
                      />
                      <span className={cn(
                        'grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border',
                        isCorrect ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isWrongPick ? 'border-rose-600 bg-rose-600 text-white'
                            : picked ? 'border-brand bg-brand text-white' : 'border-hairline-strong',
                      )}>
                        {isCorrect ? <Check size={10} /> : isWrongPick ? <X size={10} /> : picked ? <Check size={10} /> : null}
                      </span>
                      <span className="flex-1 text-ink-secondary">{o.label}</span>
                    </label>
                  )
                })}
              </div>

              {graded?.explanation && (
                <p className="mt-2.5 pl-9 text-[12.5px] leading-relaxed text-ink-muted">
                  {graded.explanation}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {!result && (
        <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50', FOCUS)}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Submit answers
          </button>
          <span className="text-[12.5px] tabular-nums text-ink-muted">
            {answered} of {questions.length} answered
          </span>
        </div>
      )}
    </article>
  )
}
