import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Play, ArrowRight, FileClock } from 'lucide-react'
import { getModuleWithLessons } from '@/lib/learn'
import LearnPageShell from '../../LearnPageShell'
import PageChrome from '@/app/admin/PageChrome'

export const dynamic = 'force-dynamic'

function fmtMinutes(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default async function ModulePage(props: { params: Promise<{ category: string; module: string }> }) {
  const params = await props.params;
  const data = await getModuleWithLessons(params.category, params.module)
  if (!data) notFound()
  const { category, module, lessons } = data

  const totalMinutes = lessons.reduce((s, l) => s + (l.estimated_minutes ?? 0), 0)
  const first = lessons[0]
  const base = `/admin/learn/${category.slug}/${module.slug}`

  return (
    <LearnPageShell
      chrome={
        <PageChrome record={[
          { label: category.name, href: `/admin/learn/${category.slug}` },
          { label: module.title },
        ]} />
      }
    >
      <header className="mb-8">
        <h1 className="text-[27px] font-[650] tracking-tight text-ink">{module.title}</h1>
        {module.description && (
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-secondary">
            {module.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4">
          {first && (
            <Link
              href={`${base}/${first.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Play size={15} /> Start training
            </Link>
          )}
          <span className="flex items-center gap-3.5 text-[12.5px] font-medium text-ink-muted">
            <span>{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</span>
            <span className="h-3.5 w-px bg-hairline" />
            <span className="flex items-center gap-1"><Clock size={13} /> {fmtMinutes(totalMinutes)}</span>
          </span>
        </div>
      </header>

      {lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-6 py-14 text-center">
          <FileClock size={26} className="mx-auto mb-3 text-amber-500" />
          <p className="text-[14px] font-semibold text-amber-700">Content import pending</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-amber-600/80">
            This subject is staged from{' '}
            <span className="font-medium">{module.source_file ?? 'Trainual'}</span> and will be
            imported next. An admin can add lessons now from the Learn admin panel.
          </p>
        </div>
      ) : (
        <ol className="relative">
          {/* connecting spine */}
          <span className="absolute bottom-6 left-[18px] top-6 w-px bg-hairline" />
          {lessons.map((lesson, i) => (
            <li key={lesson.id} className="relative">
              <Link
                href={`${base}/${lesson.slug}`}
                className="group flex items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface"
              >
                <span className="relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border-2 border-hairline bg-surface text-[12.5px] font-[650] text-ink-muted transition-colors group-hover:border-brand group-hover:text-brand">
                  {i + 1}
                </span>
                <div className={`min-w-0 flex-1 pb-3.5 pt-0.5 ${i === lessons.length - 1 ? '' : 'border-b border-hairline'}`}>
                  <p className="truncate text-[14px] font-medium text-ink group-hover:text-brand">
                    {lesson.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
                    <Clock size={11.5} /> {lesson.estimated_minutes} min read
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="flex-shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </LearnPageShell>
  )
}
