import Link from 'next/link'
import { Layers, BookOpen, Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { LearnIcon } from './LearnIcon'
import type { CategoryWithStats } from '@/lib/learn'

function fmtMinutes(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function CategoryCard({
  category,
  progress,
}: {
  category: CategoryWithStats
  progress?: { completed: number; total: number; pct: number }
}) {
  const showProgress = !!progress && progress.total > 0 && progress.completed > 0
  const done = !!progress && progress.total > 0 && progress.completed >= progress.total
  return (
    <Link
      href={`/admin/learn/${category.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface p-5 transition-all duration-200 hover:border-hairline-strong"
    >
      {/* The scale-in brand accent bar that used to sit here is gone: DESIGN §2.3
          reserves green for the single primary action, focus and active state —
          never decoration. The border promoting to hairline-strong on hover is
          the affordance now. */}
      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
          <LearnIcon name={category.icon} size={21} />
        </div>
        {done ? (
          <CheckCircle2 size={18} className="text-brand" />
        ) : (
          <ArrowRight
            size={17}
            className="text-ink-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
          />
        )}
      </div>

      <h3 className="text-[15.5px] font-semibold tracking-tight text-ink">{category.name}</h3>
      {category.description && (
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-secondary">
          {category.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3.5 text-[12px] font-medium text-ink-muted">
        <span className="flex items-center gap-1">
          <Layers size={12.5} /> {category.moduleCount} {category.moduleCount === 1 ? 'subject' : 'subjects'}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen size={12.5} /> {category.lessonCount}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12.5} /> {fmtMinutes(category.totalMinutes)}
        </span>
      </div>

      {showProgress && (
        <div className="mt-3.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
            <span className={done ? 'text-brand' : 'text-ink-muted'}>
              {done ? 'Completed' : `${progress!.completed}/${progress!.total} done`}
            </span>
            <span className="tabular-nums text-ink-muted">{progress!.pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
            <div className="h-full rounded-full bg-brand" style={{ width: `${progress!.pct}%` }} />
          </div>
        </div>
      )}
    </Link>
  )
}
