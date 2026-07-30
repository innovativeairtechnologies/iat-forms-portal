import Link from 'next/link'
import { BookOpen, Clock, ArrowRight, Clock3 } from 'lucide-react'
import type { ModuleWithStats } from '@/lib/learn'

function fmtMinutes(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function ModuleCard({
  module, categorySlug, index,
}: { module: ModuleWithStats; categorySlug: string; index: number }) {
  const pending = module.import_status === 'pending'

  return (
    <Link
      href={`/admin/learn/${categorySlug}/${module.slug}`}
      className="group relative flex items-start gap-4 rounded-xl border border-hairline bg-surface p-5 transition-all duration-200 hover:border-hairline-strong"
    >
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-surface-soft text-[13px] font-[650] text-ink-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-ink">
            {module.title}
          </h3>
          {pending && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-600">
              <Clock3 size={10} /> Content soon
            </span>
          )}
        </div>
        {module.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-secondary">
            {module.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3.5 text-[12px] font-medium text-ink-muted">
          <span className="flex items-center gap-1">
            <BookOpen size={12.5} /> {module.lessonCount} {module.lessonCount === 1 ? 'lesson' : 'lessons'}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12.5} /> {fmtMinutes(module.totalMinutes)}
          </span>
        </div>
      </div>

      <ArrowRight
        size={17}
        className="mt-1 flex-shrink-0 text-ink-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
      />
    </Link>
  )
}
