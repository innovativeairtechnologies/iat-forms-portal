import Link from 'next/link'
import { ArrowLeft, Layers, BookOpen, FileClock } from 'lucide-react'
import { getAdminTree } from '@/lib/learn'
import { listQuizzes } from '@/lib/learn-quiz'
import AdminTree, { type QuizIndex } from '@/components/learn/admin/AdminTree'

export const dynamic = 'force-dynamic'

export default async function LearnAdminPage() {
  const [{ categories, modules, lessons, completionsByLesson }, quizRows] = await Promise.all([
    getAdminTree(),
    listQuizzes(),
  ])
  const pendingCount = modules.filter(m => m.import_status === 'pending').length
  const quizzes: QuizIndex = Object.fromEntries(
    quizRows.map(q => [`${q.scopeType}:${q.scopeId}`, {
      id: q.id, isPublished: q.isPublished, questionCount: q.questionCount,
    }]),
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin/learn"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to Learn
      </Link>

      <header className="mb-7">
        <h1 className="text-[26px] font-[650] tracking-tight text-ink">Learn Admin</h1>
        <p className="mt-1.5 text-[14px] text-ink-secondary">
          Manage categories, subjects, and lessons. Toggle visibility, edit content in place, or
          delete what&apos;s no longer needed. Deleting cascades and cannot be undone — set a
          subject to <em>Hidden</em> if you only want it out of the library.
        </p>
        <div className="mt-4 flex items-center gap-5 text-[13px]">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <Layers size={14} className="text-brand" /> {categories.length} categories
          </span>
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <BookOpen size={14} className="text-brand" /> {modules.length} subjects · {lessons.length} lessons
          </span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <FileClock size={14} /> {pendingCount} pending import
            </span>
          )}
        </div>
      </header>

      <AdminTree
        categories={categories}
        modules={modules}
        lessons={lessons}
        completionsByLesson={completionsByLesson}
        quizzes={quizzes}
      />
    </div>
  )
}
