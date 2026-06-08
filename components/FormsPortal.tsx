'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search, X, Settings2, Clock, ClipboardCheck, UserPlus, Send, Wrench, FolderOpen, ChevronDown,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Category, Form } from '@/lib/supabase'
import ThemeToggle from './ThemeToggle'
import StepFormModal from './StepFormModal'

const ICON_MAP: Record<string, React.ElementType> = {
  'clock':           Clock,
  'clipboard-check': ClipboardCheck,
  'user-plus':       UserPlus,
  'send':            Send,
  'tool':            Wrench,
}

function getIcon(icon: string | null | undefined): React.ElementType {
  return (icon && ICON_MAP[icon]) || FolderOpen
}

type SortOption = 'most-used' | 'a-z' | 'z-a'

interface Props {
  categories: Category[]
  forms: (Form & { categories: Category })[]
}

export default function FormsPortal({ categories, forms }: Props) {
  const [search, setSearch]         = useState('')
  const [activeCategory, setActive] = useState('all')
  const [sort, setSort]             = useState<SortOption>('most-used')
  const [openSlug, setOpenSlug]     = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({})

  const visibleCategories = categories.filter((c) => forms.some((f) => f.category_id === c.id))

  const filtered = useMemo(() => {
    let r = forms
    if (activeCategory !== 'all') r = r.filter((f) => f.categories?.name === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((f) => f.title.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
    }
    return r
  }, [forms, activeCategory, search])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === 'most-used') return (b.submission_count ?? 0) - (a.submission_count ?? 0)
    if (sort === 'a-z')       return a.title.localeCompare(b.title)
    return b.title.localeCompare(a.title)
  }), [filtered, sort])

  const showGrouped = activeCategory === 'all' && !search.trim()

  const grouped = useMemo(() => {
    if (!showGrouped) return null
    const map: Record<string, { category: Category; forms: (Form & { categories: Category })[] }> = {}
    sorted.forEach((f) => {
      const cat = f.categories
      if (!cat) return
      if (!map[cat.id]) map[cat.id] = { category: cat, forms: [] }
      map[cat.id].forms.push(f)
    })
    return categories.filter((c) => map[c.id]).map((c) => map[c.id])
  }, [sorted, categories, showGrouped])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-card-sm border border-black/[0.06] dark:border-black/10">
              <Image src="/iat-logo.png" alt="IAT" width={20} height={20} style={{ mixBlendMode: 'multiply' }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[#0a0a0b] dark:text-white tracking-tight group-hover:text-[#089447] transition-colors">IAT</span>
              <span className="text-gray-300 dark:text-gray-600 text-sm">/</span>
              <span className="text-[15px] text-gray-500 dark:text-gray-400 font-medium">Forms</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/admin" className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-2 py-2">
              <Settings2 size={13} />Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6">

        {/* Hero */}
        <div className="pt-14 pb-8 text-center">
          <h1 className="text-[36px] sm:text-[46px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-none mb-2.5">
            Submit a Request
          </h1>
          <p className="text-[15px] text-gray-400">
            {forms.length} forms across {visibleCategories.length} categories
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-8 relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActive('all') }}
            placeholder="Search forms…"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-10 py-3 text-[14px] text-[#0a0a0b] dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex items-center gap-0 border-b border-gray-100 dark:border-gray-800 mb-0 overflow-x-auto scrollbar-hide -mx-6 px-6">
            {[
              { name: 'all', label: 'All', count: forms.length },
              ...visibleCategories.map((c) => ({
                name: c.name, label: c.name,
                count: forms.filter((f) => f.categories?.name === c.name).length,
              })),
            ].map((tab) => (
              <button key={tab.name} onClick={() => setActive(tab.name)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeCategory === tab.name
                    ? 'border-[#089447] text-[#089447]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-600'
                }`}>
                {tab.label}
                <span className={`text-[11px] tabular-nums ${activeCategory === tab.name ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="pb-20 pt-8 space-y-8">

          <AnimatePresence>
            {openSlug && <StepFormModal slug={openSlug} onClose={() => setOpenSlug(null)} />}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[15px] text-gray-400">No forms found for &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch('')} className="mt-3 text-[13px] text-[#089447] hover:underline">Clear search</button>
            </div>
          )}

          {/* Sort — flat views only */}
          {!showGrouped && sorted.length > 0 && (
            <div className="flex items-center justify-between -mt-2">
              {search && <p className="text-[12px] text-gray-400">{sorted.length} result{sorted.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;</p>}
              <div className="ml-auto"><SortPills value={sort} onChange={setSort} /></div>
            </div>
          )}

          {/* Grouped — All tab */}
          {showGrouped && grouped && grouped.map(({ category, forms: catForms }) => {
            const Icon   = getIcon(category.icon)
            const isOpen = !!expanded[category.id]
            const toggle = () => setExpanded((p) => ({ ...p, [category.id]: !p[category.id] }))

            return (
              <section key={category.id}>
                <button onClick={toggle} className="w-full flex items-center gap-3 mb-4 group">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                    <Icon size={15} strokeWidth={1.8} />
                  </div>
                  <h2 className="text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-[#089447] transition-colors">
                    {category.name}
                  </h2>
                  <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600 tabular-nums">
                    {catForms.length} {catForms.length === 1 ? 'form' : 'forms'}
                  </span>
                  <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="ml-auto flex-shrink-0">
                    <ChevronDown size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-1">
                        {catForms.map((form) => (
                          <FormCard key={form.id} form={form} onOpen={setOpenSlug} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )
          })}

          {/* Flat — category tab or search */}
          {!showGrouped && sorted.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map((form) => (
                <FormCard key={form.id} form={form} onOpen={setOpenSlug} showCategory />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

function FormCard({ form, onOpen, showCategory = false }: {
  form: Form & { categories?: Category }
  onOpen: (slug: string) => void
  showCategory?: boolean
}) {
  const Icon = getIcon(form.categories?.icon)

  return (
    <button
      onClick={() => onOpen(form.slug)}
      className="group w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col h-[160px] overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5 active:translate-y-0 transition-all"
    >
      {/* Icon + optional category pill */}
      <div className="flex items-start justify-between gap-2 mb-auto">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          <Icon size={16} strokeWidth={1.8} />
        </div>
        {showCategory && form.categories?.name && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0">
            {form.categories.name}
          </span>
        )}
      </div>

      {/* Title + description pinned to bottom */}
      <div className="mt-auto">
        <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-[#089447] transition-colors">
          {form.title}
        </p>
        {form.description && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
            {form.description}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Sort Pills ───────────────────────────────────────────────────────────────

const SORT_OPTS: { value: SortOption; label: string }[] = [
  { value: 'most-used', label: 'Most used' },
  { value: 'a-z',       label: 'A → Z' },
  { value: 'z-a',       label: 'Z → A' },
]

function SortPills({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <div className="flex items-center gap-1">
      {SORT_OPTS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all ${
            value === opt.value
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

