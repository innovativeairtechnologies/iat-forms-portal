'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search, ChevronRight, Settings2, X,
  Clock, ClipboardCheck, UserPlus, Send, Wrench, FolderOpen,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Form } from '@/lib/supabase'
import ThemeToggle from './ThemeToggle'

const ICON_MAP: Record<string, React.ElementType> = {
  'clock':            Clock,
  'clipboard-check':  ClipboardCheck,
  'user-plus':        UserPlus,
  'send':             Send,
  'tool':             Wrench,
}

const ICON_COLORS: Record<string, string> = {
  'clock':            'bg-blue-50   dark:bg-blue-950/50   text-blue-500   dark:text-blue-400',
  'clipboard-check':  'bg-amber-50  dark:bg-amber-950/50  text-amber-600  dark:text-amber-400',
  'user-plus':        'bg-violet-50 dark:bg-violet-950/50 text-violet-500 dark:text-violet-400',
  'send':             'bg-sky-50    dark:bg-sky-950/50    text-sky-500    dark:text-sky-400',
  'tool':             'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-500',
}

const FALLBACK_ICON_COLOR = 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'

interface Props {
  categories: Category[]
  forms: (Form & { categories: Category })[]
}

export default function FormsPortal({ categories, forms }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const visibleCategories = categories.filter((c) =>
    forms.some((f) => f.category_id === c.id)
  )

  const filtered = useMemo(() => {
    let result = forms
    if (activeCategory !== 'all') {
      result = result.filter((f) => f.categories?.name === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q)
      )
    }
    return result
  }, [forms, activeCategory, search])

  const showGrouped = activeCategory === 'all' && !search.trim()

  const grouped = useMemo(() => {
    if (!showGrouped) return null
    const map: Record<string, { category: Category; forms: typeof forms }> = {}
    filtered.forEach((form) => {
      const cat = form.categories
      if (!cat) return
      if (!map[cat.id]) map[cat.id] = { category: cat, forms: [] }
      map[cat.id].forms.push(form)
    })
    return categories
      .filter((c) => map[c.id])
      .map((c) => map[c.id])
  }, [filtered, categories, showGrouped])

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-card-sm border border-black/[0.06] dark:border-black/10">
              <Image
                src="/iat-logo.png"
                alt="IAT"
                width={20}
                height={20}
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[#0a0a0b] dark:text-white tracking-tight group-hover:text-[#089447] dark:group-hover:text-[#089447] transition-colors">
                IAT
              </span>
              <span className="text-gray-300 dark:text-gray-600 text-sm">/</span>
              <span className="text-[15px] text-gray-500 dark:text-gray-400 font-medium">Forms</span>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-2 py-2"
            >
              <Settings2 size={13} />
              Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6">

        {/* Hero */}
        <div className="pt-16 pb-10 text-center">
          <h1 className="text-[38px] sm:text-[48px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-none mb-3">
            Submit a Request
          </h1>
          <p className="text-[16px] text-gray-400 font-normal">
            {forms.length} forms across {visibleCategories.length} categories
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-10 relative">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (e.target.value) setActiveCategory('all')
            }}
            placeholder="Search forms…"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-10 py-3 text-[14px] text-[#0a0a0b] dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex items-center gap-0 border-b border-gray-100 dark:border-gray-800 mb-0 overflow-x-auto scrollbar-hide -mx-6 px-6">
            {[{ name: 'all', label: 'All', count: forms.length }, ...visibleCategories.map((c) => ({
              name: c.name,
              label: c.name,
              count: forms.filter((f) => f.categories?.name === c.name).length,
            }))].map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveCategory(tab.name)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeCategory === tab.name
                    ? 'border-[#089447] text-[#089447]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
                <span className={`text-[11px] tabular-nums ${activeCategory === tab.name ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="pb-20">

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[15px] text-gray-400">No forms found for &ldquo;{search}&rdquo;</p>
              <button
                onClick={() => setSearch('')}
                className="mt-3 text-[13px] text-[#089447] hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Grouped by category — collapsible */}
          {showGrouped && grouped && grouped.map(({ category, forms: catForms }) => {
            const isOpen = !!openCategories[category.id]
            const IconComponent = (category.icon && ICON_MAP[category.icon]) || FolderOpen
            const iconColor = (category.icon && ICON_COLORS[category.icon]) || FALLBACK_ICON_COLOR

            return (
              <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center gap-3 py-4 -mx-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/70 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${iconColor}`}>
                    <IconComponent size={15} strokeWidth={1.8} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-semibold text-gray-700 dark:text-gray-200 group-hover:text-[#0a0a0b] dark:group-hover:text-white transition-colors">
                    {category.name}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
                    {catForms.length}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    className="flex-shrink-0"
                  >
                    <ChevronRight
                      size={15}
                      className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors"
                    />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="border-t border-gray-100 dark:border-gray-800 mb-2">
                        {catForms.map((form, i) => (
                          <FormRow
                            key={form.id}
                            form={form}
                            isLast={i === catForms.length - 1}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Flat list (single category tab or search results) */}
          {!showGrouped && filtered.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 mt-6">
              {search && (
                <p className="text-[12px] text-gray-400 py-4">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
                </p>
              )}
              {filtered.map((form, i) => (
                <FormRow
                  key={form.id}
                  form={form}
                  showCategory={!!search}
                  isLast={i === filtered.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FormRow({
  form,
  showCategory = false,
  isLast = false,
}: {
  form: Form & { categories?: Category }
  showCategory?: boolean
  isLast?: boolean
}) {
  return (
    <Link
      href={`/forms/${form.slug}`}
      className={`group flex items-center gap-4 py-3.5 ${!isLast ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-gray-50/60 dark:hover:bg-gray-900/60 -mx-6 px-6 transition-colors`}
    >
      <div className="flex-1 min-w-0 pl-11">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-medium text-[#0a0a0b] dark:text-gray-100 group-hover:text-[#089447] dark:group-hover:text-[#089447] transition-colors leading-snug">
            {form.title}
          </span>
          {showCategory && form.categories?.name && (
            <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md flex-shrink-0 hidden sm:inline">
              {form.categories.name}
            </span>
          )}
        </div>
        {form.description && (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-0.5 truncate leading-snug">
            {form.description}
          </p>
        )}
      </div>
      <ChevronRight
        size={15}
        className="text-gray-200 dark:text-gray-700 group-hover:text-[#089447] flex-shrink-0 transition-colors"
      />
    </Link>
  )
}
