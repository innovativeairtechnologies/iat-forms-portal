import Link from 'next/link'
import { ArrowLeft, Layers, BookOpen, FileClock } from 'lucide-react'
import { getAdminTree } from '@/lib/learn'
import AdminTree from '@/components/learn/admin/AdminTree'

export const dynamic = 'force-dynamic'

export default async function LearnAdminPage() {
  const { categories, modules, lessons } = await getAdminTree()
  const pendingCount = modules.filter(m => m.import_status === 'pending').length

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
          Manage categories, subjects, and lessons. Toggle visibility and edit content in place.
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

      <AdminTree categories={categories} modules={modules} lessons={lessons} />
    </div>
  )
}
