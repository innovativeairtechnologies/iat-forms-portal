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
      if (json.id) router.push(`/learn/admin/lessons/${json.id}/edit`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const mods = modules.filter(m => m.category_id === category.id)
        return (
          <section key={category.id} className="rounded-2xl border border-gray-100 bg-white shadow-card-sm">
            <button
              onClick={() => setOpen(o => ({ ...o, [category.id]: !o[category.id] }))}
              className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
            >
              {open[category.id] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              <span className="text-[14px] font-semibold text-[#0a0a0b]">{category.name}</span>
              <span className="text-[12px] font-medium text-gray-400">{mods.length} subjects</span>
            </button>

            {open[category.id] && (
              <div className="border-t border-gray-100">
                {mods.map(module => {
                  const ls = (lessonsByModule.get(module.id) ?? []).sort((a, b) => a.display_order - b.display_order)
                  return (
                    <div key={module.id} className="border-b border-gray-50 px-5 py-3.5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[13.5px] font-semibold text-gray-800">{module.title}</span>
                        {module.import_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-600">
                            <FileClock size={10} /> Pending import
                          </span>
                        )}
                        <span className="text-[11.5px] text-gray-400">{ls.length} lessons</span>

                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => toggleModule(module.id, !module.is_published)}
                            disabled={busy === module.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                              module.is_published ? 'bg-[#f0faf4] text-[#077a3c]' : 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {busy === module.id ? <Loader2 size={11} className="animate-spin" /> : <span className={cn('h-1.5 w-1.5 rounded-full', module.is_published ? 'bg-[#089447]' : 'bg-gray-400')} />}
                            {module.is_published ? 'Published' : 'Hidden'}
                          </button>
                          <button
                            onClick={() => newLesson(module.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11.5px] font-medium text-gray-600 transition-colors hover:border-[#089447] hover:text-[#077a3c]"
                          >
                            <Plus size={12} /> Lesson
                          </button>
                        </div>
                      </div>

                      {ls.length > 0 && (
                        <ul className="mt-2.5 space-y-0.5 pl-1">
                          {ls.map((lesson, i) => (
                            <li key={lesson.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                              <span className="w-5 text-right text-[11px] font-medium text-gray-300">{i + 1}</span>
                              <button
                                onClick={() => toggleLesson(lesson.id, !lesson.is_published)}
                                title={lesson.is_published ? 'Published — click to hide' : 'Draft — click to publish'}
                                disabled={busy === lesson.id}
                              >
                                {lesson.is_published
                                  ? <CheckCircle2 size={14} className="text-[#089447]" />
                                  : <Circle size={14} className="text-gray-300" />}
                              </button>
                              <span className="flex-1 truncate text-[13px] text-gray-700">{lesson.title}</span>
                              <span className="text-[11px] text-gray-300">{lesson.estimated_minutes}m</span>
                              <a
                                href={`/learn/admin/lessons/${lesson.id}/edit`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-gray-400 opacity-0 transition-opacity hover:text-[#089447] group-hover:opacity-100"
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
