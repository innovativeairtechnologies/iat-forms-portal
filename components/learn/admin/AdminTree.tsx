'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Plus, Pencil, FileClock, CheckCircle2, Circle, Loader2,
  Trash2, AlertTriangle, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LearnCategory, LearnModule, LearnLesson } from '@/lib/learn'

type LessonRow = Omit<LearnLesson, 'content'>

/* Delete target. Everything below a category cascades (category → subjects →
   lessons → learn_progress), so the confirmation has to state the real blast
   radius, not just the row you clicked. Counts come from the tree data so the
   strip appears instantly; the server recounts authoritatively before deleting,
   since afterwards the rows are gone and uncountable. */
type Target = { scope: 'category' | 'module' | 'lesson'; id: string; label: string }

/** `completions: null` means the progress table could not be read — NOT zero. */
type Impact = { modules: number; lessons: number; completions: number | null }

const ENDPOINT: Record<Target['scope'], string> = {
  category: 'categories',
  module: 'modules',
  lesson: 'lessons',
}

// Reveal on hover AND on keyboard focus. `opacity-0` alone leaves the control in
// the tab order but invisible — and it swallows the element's own focus ring,
// so a keyboard user lands on an unseen destructive button.
const REVEAL = 'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

function DeleteButton({ t, onPick, className }: { t: Target; onPick: (t: Target) => void; className?: string }) {
  return (
    <button
      onClick={() => onPick(t)}
      aria-label={`Delete ${t.label}`}
      title={`Delete ${t.label}`}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1 text-ink-faint transition-colors',
        'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
        FOCUS_RING, className,
      )}
    >
      <Trash2 size={13} />
    </button>
  )
}

/* Hoisted to module scope on purpose: defined inside the parent it would be a
   new component type on every render, so React would unmount and remount it
   whenever busy/error/target changed — tearing down the confirm button
   mid-flight and dropping focus. */
function ConfirmStrip({
  t, impact, busy, error, onConfirm, onCancel,
}: {
  t: Target
  impact: Impact
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Activating the trash button removes it from the DOM, so focus would fall to
  // <body>. Move it here instead, and announce the strip.
  useEffect(() => { ref.current?.focus() }, [])

  const parts: string[] = []
  if (t.scope === 'category' && impact.modules > 0) {
    parts.push(`${impact.modules} subject${impact.modules === 1 ? '' : 's'}`)
  }
  // Scope guard matters: for a lesson target `impact.lessons` IS the lesson
  // already named in the headline, so appending it would read
  // "Delete “X” and 1 lesson?" — implying a second lesson.
  if (t.scope !== 'lesson' && impact.lessons > 0) {
    parts.push(`${impact.lessons} lesson${impact.lessons === 1 ? '' : 's'}`)
  }

  const c = impact.completions

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alertdialog"
      aria-label={`Confirm deleting ${t.label}`}
      className={cn(
        'rounded-lg border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-500/30 dark:bg-rose-500/10',
        'focus:outline-none',
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">
            Delete “{t.label}”{parts.length > 0 ? ` and ${parts.join(' · ')}` : ''}?
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
            {c === null ? (
              <>
                Permanent — there is no undo. <span className="font-semibold text-rose-700 dark:text-rose-400">
                Completion records could not be checked</span>, so this may erase progress that counts
                toward people&apos;s XP, levels and badges.
              </>
            ) : c > 0 ? (
              <>
                This also erases <span className="font-semibold text-rose-700 dark:text-rose-400">
                {c} completion record{c === 1 ? '' : 's'}</span>, so those lessons stop counting toward
                anyone&apos;s XP, level and badges. Can&apos;t be undone.
              </>
            ) : (
              <>Permanent — there is no undo. Nobody has completed {t.scope === 'lesson' ? 'this lesson' : 'anything in here'} yet, so no progress is lost.</>
            )}
            {t.scope !== 'category' && (
              <> To take it out of the library without destroying it, set it to <em>Hidden</em> instead.</>
            )}
          </p>
          {error && (
            <p role="alert" className="mt-1.5 text-[12px] font-medium text-rose-700 dark:text-rose-400">{error}</p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onConfirm}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white',
                'transition-colors hover:bg-rose-700 disabled:opacity-60', FOCUS_RING,
              )}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete permanently
            </button>
            <button
              onClick={onCancel}
              className={cn(
                'rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-secondary',
                'transition-colors hover:border-hairline-strong hover:text-ink', FOCUS_RING,
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminTree({
  categories, modules, lessons, completionsByLesson,
}: {
  categories: LearnCategory[]
  modules: LearnModule[]
  lessons: LessonRow[]
  /** null = the progress table could not be read; do NOT treat as zero. */
  completionsByLesson: Record<string, number> | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(c => [c.id, true])),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Banner for things that happen outside the confirm strip. */
  const [notice, setNotice] = useState<{ tone: 'rose' | 'amber'; text: string } | null>(null)

  const lessonsByModule = new Map<string, LessonRow[]>()
  for (const l of lessons) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l)
    lessonsByModule.set(l.module_id, arr)
  }

  /** What a cascade delete of `t` would take with it, per the loaded tree. */
  function impactOf(t: Target): Impact {
    let ls: LessonRow[] = []
    let mods = 0
    if (t.scope === 'category') {
      const ids = new Set(modules.filter(m => m.category_id === t.id).map(m => m.id))
      mods = ids.size
      ls = lessons.filter(l => ids.has(l.module_id))
    } else if (t.scope === 'module') {
      mods = 1
      ls = lessonsByModule.get(t.id) ?? []
    } else {
      ls = lessons.filter(l => l.id === t.id)
    }
    const completions = completionsByLesson === null
      ? null
      : ls.reduce((n, l) => n + (completionsByLesson[l.id] ?? 0), 0)
    return { modules: mods, lessons: ls.length, completions }
  }

  /** Clear `busy` only if we still own it — a sibling request must not unlock us. */
  const release = (id: string) => setBusy(b => (b === id ? null : b))

  async function patch(kind: 'modules' | 'lessons', id: string, body: Record<string, unknown>) {
    setBusy(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/learn/${kind}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setNotice({ tone: 'rose', text: d.error || 'Could not save that change.' })
        return
      }
      router.refresh()
    } catch {
      setNotice({ tone: 'rose', text: 'Could not save that change — check your connection.' })
    } finally {
      release(id)
    }
  }

  async function newLesson(moduleId: string) {
    const title = window.prompt('New lesson title:')
    if (!title?.trim()) return
    setBusy(moduleId)
    setNotice(null)
    try {
      const res = await fetch('/api/learn/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_id: moduleId, title: title.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setNotice({ tone: 'rose', text: d.error || 'Could not create the lesson.' })
        return
      }
      const json = await res.json().catch(() => ({}))
      if (json.id) router.push(`/admin/learn-content/lessons/${json.id}/edit`)
      else router.refresh()
    } catch {
      setNotice({ tone: 'rose', text: 'Could not create the lesson — check your connection.' })
    } finally {
      release(moduleId)
    }
  }

  async function confirmDelete() {
    if (!target || busy) return // re-entrancy guard: a double click must not send two DELETEs
    const t = target
    const previewed = impactOf(t)
    setBusy(t.id)
    setError(null)
    try {
      const res = await fetch(`/api/learn/${ENDPOINT[t.scope]}/${t.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Delete failed.')
        return
      }
      // The server recounts authoritatively. If it destroyed more than the strip
      // previewed (someone completed a lesson between page load and confirm),
      // say so — the admin consented to a smaller number.
      const actual = json.deleted as { lessons?: number; completions?: number } | undefined
      if (actual && previewed.completions !== null && (actual.completions ?? 0) > previewed.completions) {
        setNotice({
          tone: 'amber',
          text: `Deleted “${t.label}”. It had ${actual.completions} completion record${actual.completions === 1 ? '' : 's'}, more than the ${previewed.completions} shown — someone completed a lesson in the meantime.`,
        })
      }
      setTarget(null)
      router.refresh()
    } catch {
      setError('Delete failed — check your connection and try again.')
    } finally {
      release(t.id)
    }
  }

  const pick = (t: Target) => { setTarget(t); setError(null); setNotice(null) }
  const cancel = () => { setTarget(null); setError(null) }
  const isTarget = (scope: Target['scope'], id: string) => target?.scope === scope && target.id === id

  const strip = (t: Target) => (
    <ConfirmStrip
      t={t}
      impact={impactOf(t)}
      busy={busy === t.id}
      error={error}
      onConfirm={confirmDelete}
      onCancel={cancel}
    />
  )

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px]',
            notice.tone === 'rose'
              ? 'border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
              : 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
          )}
        >
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className={cn('rounded p-0.5', FOCUS_RING)}>
            <X size={13} />
          </button>
        </div>
      )}

      {completionsByLesson === null && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[12.5px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>Completion counts are unavailable right now, so deletions can&apos;t tell you how much progress they would erase. Reload before deleting anything.</span>
        </div>
      )}

      {categories.map(category => {
        const mods = modules.filter(m => m.category_id === category.id)
        return (
          <section key={category.id} className="rounded-xl border border-hairline bg-surface">
            {isTarget('category', category.id) ? (
              <div className="p-3">{strip(target!)}</div>
            ) : (
              <div className="flex items-center gap-2 px-5 py-3.5">
                <button
                  onClick={() => setOpen(o => ({ ...o, [category.id]: !o[category.id] }))}
                  aria-expanded={!!open[category.id]}
                  className={cn('flex flex-1 items-center gap-2 text-left', FOCUS_RING)}
                >
                  {open[category.id] ? <ChevronDown size={16} className="text-ink-muted" /> : <ChevronRight size={16} className="text-ink-muted" />}
                  <span className="text-[14px] font-semibold text-ink">{category.name}</span>
                  <span className="text-[12px] font-medium text-ink-muted">{mods.length} subjects</span>
                </button>
                <DeleteButton t={{ scope: 'category', id: category.id, label: category.name }} onPick={pick} />
              </div>
            )}

            {open[category.id] && !isTarget('category', category.id) && (
              <div className="border-t border-hairline">
                {mods.map(module => {
                  const ls = (lessonsByModule.get(module.id) ?? []).sort((a, b) => a.display_order - b.display_order)
                  if (isTarget('module', module.id)) {
                    return (
                      <div key={module.id} className="border-b border-hairline-soft p-3 last:border-0">
                        {strip(target!)}
                      </div>
                    )
                  }
                  return (
                    <div key={module.id} className="border-b border-hairline-soft px-5 py-3.5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[13.5px] font-semibold text-ink">{module.title}</span>
                        {module.import_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            <FileClock size={10} /> Pending import
                          </span>
                        )}
                        <span className="text-[11.5px] text-ink-muted">{ls.length} lessons</span>

                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => patch('modules', module.id, { is_published: !module.is_published })}
                            disabled={busy === module.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                              module.is_published ? 'bg-brand-soft text-brand' : 'bg-surface-strong text-ink-secondary',
                              FOCUS_RING,
                            )}
                          >
                            {busy === module.id ? <Loader2 size={11} className="animate-spin" /> : <span className={cn('h-1.5 w-1.5 rounded-full', module.is_published ? 'bg-brand' : 'bg-ink-faint')} />}
                            {module.is_published ? 'Published' : 'Hidden'}
                          </button>
                          <button
                            onClick={() => newLesson(module.id)}
                            disabled={busy === module.id}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary',
                              'transition-colors hover:border-brand hover:text-brand disabled:opacity-60', FOCUS_RING,
                            )}
                          >
                            <Plus size={12} /> Lesson
                          </button>
                          <DeleteButton t={{ scope: 'module', id: module.id, label: module.title }} onPick={pick} />
                        </div>
                      </div>

                      {ls.length > 0 && (
                        <ul className="mt-2.5 space-y-0.5 pl-1">
                          {ls.map((lesson, i) => (
                            isTarget('lesson', lesson.id) ? (
                              <li key={lesson.id} className="py-1.5">{strip(target!)}</li>
                            ) : (
                              <li key={lesson.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-soft">
                                <span className="w-5 text-right text-[11px] font-medium text-ink-faint">{i + 1}</span>
                                <button
                                  onClick={() => patch('lessons', lesson.id, { is_published: !lesson.is_published })}
                                  title={lesson.is_published ? 'Published — click to hide' : 'Draft — click to publish'}
                                  aria-label={lesson.is_published ? `Hide ${lesson.title}` : `Publish ${lesson.title}`}
                                  disabled={busy === lesson.id}
                                  className={cn('rounded', FOCUS_RING)}
                                >
                                  {lesson.is_published
                                    ? <CheckCircle2 size={14} className="text-brand" />
                                    : <Circle size={14} className="text-ink-faint" />}
                                </button>
                                <span className="flex-1 truncate text-[13px] text-ink-secondary">{lesson.title}</span>
                                {(completionsByLesson?.[lesson.id] ?? 0) > 0 && (
                                  <span
                                    title={`${completionsByLesson![lesson.id]} completion${completionsByLesson![lesson.id] === 1 ? '' : 's'}`}
                                    className="text-[11px] tabular-nums text-ink-muted"
                                  >
                                    ✓{completionsByLesson![lesson.id]}
                                  </span>
                                )}
                                <span className="text-[11px] text-ink-faint">{lesson.estimated_minutes}m</span>
                                <a
                                  href={`/admin/learn-content/lessons/${lesson.id}/edit`}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-ink-muted hover:text-brand',
                                    REVEAL, FOCUS_RING,
                                  )}
                                >
                                  <Pencil size={11} /> Edit
                                </a>
                                <DeleteButton
                                  t={{ scope: 'lesson', id: lesson.id, label: lesson.title }}
                                  onPick={pick}
                                  className={REVEAL}
                                />
                              </li>
                            )
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
