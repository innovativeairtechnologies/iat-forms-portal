import { notFound } from 'next/navigation'
import { getCategoryWithModules } from '@/lib/learn'
import { LearnIcon } from '@/components/learn/LearnIcon'
import ModuleCard from '@/components/learn/ModuleCard'
import LearnPageShell from '../LearnPageShell'
import PageChrome from '@/app/admin/PageChrome'

export const dynamic = 'force-dynamic'

/* NOTE: this dynamic segment sits beside the static `me/` and `leaderboard/`
   routes. Next gives static segments precedence, and the live category slugs are
   onboarding / company / safety / technical-training / products-tools, so there
   is no collision today — but a future category slugged `me` or `leaderboard`
   would be unreachable. */

export default async function CategoryPage(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  const data = await getCategoryWithModules(params.category)
  if (!data) notFound()
  const { category, modules } = data

  return (
    <LearnPageShell chrome={<PageChrome record={category.name} />}>
      <header className="mb-8 flex items-start gap-4">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-[#f0faf4] text-[#089447] dark:bg-emerald-500/10 dark:text-emerald-400">
          <LearnIcon name={category.icon} size={26} />
        </div>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#0a0a0b] dark:text-white">{category.name}</h1>
          {category.description && (
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-gray-500 dark:text-zinc-400">
              {category.description}
            </p>
          )}
        </div>
      </header>

      {modules.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-[13.5px] text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500">
          No subjects in this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {modules.map((module, i) => (
            <ModuleCard key={module.id} module={module} categorySlug={category.slug} index={i} />
          ))}
        </div>
      )}
    </LearnPageShell>
  )
}
