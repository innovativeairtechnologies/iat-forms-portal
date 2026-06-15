import Link from 'next/link'
import { Layers, BookOpen, Clock, ArrowRight } from 'lucide-react'
import { LearnIcon } from './LearnIcon'
import type { CategoryWithStats } from '@/lib/learn'

function fmtMinutes(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function CategoryCard({ category }: { category: CategoryWithStats }) {
  return (
    <Link
      href={`/learn/${category.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b9ebce] hover:shadow-card-hover"
    >
      {/* hover accent bar */}
      <span className="absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-[#089447] to-[#44c07d] transition-transform duration-300 group-hover:scale-x-100" />

      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f0faf4] text-[#089447] transition-colors group-hover:bg-[#089447] group-hover:text-white">
          <LearnIcon name={category.icon} size={21} />
        </div>
        <ArrowRight
          size={17}
          className="text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#089447]"
        />
      </div>

      <h3 className="text-[15.5px] font-semibold tracking-tight text-[#0a0a0b]">{category.name}</h3>
      {category.description && (
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gray-500">
          {category.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3.5 text-[12px] font-medium text-gray-400">
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
    </Link>
  )
}
