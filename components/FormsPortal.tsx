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

/* ─── Icon map ───────────────────────────────────────────────────── */
const ICON_MAP: Record<string, React.ElementType> = {
  'clock':           Clock,
  'clipboard-check': ClipboardCheck,
  'user-plus':       UserPlus,
  'send':            Send,
  'tool':            Wrench,
}

/* ─── Vibe palette — one entry per category icon ─────────────────── */
const VIBE: Record<string, {
  neon:    string   // hex accent colour
  rgb:     string   // r,g,b for inline shadow
  icon:    string   // icon container classes
  border:  string   // outer gradient-border bg
  hoverShadow: string
}> = {
  'clock': {
    neon:  '#60a5fa',
    rgb:   '96,165,250',
    icon:  'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
    border:'from-blue-500/60 via-blue-500/20 to-transparent',
    hoverShadow: '0 0 28px rgba(96,165,250,0.35)',
  },
  'clipboard-check': {
    neon:  '#fbbf24',
    rgb:   '251,191,36',
    icon:  'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    border:'from-amber-500/60 via-amber-500/20 to-transparent',
    hoverShadow: '0 0 28px rgba(251,191,36,0.35)',
  },
  'user-plus': {
    neon:  '#a78bfa',
    rgb:   '167,139,250',
    icon:  'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30',
    border:'from-violet-500/60 via-violet-500/20 to-transparent',
    hoverShadow: '0 0 28px rgba(167,139,250,0.35)',
  },
  'send': {
    neon:  '#38bdf8',
    rgb:   '56,189,248',
    icon:  'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    border:'from-sky-500/60 via-sky-500/20 to-transparent',
    hoverShadow: '0 0 28px rgba(56,189,248,0.35)',
  },
  'tool': {
    neon:  '#34d399',
    rgb:   '52,211,153',
    icon:  'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    border:'from-emerald-500/60 via-emerald-500/20 to-transparent',
    hoverShadow: '0 0 28px rgba(52,211,153,0.35)',
  },
}
const FALLBACK_VIBE = {
  neon:  '#94a3b8',
  rgb:   '148,163,184',
  icon:  'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30',
  border:'from-slate-500/40 via-slate-500/15 to-transparent',
  hoverShadow: '0 0 28px rgba(148,163,184,0.25)',
}

/* ─── Types / helpers ────────────────────────────────────────────── */
type BentoSize  = 'featured' | 'wide' | 'default'
type SortOption = 'most-used' | 'a-z' | 'z-a'

const SORT_LABELS: Record<SortOption, string> = {
  'most-used': 'Most Used',
  'a-z':       'A → Z',
  'z-a':       'Z → A',
}

function getBentoSize(i: number): BentoSize {
  if (i === 0) return 'featured'
  if (i % 5 === 0) return 'wide'
  return 'default'
}

function pad(n: number) { return String(n + 1).padStart(2, '0') }

/* ─── Component ──────────────────────────────────────────────────── */
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

  const visibleCategories = categories.filter(c => forms.some(f => f.category_id === c.id))

  const filtered = useMemo(() => {
    let r = forms
    if (activeCategory !== 'all') r = r.filter(f => f.categories?.name === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(f => f.title.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q))
    }
    return r
  }, [forms, activeCategory, search])

  const sortedFlat = useMemo(() => [...filtered].sort((a, b) => {
    if (flatSort === 'most-used') return (b.submission_count ?? 0) - (a.submission_count ?? 0)
    if (flatSort === 'a-z')       return a.title.localeCompare(b.title)
    return b.title.localeCompare(a.title)
  }), [filtered, flatSort])

  const showGrouped = activeCategory === 'all' && !search.trim()

  const grouped = useMemo(() => {
    if (!showGrouped) return null
    const map: Record<string, { category: Category; forms: typeof forms }> = {}
    filtered.forEach(f => {
      const cat = f.categories; if (!cat) return
      if (!map[cat.id]) map[cat.id] = { category: cat, forms: [] }
      map[cat.id].forms.push(f)
    })
    return categories.filter(c => map[c.id]).map(c => map[c.id])
  }, [filtered, categories, showGrouped])

  const getSorted = (catForms: typeof forms, catId: string) => {
    const s = categorySort[catId] ?? 'most-used'
    return [...catForms].sort((a, b) =>
      s === 'most-used' ? (b.submission_count ?? 0) - (a.submission_count ?? 0) :
      s === 'a-z'       ? a.title.localeCompare(b.title) :
                          b.title.localeCompare(a.title)
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
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

        {/* ── Hero ── */}
        <div className="pt-16 pb-10 text-center">
          <h1 className="text-[38px] sm:text-[48px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-none mb-3">
            Submit a Request
          </h1>
          <p className="text-[16px] text-gray-400">
            {forms.length} forms across {visibleCategories.length} categories
          </p>
        </div>

        {/* ── Search ── */}
        <div className="max-w-md mx-auto mb-10 relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory('all') }}
            placeholder="Search forms…"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-10 py-3 text-[14px] text-[#0a0a0b] dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800/50 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 hover:text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Category tabs ── */}
        {!search && (
          <div className="flex items-center gap-0 border-b border-gray-100 dark:border-gray-800 mb-0 overflow-x-auto scrollbar-hide -mx-6 px-6">
            {[{ name: 'all', label: 'All', count: forms.length },
              ...visibleCategories.map(c => ({ name: c.name, label: c.name, count: forms.filter(f => f.categories?.name === c.name).length }))
            ].map(tab => (
              <button key={tab.name} onClick={() => setActiveCategory(tab.name)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeCategory === tab.name
                    ? 'border-[#089447] text-[#089447]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-200'
                }`}>
                {tab.label}
                <span className={`text-[11px] tabular-nums ${activeCategory === tab.name ? 'text-gray-500' : 'text-gray-300 dark:text-gray-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Results ── */}
        <div className="pb-20">

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[15px] text-gray-400">No forms found for &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch('')} className="mt-3 text-[13px] text-[#089447] hover:underline">Clear search</button>
            </div>
          )}

          <AnimatePresence>
            {openSlug && <StepFormModal slug={openSlug} onClose={() => setOpenSlug(null)} />}
          </AnimatePresence>

          {/* Grouped accordions */}
          {showGrouped && grouped && grouped.map(({ category, forms: catForms }) => {
            const isOpen  = !!openCategories[category.id]
            const sort    = categorySort[category.id] ?? 'most-used'
            const Icon    = (category.icon && ICON_MAP[category.icon]) || FolderOpen
            const v       = (category.icon && VIBE[category.icon]) || FALLBACK_VIBE

            return (
              <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setOpenCategories(p => ({ ...p, [category.id]: !p[category.id] }))}
                  className="w-full flex items-center gap-3 py-4 -mx-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/70 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${v.icon}`}>
                    <Icon size={15} strokeWidth={1.8} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-semibold text-gray-700 dark:text-gray-200 group-hover:text-[#0a0a0b] dark:group-hover:text-white transition-colors">
                    {category.name}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
                    {catForms.length}
                  </span>
                  <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.18 }} className="flex-shrink-0">
                    <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                      <div className="pt-1 pb-6">
                        <div className="flex items-center justify-end mb-3">
                          <SortDropdown value={sort} onChange={val => setCategorySort(p => ({ ...p, [category.id]: val }))} />
                        </div>
                        <VibeGrid forms={getSorted(catForms, category.id)} categoryIcon={category.icon} onOpen={setOpenSlug} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Flat / search */}
          {!showGrouped && filtered.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                {search
                  ? <p className="text-[12px] text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;</p>
                  : <span />
                }
                <SortDropdown value={flatSort} onChange={setFlatSort} />
              </div>
              <VibeGrid forms={sortedFlat} categoryIcon={null} showCategory={!!search} onOpen={setOpenSlug} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sort Dropdown ───────────────────────────────────────────────── */
function SortDropdown({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={e => onChange(e.target.value as SortOption)} onClick={e => e.stopPropagation()}
        className="appearance-none cursor-pointer text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-0 rounded-lg pl-3 pr-7 py-1.5 outline-none transition-colors">
        {(Object.keys(SORT_LABELS) as SortOption[]).map(o => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

/* ─── Vibe Grid ───────────────────────────────────────────────────── */
function VibeGrid({ forms, categoryIcon, showCategory = false, onOpen }: {
  forms: (Form & { categories?: Category })[]
  categoryIcon: string | null
  showCategory?: boolean
  onOpen: (slug: string) => void
}) {
  return (
    /* Dark showcase container */
    <div className="bg-[#09090f] rounded-2xl p-3 border border-white/[0.06]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      {/* Subtle dot grid */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-30"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="relative grid grid-cols-2 md:grid-cols-3 auto-rows-[170px] gap-2.5 [grid-auto-flow:dense]">
        {forms.map((form, i) => (
          <VibeCard key={form.id} form={form} index={i} size={getBentoSize(i)}
            categoryIcon={categoryIcon ?? form.categories?.icon ?? null}
            showCategory={showCategory} onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Vibe Card ───────────────────────────────────────────────────── */
function VibeCard({ form, index, size, categoryIcon, showCategory, onOpen }: {
  form: Form & { categories?: Category }
  index: number
  size: BentoSize
  categoryIcon: string | null
  showCategory: boolean
  onOpen: (slug: string) => void
}) {
  const IconComponent = (categoryIcon && ICON_MAP[categoryIcon]) || FolderOpen
  const v = (categoryIcon && VIBE[categoryIcon]) || FALLBACK_VIBE

  const spanClass =
    size === 'featured' ? 'col-span-2 row-span-2' :
    size === 'wide'     ? 'col-span-2 row-span-1' :
                          'col-span-1 row-span-1'

  /* Gradient-border outer wrapper */
  const outerBase = `group relative rounded-xl p-[1px] transition-all duration-300 bg-gradient-to-br ${v.border} ${spanClass}`

  /* ── Featured 2×2 ── */
  if (size === 'featured') {
    return (
      <button onClick={() => onOpen(form.slug)} className={outerBase}
        style={{ '--glow': v.hoverShadow } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = v.hoverShadow)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
        <div className="relative bg-[#0d0d16] rounded-[11px] h-full w-full overflow-hidden flex flex-col p-5">
          {/* Mesh glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 85% 15%, rgba(${v.rgb},0.12) 0%, transparent 60%)` }} />
          {/* Ghosted number */}
          <span className="absolute bottom-2 right-3 text-[90px] font-black leading-none select-none pointer-events-none"
            style={{ color: `rgba(${v.rgb},0.06)` }}>{pad(index)}</span>

          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${v.icon}`}
            style={{ boxShadow: `0 0 16px rgba(${v.rgb},0.2)` }}>
            <IconComponent size={22} strokeWidth={1.7} />
          </div>

          {/* Content */}
          <div className="mt-auto relative z-10">
            {showCategory && form.categories?.name && (
              <span className="inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md mb-2"
                style={{ color: v.neon, background: `rgba(${v.rgb},0.12)` }}>
                {form.categories.name}
              </span>
            )}
            <p className="text-[19px] font-bold leading-snug mb-1.5 bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, #ffffff 30%, rgba(${v.rgb},0.9) 100%)` }}>
              {form.title}
            </p>
            {form.description && (
              <p className="text-[12.5px] text-white/40 leading-relaxed line-clamp-2">{form.description}</p>
            )}
          </div>

          {/* Arrow */}
          <ArrowUpRight size={15} className="absolute top-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: v.neon }} />
        </div>
      </button>
    )
  }

  /* ── Wide 2×1 ── */
  if (size === 'wide') {
    return (
      <button onClick={() => onOpen(form.slug)} className={outerBase}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = v.hoverShadow)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
        <div className="relative bg-[#0d0d16] rounded-[11px] h-full w-full overflow-hidden flex items-center gap-4 px-5">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 95% 50%, rgba(${v.rgb},0.09) 0%, transparent 55%)` }} />
          <span className="absolute right-4 bottom-1 text-[60px] font-black leading-none select-none pointer-events-none"
            style={{ color: `rgba(${v.rgb},0.05)` }}>{pad(index)}</span>

          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.icon}`}
            style={{ boxShadow: `0 0 12px rgba(${v.rgb},0.18)` }}>
            <IconComponent size={18} strokeWidth={1.7} />
          </div>

          <div className="flex-1 min-w-0 relative z-10">
            {showCategory && form.categories?.name && (
              <span className="inline-block text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded mb-1"
                style={{ color: v.neon, background: `rgba(${v.rgb},0.12)` }}>
                {form.categories.name}
              </span>
            )}
            <p className="text-[14.5px] font-semibold text-white/90 group-hover:text-white leading-snug transition-colors">{form.title}</p>
            {form.description && (
              <p className="text-[12px] text-white/35 mt-0.5 truncate">{form.description}</p>
            )}
          </div>

          <ArrowUpRight size={14} className="flex-shrink-0 opacity-20 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: v.neon }} />
        </div>
      </button>
    )
  }

  /* ── Default 1×1 ── */
  return (
    <button onClick={() => onOpen(form.slug)} className={outerBase}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = v.hoverShadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
      <div className="relative bg-[#0d0d16] rounded-[11px] h-full w-full overflow-hidden flex flex-col p-4">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 90% 10%, rgba(${v.rgb},0.08) 0%, transparent 55%)` }} />
        <span className="absolute bottom-1 right-2 text-[52px] font-black leading-none select-none pointer-events-none"
          style={{ color: `rgba(${v.rgb},0.06)` }}>{pad(index)}</span>

        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${v.icon}`}
            style={{ boxShadow: `0 0 10px rgba(${v.rgb},0.15)` }}>
            <IconComponent size={16} strokeWidth={1.7} />
          </div>
          <ArrowUpRight size={13} className="opacity-20 group-hover:opacity-100 transition-opacity duration-200 mt-0.5"
            style={{ color: v.neon }} />
        </div>

        {showCategory && form.categories?.name && (
          <span className="inline-block text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded mb-1.5 self-start"
            style={{ color: v.neon, background: `rgba(${v.rgb},0.12)` }}>
            {form.categories.name}
          </span>
        )}

        <p className="text-[13px] font-semibold text-white/85 group-hover:text-white leading-snug transition-colors relative z-10">
          {form.title}
        </p>
        {form.description && (
          <p className="text-[11.5px] text-white/30 mt-1 line-clamp-2 leading-snug">{form.description}</p>
        )}
      </div>
    </button>
  )
}
