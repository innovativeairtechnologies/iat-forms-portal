import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getLessonContext } from '@/lib/learn'
import Breadcrumb from '@/components/learn/Breadcrumb'
import LessonContent from '@/components/learn/LessonContent'
import LessonFooterNav from '@/components/learn/LessonFooterNav'

export const dynamic = 'force-dynamic'

export default async function LessonPage(
  props: { params: Promise<{ category: string; module: string; lesson: string }> }
) {
  const params = await props.params;
  const ctx = await getLessonContext(params.category, params.module, params.lesson)
  if (!ctx) notFound()
  const { category, module, lesson, lessons, index } = ctx

  // Current user's completion state for this lesson (Phase-1 progress).
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let completed = false
  if (user) {
    const { data: prog } = await supabaseAdmin
      .from('learn_progress')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('lesson_id', lesson.id)
      .maybeSingle()
    completed = !!prog?.completed_at
  }

  const base = `/learn/${category.slug}/${module.slug}`
  const prev = index > 0 ? lessons[index - 1] : null
  const next = index < lessons.length - 1 ? lessons[index + 1] : null
  const pct = Math.round(((index + 1) / lessons.length) * 100)

  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumb
        items={[
          { label: category.name, href: `/learn/${category.slug}` },
          { label: module.title, href: base },
          { label: lesson.title },
        ]}
      />

      {/* progress within the subject */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-gray-400 dark:text-zinc-500">
          <span>{module.title}</span>
          <span>Lesson {index + 1} of {lessons.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#089447] to-[#44c07d] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#0a0a0b] dark:text-white">
          {lesson.title}
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-gray-400 dark:text-zinc-500">
          <Clock size={13} /> {lesson.estimated_minutes} min read
        </p>
      </header>

      <LessonContent html={lesson.content} />

      <LessonFooterNav
        lessonId={lesson.id}
        initiallyCompleted={completed}
        prevHref={prev ? `${base}/${prev.slug}` : null}
        nextHref={next ? `${base}/${next.slug}` : null}
      />
    </article>
  )
}
