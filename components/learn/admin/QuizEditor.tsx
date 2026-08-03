'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Check, Loader2, Trash2, AlertTriangle, Sparkles, BookOpen, Eye, EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Quiz, QuizQuestionWithKey } from '@/lib/learn-quiz'

/* Review surface for an AI-drafted quiz.

   Nothing Claude writes reaches a learner from here without a human pressing
   Publish, and Publish is refused server-side unless every question has exactly
   one correct option — a reviewer who deletes the right answer can't
   accidentally ship an unpassable quiz.

   Each question shows the lesson it was drawn from, so checking the answer key
   is a click rather than a hunt. */

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

type Props = {
  quiz: Quiz
  questions: QuizQuestionWithKey[]
  scopeLabel: string
  lessonTitles: Record<string, string>
  attemptCount: number
}

export default function QuizEditor({ quiz, questions: initial, scopeLabel, lessonTitles, attemptCount }: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'rose' | 'emerald'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const brokenIds = new Set(
    questions.filter(q => q.options.filter(o => o.isCorrect).length !== 1).map(q => q.id),
  )

  async function call(url: string, init: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  async function saveQuestion(q: QuizQuestionWithKey, patch: Record<string, unknown>) {
    setBusy(q.id); setNotice(null)
    try {
      const { ok, data } = await call(`/api/learn/quizzes/questions/${q.id}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      })
      if (!ok) setNotice({ tone: 'rose', text: String(data.error ?? 'Could not save that change.') })
    } finally { setBusy(b => (b === q.id ? null : b)) }
  }

  function setCorrect(q: QuizQuestionWithKey, optionId: string) {
    setQuestions(qs => qs.map(x => x.id !== q.id ? x : {
      ...x, options: x.options.map(o => ({ ...o, isCorrect: o.id === optionId })),
    }))
    void saveQuestion(q, { correctOptionId: optionId })
  }

  async function removeQuestion(q: QuizQuestionWithKey) {
    setBusy(q.id)
    try {
      const { ok, data } = await call(`/api/learn/quizzes/questions/${q.id}`, { method: 'DELETE' })
      if (!ok) { setNotice({ tone: 'rose', text: String(data.error ?? 'Could not delete.') }); return }
      setQuestions(qs => qs.filter(x => x.id !== q.id))
    } finally { setBusy(b => (b === q.id ? null : b)) }
  }

  async function togglePublish() {
    setBusy('quiz'); setNotice(null)
    try {
      const { ok, data } = await call(`/api/learn/quizzes/${quiz.id}`, {
        method: 'PATCH', body: JSON.stringify({ is_published: !quiz.isPublished }),
      })
      if (!ok) { setNotice({ tone: 'rose', text: String(data.error ?? 'Could not change status.') }); return }
      setNotice({ tone: 'emerald', text: quiz.isPublished ? 'Unpublished.' : 'Published — learners can take it now.' })
      router.refresh()
    } finally { setBusy(b => (b === 'quiz' ? null : b)) }
  }

  async function deleteQuiz() {
    setBusy('quiz')
    try {
      const { ok, data } = await call(`/api/learn/quizzes/${quiz.id}`, { method: 'DELETE' })
      if (!ok) { setNotice({ tone: 'rose', text: String(data.error ?? 'Could not delete.') }); return }
      router.push('/admin/learn-content')
      router.refresh()
    } finally { setBusy(b => (b === 'quiz' ? null : b)) }
  }

  const meta = quiz.generatedMeta as { model?: string; generated_at?: string; source_chars?: number }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/learn-content" className={cn('mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:text-ink', FOCUS)}>
        <ArrowLeft size={15} /> Back to content
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
            <Sparkles size={11} /> AI draft
          </span>
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
            quiz.isPublished
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
          )}>
            {quiz.isPublished ? <Eye size={11} /> : <EyeOff size={11} />}
            {quiz.isPublished ? 'Published' : 'Draft'}
          </span>
          <span className="text-[12px] text-ink-muted">{scopeLabel}</span>
        </div>
        <h1 className="mt-2 text-[24px] font-[650] tracking-tight text-ink">{quiz.title}</h1>
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          {questions.length} question{questions.length === 1 ? '' : 's'} · pass at {quiz.passPct}%
          {meta.model ? <> · drafted by {meta.model}</> : null}
          {attemptCount > 0 ? <> · {attemptCount} attempt{attemptCount === 1 ? '' : 's'} recorded</> : null}
        </p>
      </header>

      {notice && (
        <div role="alert" className={cn(
          'mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px]',
          notice.tone === 'rose'
            ? 'border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
            : 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
        )}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      {!quiz.isPublished && (
        <p className="mb-4 rounded-lg border border-hairline bg-surface-soft p-3 text-[12.5px] leading-relaxed text-ink-secondary">
          Check the answer key before publishing — every question names the lesson it came from.
          Once published, this subject only counts as complete when someone passes at {quiz.passPct}%.
        </p>
      )}

      <div className="space-y-3">
        {questions.map((q, i) => {
          const broken = brokenIds.has(q.id)
          return (
            <section key={q.id} className={cn(
              'rounded-xl border bg-surface p-4',
              broken ? 'border-rose-300 dark:border-rose-500/40' : 'border-hairline',
            )}>
              <div className="mb-2 flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-surface-strong text-[11.5px] font-semibold tabular-nums text-ink-secondary">
                  {i + 1}
                </span>
                <textarea
                  defaultValue={q.prompt}
                  onBlur={e => e.target.value.trim() !== q.prompt && saveQuestion(q, { prompt: e.target.value })}
                  rows={2}
                  className={cn('flex-1 resize-y rounded-lg border border-hairline bg-surface px-3 py-2 text-[13.5px] text-ink outline-none', FOCUS)}
                />
                <button
                  onClick={() => removeQuestion(q)}
                  disabled={busy === q.id}
                  aria-label={`Delete question ${i + 1}`}
                  className={cn('rounded-md p-1.5 text-ink-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400', FOCUS)}
                >
                  {busy === q.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>

              <div className="space-y-1.5 pl-9">
                {q.options.map(o => (
                  <label key={o.id} className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                    o.isCorrect
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                      : 'border-hairline hover:bg-surface-soft',
                  )}>
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={o.isCorrect}
                      onChange={() => setCorrect(q, o.id)}
                      className="sr-only"
                    />
                    <span className={cn(
                      'grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border',
                      o.isCorrect ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-hairline-strong',
                    )}>
                      {o.isCorrect && <Check size={10} />}
                    </span>
                    <input
                      defaultValue={o.label}
                      onBlur={e => e.target.value.trim() !== o.label && saveQuestion(q, { options: [{ id: o.id, label: e.target.value }] })}
                      className="flex-1 bg-transparent text-[13px] text-ink outline-none"
                    />
                  </label>
                ))}
              </div>

              {broken && (
                <p className="mt-2 pl-9 text-[12px] font-medium text-rose-700 dark:text-rose-400">
                  Pick exactly one correct answer — this question blocks publishing.
                </p>
              )}

              <div className="mt-2.5 pl-9">
                <textarea
                  defaultValue={q.explanation ?? ''}
                  placeholder="Explanation shown after answering…"
                  onBlur={e => e.target.value.trim() !== (q.explanation ?? '') && saveQuestion(q, { explanation: e.target.value })}
                  rows={2}
                  className={cn('w-full resize-y rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-[12.5px] text-ink-secondary outline-none placeholder:text-ink-faint', FOCUS)}
                />
                {q.sourceLessonId && lessonTitles[q.sourceLessonId] && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                    <BookOpen size={11} /> from “{lessonTitles[q.sourceLessonId]}”
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hairline pt-5">
        <button
          onClick={togglePublish}
          disabled={busy === 'quiz' || (!quiz.isPublished && (questions.length === 0 || brokenIds.size > 0))}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50',
            quiz.isPublished
              ? 'border border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink'
              : 'bg-brand text-white hover:bg-brand-hover',
            FOCUS,
          )}
        >
          {busy === 'quiz' ? <Loader2 size={13} className="animate-spin" /> : quiz.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
          {quiz.isPublished ? 'Unpublish' : 'Publish quiz'}
        </button>

        {brokenIds.size > 0 && !quiz.isPublished && (
          <span className="text-[12px] text-rose-700 dark:text-rose-400">
            {brokenIds.size} question{brokenIds.size === 1 ? '' : 's'} need a correct answer first
          </span>
        )}

        <div className="ml-auto">
          {confirmDelete ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-[12px] text-ink-secondary">
                Delete this quiz{attemptCount > 0 ? ` and ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}` : ''}?
              </span>
              <button onClick={deleteQuiz} disabled={busy === 'quiz'} className={cn('rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60', FOCUS)}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className={cn('rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-secondary', FOCUS)}>
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:text-rose-400', FOCUS)}>
              <Trash2 size={12} /> Delete quiz
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
