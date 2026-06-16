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
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search training categories…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[13.5px] text-gray-800 shadow-card-sm outline-none transition-colors placeholder:text-gray-400 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:shadow-none"
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
        <p className="py-16 text-center text-[13.5px] text-gray-400 dark:text-zinc-500">
          No categories match “{query}”.
        </p>
      )}
    </div>
  )
}
