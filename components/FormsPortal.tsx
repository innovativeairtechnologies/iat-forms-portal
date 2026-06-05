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
  'clock':           Clock,
  'clipboard-check': ClipboardCheck,
  'user-plus':       UserPlus,
  'send':            Send,
  'tool':            Wrench,
}

const ICON_COLORS: Record<string, string> = {
  'clock':           'bg-blue-50   dark:bg-blue-950/50   text-blue-500   dark:text-blue-400',
  'clipboard-check': 'bg-amber-50  dark:bg-amber-950/50  text-amber-600  dark:text-amber-400',
  'user-plus':       'bg-violet-50 dark:bg-violet-950/50 text-violet-500 dark:text-violet-400',
  'send':            'bg-sky-50    dark:bg-sky-950/50    text-sky-500    dark:text-sky-400',
  'tool':            'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-500',
}

const CARD_HOVER: Record<string, string> = {
  'clock':           'hover:border-blue-200   dark:hover:border-blue-800',
  'clipboard-check': 'hover:border-amber-200  dark:hover:border-amber-800',
  'user-plus':       'hover:border-violet-200 dark:hover:border-violet-800',
  'send':            'hover:border-sky-200    dark:hover:border-sky-800',
  'tool':            'hover:border-emerald-200 dark:hover:border-emerald-800',
}

// Subtle radial glow for featured cards
const FEATURED_GLOW: Record<string, string> = {
  'clock':           'rgba(59,130,246,0.07)',
  'clipboard-check': 'rgba(217,119,6,0.07)',
  'user-plus':       'rgba(139,92,246,0.07)',
  'send':            'rgba(14,165,233,0.07)',
  'tool':            'rgba(16,185,129,0.07)',
}

const FALLBACK_ICON_COLOR = 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
const FALLBACK_CARD_HOVER = 'hover:border-gray-300 dark:hover:border-gray-600'
const FALLBACK_GLOW       = 'rgba(120,120,120,0.05)'

type BentoSize  = 'featured' | 'wide' | 'default'
type SortOption = 'most-used' | 'a-z' | 'z-a'

const SORT_LABELS: Record<SortOption, string> = {
  'most-used': 'Most Used',
  'a-z':       'A → Z',
  'z-a':       'Z → A',
}

// Pattern: first card is featured, every 5th after is wide, rest default
function getBentoSize(index: number): BentoSize {
  if (index === 0) return 'featured'
  if (index % 5 === 0) return 'wide'
  return 'default'
}

interface Props {
  categories: Category[]
  forms: (Form & { categories: Category })[]
}

export default function FormsPortal({ categories, forms }: Props) {
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [categorySort, setCategorySort]     = useState<Record<string, SortOption>>({})
  const [flatSort, setFlatSort]             = useState<SortOption>('most-used')
  const [openSlug, setOpenSlug]             = useState<string | null>(null)

  const visibleCategories = categories.filter((c) =>
    forms.some((f) => f.category_id === c.id)
  )

  const filtered = useMemo(() => {
    let result = forms
    if (activeCategory !== 'all')
      result = result.filter((f) => f.categories?.name === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (f) => f.title.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q)
      )
    }
    return result
  }, [forms, activeCategory, search])

  const sortedFlat = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (flatSort === 'most-used') return (b.submission_count ?? 0) - (a.submission_count ?? 0)
      if (flatSort === 'a-z')       return a.title.localeCompare(b.title)
      if (flatSort === 'z-a')       return b.title.localeCompare(a.title)
      return 0
    })
  }, [filtered, flatSort])

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
    return categories.filter((c) => map[c.id]).map((c) => map[c.id])
  }, [filtered, categories, showGrouped])

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
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-card-sm border border-black/[0.06] dark:border-black/10">
              <Image src="/iat-logo.png" alt="IAT" width={20} height={20} style={{ mixBlendMode: 'multiply' }} />
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
            <Link href="/admin" className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-2 py-2">
              <Settings2 size={13} />Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6">

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
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActiveCategory('all') }}
            placeholder="Search forms…"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-10 py-3 text-[14px] text-[#0a0a0b] dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex items-center gap-0 border-b border-gray-100 dark:border-gray-800 mb-0 overflow-x-auto scrollbar-hide -mx-6 px-6">
            {[{ name: 'all', label: 'All', count: forms.length }, ...visibleCategories.map((c) => ({
              name: c.name, label: c.name,
              count: forms.filter((f) => f.categories?.name === c.name).length,
            }))].map((tab) => (
              <button key={tab.name} onClick={() => setActiveCategory(tab.name)}
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

        {/* Results */}
        <div className="pb-20">

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[15px] text-gray-400">No forms found for &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch('')} className="mt-3 text-[13px] text-[#089447] hover:underline">
                Clear search
              </button>
            </div>
          )}

          <AnimatePresence>
            {openSlug && <StepFormModal slug={openSlug} onClose={() => setOpenSlug(null)} />}
          </AnimatePresence>

          {/* Grouped accordions */}
          {showGrouped && grouped && grouped.map(({ category, forms: catForms }) => {
            const isOpen        = !!openCategories[category.id]
            const sort          = categorySort[category.id] ?? 'most-used'
            const IconComponent = (category.icon && ICON_MAP[category.icon]) || FolderOpen
            const iconColor     = (category.icon && ICON_COLORS[category.icon]) || FALLBACK_ICON_COLOR
            const sortedForms   = getSortedForms(catForms, category.id)

            return (
              <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setOpenCategories((p) => ({ ...p, [category.id]: !p[category.id] }))}
                  className="w-full flex items-center gap-3 py-4 -mx-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/70 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                    <IconComponent size={15} strokeWidth={1.8} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-semibold text-gray-700 dark:text-gray-200 group-hover:text-[#0a0a0b] dark:group-hover:text-white transition-colors">
                    {category.name}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
                    {catForms.length}
                  </span>
                  <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="flex-shrink-0">
                    <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="content"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                      <div className="pt-1 pb-6">
                        <div className="flex items-center justify-end mb-3">
                          <SortDropdown value={sort} onChange={(v) => setCategorySort((p) => ({ ...p, [category.id]: v }))} />
                        </div>
                        <BentoGrid forms={sortedForms} categoryIcon={category.icon} onOpen={setOpenSlug} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Flat list */}
          {!showGrouped && filtered.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                {search
                  ? <p className="text-[12px] text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;</p>
                  : <span />
                }
                <SortDropdown value={flatSort} onChange={setFlatSort} />
              </div>
              <BentoGrid
                forms={sortedFlat}
                categoryIcon={null}
                showCategory={!!search}
                onOpen={setOpenSlug}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sort Dropdown ────────────────────────────────────────────── */

function SortDropdown({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value as SortOption)} onClick={(e) => e.stopPropagation()}
        className="appearance-none cursor-pointer text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-0 rounded-lg pl-3 pr-7 py-1.5 outline-none transition-colors">
        {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
          <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
    </div>
  )
}

/* ─── Bento Grid ───────────────────────────────────────────────── */

function BentoGrid({ forms, categoryIcon, showCategory = false, onOpen }: {
  forms: (Form & { categories?: Category })[]
  categoryIcon: string | null
  showCategory?: boolean
  onOpen: (slug: string) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-[170px] gap-3 [grid-auto-flow:dense]">
      {forms.map((form, i) => (
        <BentoCard
          key={form.id}
          form={form}
          size={getBentoSize(i)}
          categoryIcon={categoryIcon ?? form.categories?.icon ?? null}
          showCategory={showCategory}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

/* ─── Bento Card ───────────────────────────────────────────────── */

function BentoCard({ form, size, categoryIcon, showCategory = false, onOpen }: {
  form: Form & { categories?: Category }
  size: BentoSize
  categoryIcon: string | null
  showCategory?: boolean
  onOpen: (slug: string) => void
}) {
  const IconComponent = (categoryIcon && ICON_MAP[categoryIcon]) || FolderOpen
  const iconColor     = (categoryIcon && ICON_COLORS[categoryIcon]) || FALLBACK_ICON_COLOR
  const cardHover     = (categoryIcon && CARD_HOVER[categoryIcon])  || FALLBACK_CARD_HOVER
  const glowColor     = (categoryIcon && FEATURED_GLOW[categoryIcon]) || FALLBACK_GLOW

  const spanClass =
    size === 'featured' ? 'col-span-2 row-span-2' :
    size === 'wide'     ? 'col-span-2 row-span-1' :
                          'col-span-1 row-span-1'

  const base = `group relative w-full h-full text-left bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg dark:hover:shadow-black/30 hover:-translate-y-0.5 ${cardHover} ${spanClass}`

  /* ── Featured (2×2) ── */
  if (size === 'featured') {
    return (
      <button onClick={() => onOpen(form.slug)} className={base}>
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 85% 15%, ${glowColor} 0%, transparent 65%)` }} />
        {/* Watermark icon */}
        <div className="absolute -bottom-4 -right-4 opacity-[0.045] pointer-events-none text-current">
          <IconComponent size={140} strokeWidth={1} />
        </div>

        <div className="relative flex flex-col h-full p-6">
          {/* Icon + arrow */}
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
              <IconComponent size={22} strokeWidth={1.7} />
            </div>
            <ArrowUpRight size={16} className="text-gray-200 dark:text-gray-700 group-hover:text-[#089447] transition-colors" />
          </div>

          {/* Content pushed to bottom */}
          <div className="mt-auto">
            {showCategory && form.categories?.name && (
              <span className="inline-block text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md mb-2">
                {form.categories.name}
              </span>
            )}
            <p className="text-[18px] font-bold text-[#0a0a0b] dark:text-gray-100 group-hover:text-[#089447] transition-colors leading-snug mb-2">
              {form.title}
            </p>
            {form.description && (
              <p className="text-[13px] text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-3">
                {form.description}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  /* ── Wide (2×1) ── */
  if (size === 'wide') {
    return (
      <button onClick={() => onOpen(form.slug)} className={base}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 95% 50%, ${glowColor} 0%, transparent 60%)` }} />
        {/* Faint watermark */}
        <div className="absolute -bottom-2 -right-3 opacity-[0.04] pointer-events-none">
          <IconComponent size={90} strokeWidth={1} />
        </div>

        <div className="relative flex items-center gap-4 h-full px-6">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            <IconComponent size={20} strokeWidth={1.7} />
          </div>
          <div className="flex-1 min-w-0">
            {showCategory && form.categories?.name && (
              <span className="inline-block text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md mb-1">
                {form.categories.name}
              </span>
            )}
            <p className="text-[15px] font-semibold text-[#0a0a0b] dark:text-gray-100 group-hover:text-[#089447] transition-colors leading-snug">
              {form.title}
            </p>
            {form.description && (
              <p className="text-[12.5px] text-gray-400 dark:text-gray-500 mt-1 truncate">
                {form.description}
              </p>
            )}
          </div>
          <ArrowUpRight size={15} className="text-gray-200 dark:text-gray-700 group-hover:text-[#089447] transition-colors flex-shrink-0" />
        </div>
      </button>
    )
  }

  /* ── Default (1×1) ── */
  return (
    <button onClick={() => onOpen(form.slug)} className={base}>
      <div className="flex flex-col h-full p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            <IconComponent size={16} strokeWidth={1.7} />
          </div>
          <ArrowUpRight size={14} className="text-gray-200 dark:text-gray-700 group-hover:text-[#089447] transition-colors mt-0.5" />
        </div>
        {showCategory && form.categories?.name && (
          <span className="inline-block text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mb-1.5 self-start">
            {form.categories.name}
          </span>
        )}
        <p className="text-[13px] font-semibold text-[#0a0a0b] dark:text-gray-100 group-hover:text-[#089447] transition-colors leading-snug mb-1.5">
          {form.title}
        </p>
        {form.description && (
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-snug line-clamp-2 mt-auto">
            {form.description}
          </p>
        )}
      </div>
    </button>
  )
}
