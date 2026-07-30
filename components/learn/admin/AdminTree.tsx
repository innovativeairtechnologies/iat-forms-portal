'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Plus, Pencil, FileClock, CheckCircle2, Circle, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LearnCategory, LearnModule, LearnLesson } from '@/lib/learn'

type LessonRow = Omit<LearnLesson, 'content'>

export default function AdminTree({
  categories, modules, lessons,
}: { categories: LearnCategory[]; modules: LearnModule[]; lessons: LessonRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(c => [c.id, true])),
  )
  const [busy, setBusy] = useState<string | null>(null)

  const lessonsByModule = new Map<string, LessonRow[]>()
  for (const l of lessons) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l)
    lessonsByModule.set(l.module_id, arr)
  }

  async function toggleModule(id: string, next: boolean) {
    setBusy(id)
    try {
      await fetch(`/api/learn/modules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: next }),
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function toggleLesson(id: string, next: boolean) {
    setBusy(id)
    try {
      await fetch(`/api/learn/lessons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: next }),
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function newLesson(moduleId: string) {
    const title = window.prompt('New lesson title:')
    if (!title?.trim()) return
    setBusy(moduleId)
    try {
      const res = await fetch('/api/learn/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_id: moduleId, title: title.trim() }),
      })
      const json = await res.json()
      if (json.id) router.push(`/admin/learn-content/lessons/${json.id}/edit`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const mods = modules.filter(m => m.category_id === category.id)
        return (
          <section key={category.id} className="rounded-xl border border-hairline bg-surface">
            <button
              onClick={() => setOpen(o => ({ ...o, [category.id]: !o[category.id] }))}
              className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
            >
              {open[category.id] ? <ChevronDown size={16} className="text-ink-muted" /> : <ChevronRight size={16} className="text-ink-muted" />}
              <span className="text-[14px] font-semibold text-ink">{category.name}</span>
              <span className="text-[12px] font-medium text-ink-muted">{mods.length} subjects</span>
            </button>

            {open[category.id] && (
              <div className="border-t border-hairline">
                {mods.map(module => {
                  const ls = (lessonsByModule.get(module.id) ?? []).sort((a, b) => a.display_order - b.display_order)
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
                            onClick={() => toggleModule(module.id, !module.is_published)}
                            disabled={busy === module.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                              module.is_published ? 'bg-brand-soft text-brand' : 'bg-surface-strong text-ink-secondary',
                            )}
                          >
                            {busy === module.id ? <Loader2 size={11} className="animate-spin" /> : <span className={cn('h-1.5 w-1.5 rounded-full', module.is_published ? 'bg-brand' : 'bg-ink-faint')} />}
                            {module.is_published ? 'Published' : 'Hidden'}
                          </button>
                          <button
                            onClick={() => newLesson(module.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary transition-colors hover:border-brand hover:text-brand"
                          >
                            <Plus size={12} /> Lesson
                          </button>
                        </div>
                      </div>

                      {ls.length > 0 && (
                        <ul className="mt-2.5 space-y-0.5 pl-1">
                          {ls.map((lesson, i) => (
                            <li key={lesson.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-soft">
                              <span className="w-5 text-right text-[11px] font-medium text-ink-faint">{i + 1}</span>
                              <button
                                onClick={() => toggleLesson(lesson.id, !lesson.is_published)}
                                title={lesson.is_published ? 'Published — click to hide' : 'Draft — click to publish'}
                                disabled={busy === lesson.id}
                              >
                                {lesson.is_published
                                  ? <CheckCircle2 size={14} className="text-brand" />
                                  : <Circle size={14} className="text-ink-faint" />}
                              </button>
                              <span className="flex-1 truncate text-[13px] text-ink-secondary">{lesson.title}</span>
                              <span className="text-[11px] text-ink-faint">{lesson.estimated_minutes}m</span>
                              <a
                                href={`/admin/learn-content/lessons/${lesson.id}/edit`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-ink-muted opacity-0 transition-opacity hover:text-brand group-hover:opacity-100"
                              >
                                <Pencil size={11} /> Edit
                              </a>
                            </li>
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
