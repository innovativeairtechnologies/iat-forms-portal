'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import type { Category, Form } from '@/lib/supabase'
import StepFormModal from '@/components/StepFormModal'

type FormWithCat = Form & { categories: Category | null }

export type FormDraftItem = {
  id: string; form_id: string; slug: string; title: string
  label: string | null; data: Record<string, unknown>; current_step: number; updated_at: string
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`
  const d = Math.floor(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/**
 * "Employee Forms" view — the JotForms library brought into the portal.
 * Shared by the employee portal (/employee/resources) and the admin portal
 * (/admin/employee-forms): category tabs + grouped category cards with list
 * rows. Rows open the form in a fill modal; no admin/management controls
 * (those live on the /admin/forms builder).
 */
export default function EmployeeFormsView({ categories, forms, drafts = [], eyebrow = 'Resources' }: {
  categories: Category[]
  forms: FormWithCat[]
  drafts?: FormDraftItem[]
  eyebrow?: string
}) {
  const router = useRouter()
  const [activeCategory, setActive] = useState('all')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [resume, setResume] = useState<FormDraftItem | null>(null)

  const openFresh = (slug: string) => { setResume(null); setOpenSlug(slug) }
  const openResume = (d: FormDraftItem) => { setResume(d); setOpenSlug(d.slug) }
  const closeModal = () => { setOpenSlug(null); setResume(null); router.refresh() }
  const discardDraft = async (id: string) => {
    await fetch(`/api/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    router.refresh()
  }

  const countByCategory: Record<string, number> = {}
  forms.forEach(f => { const n = f.categories?.name || 'Uncategorized'; countByCategory[n] = (countByCategory[n] || 0) + 1 })

  const filtered = activeCategory === 'all' ? forms : forms.filter(f => f.categories?.name === activeCategory)

  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return null
    const out: { id: string; name: string; forms: FormWithCat[] }[] = []
    for (const cat of categories) {
      const cf = forms.filter(f => f.categories?.id === cat.id)
      if (cf.length) out.push({ id: cat.id, name: cat.name, forms: cf })
    }
    const unc = forms.filter(f => !f.categories)
    if (unc.length) out.push({ id: '__none__', name: 'Uncategorized', forms: unc })
    return out
  }, [categories, forms, activeCategory])

  return (
    <div className="flex-1 overflow-auto">

      {/* Header + category tabs (same structure as /admin/forms) */}
      <div className="px-8 pt-8 pb-0 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mb-5">
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{eyebrow}</p>
          <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Employee Forms</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'form' : 'forms'}{activeCategory !== 'all' && ` in ${activeCategory}`}
          </p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <Tab label="All" count={forms.length} active={activeCategory === 'all'} onClick={() => setActive('all')} />
          {categories.map(c => (
            <Tab key={c.id} label={c.name} count={countByCategory[c.name] || 0} active={activeCategory === c.name} onClick={() => setActive(c.name)} />
          ))}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {drafts.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 shadow-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-amber-100/70 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20">
              <RotateCcw size={14} className="text-amber-500" />
              <span className="text-[13px] font-bold text-amber-800 dark:text-amber-300">Continue where you left off</span>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">{drafts.length}</span>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
              {drafts.map(d => (
                <li key={d.id} className="group grid grid-cols-[1fr_auto] items-center gap-3 px-6 py-3.5 hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors">
                  <button onClick={() => openResume(d)} className="min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">{d.title}</span>
                      {d.label && (
                        <span className="flex-shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/40">
                          {d.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400 mt-0.5">Saved {ago(d.updated_at)}</p>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => openResume(d)} className="flex items-center gap-1 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:underline">
                      Resume <ChevronRight size={14} />
                    </button>
                    <button onClick={() => discardDraft(d.id)} title="Discard draft" className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">No forms found</p>
          </div>
        ) : activeCategory === 'all' && grouped ? (
          grouped.map(({ id, name, forms: cf }) => (
            <div key={id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                <FolderOpen size={14} className="text-gray-400 dark:text-gray-500" />
                <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{name}</span>
                <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{cf.length}</span>
              </div>
              <FormRows forms={cf} onOpen={openFresh} />
            </div>
          ))
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
            <FormRows forms={filtered} onOpen={openFresh} showCategory />
          </div>
        )}
      </div>

      <AnimatePresence>
        {openSlug && (
          <StepFormModal
            key={resume ? `resume-${resume.id}` : `new-${openSlug}`}
            slug={openSlug}
            serverDrafts
            resumeDraft={resume ? { id: resume.id, data: resume.data, currentStep: resume.current_step, updatedAt: resume.updated_at } : undefined}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function FormRows({ forms, onOpen, showCategory = false }: {
  forms: FormWithCat[]; onOpen: (slug: string) => void; showCategory?: boolean
}) {
  return (
    <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
      {forms.map(form => (
        <li key={form.id}>
          <button
            onClick={() => onOpen(form.slug)}
            className="group w-full text-left grid grid-cols-[1fr_auto] items-center px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30 transition-colors"
          >
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-[#089447] transition-colors">{form.title}</span>
                {showCategory && form.categories?.name && (
                  <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-gray-100 dark:border-zinc-700">
                    {form.categories.name}
                  </span>
                )}
              </div>
              {form.description && <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">{form.description}</p>}
            </div>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-[#089447] opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ChevronRight size={14} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Tab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
        active
          ? 'border-[#089447] text-[#089447]'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:border-gray-300 dark:hover:border-zinc-600'
      }`}>
      {label}
      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
      }`}>
        {count}
      </span>
    </button>
  )
}
