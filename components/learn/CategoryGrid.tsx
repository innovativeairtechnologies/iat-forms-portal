'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import CategoryCard from './CategoryCard'
import type { CategoryWithStats } from '@/lib/learn'

type CategoryProgress = { completed: number; total: number; pct: number }

export default function CategoryGrid({
  categories,
  progress,
}: {
  categories: CategoryWithStats[]
  progress?: Record<string, CategoryProgress>
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    )
  }, [categories, query])

  return (
    <div>
      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search training categories…"
          className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-4 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((category, i) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: Math.min(i * 0.04, 0.4), ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <CategoryCard category={category} progress={progress?.[category.id]} />
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-[13.5px] text-ink-muted">
          No categories match “{query}”.
        </p>
      )}
    </div>
  )
}
