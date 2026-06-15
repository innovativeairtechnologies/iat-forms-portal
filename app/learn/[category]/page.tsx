import { notFound } from 'next/navigation'
import { getCategoryWithModules } from '@/lib/learn'
import { LearnIcon } from '@/components/learn/LearnIcon'
import Breadcrumb from '@/components/learn/Breadcrumb'
import ModuleCard from '@/components/learn/ModuleCard'

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const data = await getCategoryWithModules(params.category)
  if (!data) notFound()
  const { category, modules } = data

  return (
    <div>
      <Breadcrumb items={[{ label: category.name }]} />

      <header className="mb-8 flex items-start gap-4">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-[#f0faf4] text-[#089447]">
          <LearnIcon name={category.icon} size={26} />
        </div>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#0a0a0b]">{category.name}</h1>
          {category.description && (
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-gray-500">
              {category.description}
            </p>
          )}
        </div>
      </header>

      {modules.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-[13.5px] text-gray-400">
          No subjects in this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {modules.map((module, i) => (
            <ModuleCard key={module.id} module={module} categorySlug={category.slug} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
