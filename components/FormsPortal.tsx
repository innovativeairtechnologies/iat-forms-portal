'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search, ChevronRight, Settings2, X,
  Clock, ClipboardCheck, UserPlus, Send, Wrench, FolderOpen,
  ChevronDown, ArrowUpRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, Form } from '@/lib/supabase'
import ThemeToggle from './ThemeToggle'
import StepFormModal from './StepFormModal'

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

const CARD_ACCENT: Record<string, string> = {
  'clock':           'group-hover:border-blue-200 dark:group-hover:border-blue-800',
  'clipboard-check': 'group-hover:border-amber-200 dark:group-hover:border-amber-800',
  'user-plus':       'group-hover:border-violet-200 dark:group-hover:border-violet-800',
  'send':            'group-hover:border-sky-200 dark:group-hover:border-sky-800',
  'tool':            'group-hover:border-emerald-200 dark:group-hover:border-emerald-800',
}

const FALLBACK_ICON_COLOR = 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
const FALLBACK_CARD_ACCENT = 'group-hover:border-gray-300 dark:group-hover:border-gray-600'

type SortOption = 'most-used' | 'a-z' | 'z-a'

const SORT_LABELS: Record<SortOption, string> = {
  'most-used': 'Most Used',
  'a-z':       'A → Z',
  'z-a':       'Z → A',
}

interface Props {
  categories: Category[]
  forms: (Form & { categories: Category })[]
}

export default function FormsPortal({ categories, forms }: Props) {
  const [search, setSearch]               = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [categorySort, setCategorySort]   = useState<Record<string, SortOption>>({})
  const [openSlug, setOpenSlug]           = useState<string | null>(null)

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

  const getSortedForms = (catForms: typeof forms, catId: string) => {
    const sort = categorySort[catId] ?? 'most-used'
    return [...catForms].sort((a, b) => {
      if (sort === 'most-used') return (b.submission_count ?? 0) - (a.submission_count ?? 0)
      if (sort === 'a-z')       return a.title.localeCompare(b.title)
      if (sort === 'z-a')       return b.title.localeCompare(a.title)
      return 0
    })
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

          {/* Step form modal */}
          <AnimatePresence>
            {openSlug && (
              <StepFormModal slug={openSlug} onClose={() => setOpenSlug(null)} />
            )}
          </AnimatePresence>

          {/* Grouped by category — collapsible with card grid */}
          {showGrouped && grouped && grouped.map(({ category, forms: catForms }) => {
            const isOpen       = !!openCategories[category.id]
            const sort         = categorySort[category.id] ?? 'most-used'
            const IconComponent = (category.icon && ICON_MAP[category.icon]) || FolderOpen
            const iconColor    = (category.icon && ICON_COLORS[category.icon]) || FALLBACK_ICON_COLOR
            const sortedForms  = getSortedForms(catForms, category.id)

            return (
              <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                {/* Accordion header */}
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

                {/* Accordion body */}
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
                      <div className="pt-1 pb-5">
                        {/* Sort bar */}
                        <div className="flex items-center justify-end mb-3">
                          <SortDropdown
                            value={sort}
                            onChange={(val) =>
                              setCategorySort((prev) => ({ ...prev, [category.id]: val }))
                            }
                          />
                        </div>

                        {/* Card grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {sortedForms.map((form) => (
                            <FormCard
                              key={form.id}
                              form={form}
                              categoryIcon={category.icon}
                              onOpen={setOpenSlug}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Flat list (single category tab or search results) */}
          {!showGrouped && filtered.length > 0 && (
            <div className="mt-6">
              {search && (
                <p className="text-[12px] text-gray-400 py-4">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((form) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    categoryIcon={form.categories?.icon ?? null}
                    showCategory={!!search}
                    onOpen={setOpenSlug}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sort Dropdown ─────────────────────────────────────────── */

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption
  onChange: (v: SortOption) => void
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        onClick={(e) => e.stopPropagation()}
        className="appearance-none cursor-pointer text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-0 rounded-lg pl-3 pr-7 py-1.5 outline-none transition-colors"
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
          <option key={opt} value={opt}>
            {SORT_LABELS[opt]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
      />
    </div>
  )
}

/* ─── Form Card ─────────────────────────────────────────────── */

function FormCard({
  form,
  categoryIcon,
  showCategory = false,
  onOpen,
}: {
  form: Form & { categories?: Category }
  categoryIcon: string | null
  showCategory?: boolean
  onOpen: (slug: string) => void
}) {
  const IconComponent = (categoryIcon && ICON_MAP[categoryIcon]) || FolderOpen
  const iconColor     = (categoryIcon && ICON_COLORS[categoryIcon]) || FALLBACK_ICON_COLOR
  const cardAccent    = (categoryIcon && CARD_ACCENT[categoryIcon]) || FALLBACK_CARD_ACCENT

  return (
    <button
      onClick={() => onOpen(form.slug)}
      className={`group relative w-full text-left bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 transition-all duration-150 hover:shadow-md dark:hover:shadow-gray-900 hover:-translate-y-px ${cardAccent}`}
    >
      {/* Icon + arrow row */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          <IconComponent size={17} strokeWidth={1.7} />
        </div>
        <ArrowUpRight
          size={15}
          className="text-gray-200 dark:text-gray-700 group-hover:text-[#089447] transition-colors mt-0.5 flex-shrink-0"
        />
      </div>

      {/* Title */}
      <p className="text-[13.5px] font-semibold text-[#0a0a0b] dark:text-gray-100 group-hover:text-[#089447] transition-colors leading-snug mb-1">
        {form.title}
      </p>

      {/* Description */}
      {form.description && (
        <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug line-clamp-2">
          {form.description}
        </p>
      )}

      {/* Footer meta */}
      <div className="flex items-center gap-2 mt-3">
        {showCategory && form.categories?.name && (
          <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md">
            {form.categories.name}
          </span>
        )}
        {(form.submission_count ?? 0) > 0 && (
          <span className="text-[11px] text-gray-300 dark:text-gray-600 tabular-nums">
            {form.submission_count} submission{form.submission_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}
