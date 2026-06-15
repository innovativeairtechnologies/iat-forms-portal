import { notFound } from 'next/navigation'
import { getLessonForEdit } from '@/lib/learn'
import { supabaseAdmin } from '@/lib/supabase-admin'
import LessonEditor from '@/components/learn/admin/LessonEditor'

export const dynamic = 'force-dynamic'

export default async function EditLessonPage({ params }: { params: { id: string } }) {
  const data = await getLessonForEdit(params.id)
  if (!data) notFound()
  const { lesson, module } = data

  // Resolve the live view URL (category → module → lesson slugs).
  let viewHref: string | null = null
  if (module) {
    const { data: category } = await supabaseAdmin
      .from('learn_categories').select('slug').eq('id', module.category_id).single()
    if (category) viewHref = `/learn/${category.slug}/${module.slug}/${lesson.slug}`
  }

  return (
    <div className="px-6 py-10">
      <LessonEditor
        lesson={{
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          estimated_minutes: lesson.estimated_minutes,
          is_published: lesson.is_published,
        }}
        moduleTitle={module?.title ?? 'Lesson'}
        viewHref={viewHref}
      />
    </div>
  )
}
