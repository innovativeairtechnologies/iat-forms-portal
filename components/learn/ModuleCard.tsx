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
      href={`/learn/${categorySlug}/${module.slug}`}
      className="group relative flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b9ebce] hover:shadow-card-hover"
    >
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-gray-50 text-[13px] font-bold text-gray-400 transition-colors group-hover:bg-[#f0faf4] group-hover:text-[#089447]">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-[#0a0a0b]">
            {module.title}
          </h3>
          {pending && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-600">
              <Clock3 size={10} /> Content soon
            </span>
          )}
        </div>
        {module.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gray-500">
            {module.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3.5 text-[12px] font-medium text-gray-400">
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
        className="mt-1 flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#089447]"
      />
    </Link>
  )
}
