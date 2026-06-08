export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Plus, ExternalLink, Sparkles, Inbox, FolderOpen } from 'lucide-react'
import FormsListClient from './FormsListClient'
import DuplicateButton from './DuplicateButton'
import QRModal from './QRModal'
import EmbedModal from './EmbedModal'
import DeleteFormButton from './DeleteFormButton'

interface SearchParams { category?: string; status?: string }

type FormShape = {
  id: string; title: string; slug: string; is_active: boolean;
  created_at: string; description: string | null;
  categories: { id: string; name: string } | null
}

async function getData() {
  const [{ data: forms }, { data: submissions }, { data: categories }] = await Promise.all([
    supabaseAdmin.from('forms').select('*, categories(id, name)').order('title', { ascending: true }),
    supabaseAdmin.from('submissions').select('form_id'),
    supabaseAdmin.from('categories').select('id, name').order('sort_order'),
  ])

  const countByForm: Record<string, number> = {}
  ;(submissions || []).forEach((s: { form_id: string }) => {
    countByForm[s.form_id] = (countByForm[s.form_id] || 0) + 1
  })

  return { forms: (forms || []) as FormShape[], countByForm, categories: categories || [] }
}

export default async function FormsListPage({ searchParams }: { searchParams: SearchParams }) {
  const { forms, countByForm, categories } = await getData()

  const activeCategory = searchParams.category || 'all'
  const activeStatus   = searchParams.status   || 'all'

  // Apply status filter
  const statusFiltered: FormShape[] = activeStatus === 'active'
    ? forms.filter((f) => f.is_active)
    : activeStatus === 'inactive'
    ? forms.filter((f) => !f.is_active)
    : forms

  // Apply category filter
  const categoryFiltered: FormShape[] = activeCategory === 'all'
    ? statusFiltered
    : statusFiltered.filter((f) => f.categories?.name === activeCategory)

  // Build grouped data for "all" view
  const grouped: { name: string; id: string; forms: FormShape[]; activeCount: number; inactiveCount: number }[] = []
  if (activeCategory === 'all') {
    const seen = new Set<string>()
    for (const cat of categories) {
      const catForms = categoryFiltered.filter((f) => f.categories?.id === cat.id)
      if (catForms.length > 0) {
        seen.add(cat.id)
        grouped.push({
          name: cat.name, id: cat.id, forms: catForms,
          activeCount: forms.filter((f) => f.categories?.id === cat.id && f.is_active).length,
          inactiveCount: forms.filter((f) => f.categories?.id === cat.id && !f.is_active).length,
        })
      }
    }
    // Uncategorized
    const uncategorized = categoryFiltered.filter((f) => !f.categories)
    if (uncategorized.length > 0) {
      grouped.push({
        name: 'Uncategorized', id: '__none__', forms: uncategorized,
        activeCount: forms.filter((f) => !f.categories && f.is_active).length,
        inactiveCount: forms.filter((f) => !f.categories && !f.is_active).length,
      })
    }
  }

  const countByCategory: Record<string, number> = {}
  forms.forEach((f: FormShape) => {
    const name = f.categories?.name || 'Uncategorized'
    countByCategory[name] = (countByCategory[name] || 0) + 1
  })

  function statusHref(s: string) {
    const params = new URLSearchParams()
    if (activeCategory !== 'all') params.set('category', activeCategory)
    if (s !== 'all') params.set('status', s)
    const q = params.toString()
    return `/admin/forms${q ? `?${q}` : ''}`
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Manage</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Forms</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {categoryFiltered.length} {categoryFiltered.length === 1 ? 'form' : 'forms'}
              {activeCategory !== 'all' && ` in ${activeCategory}`}
              {activeStatus !== 'all' && ` · ${activeStatus}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/forms/ai"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-card-sm">
              <Sparkles size={15} />Build with AI
            </Link>
            <Link href="/admin/forms/new"
              className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-card-sm">
              <Plus size={15} />+ New Form
            </Link>
          </div>
        </div>

        {/* Category tabs + status filter pills */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <CategoryTab label="All" count={forms.length} href="/admin/forms" active={activeCategory === 'all'} activeStatus={activeStatus} />
            {categories.map((cat: { id: string; name: string }) => (
              <CategoryTab key={cat.id} label={cat.name} count={countByCategory[cat.name] || 0}
                href={`/admin/forms?category=${encodeURIComponent(cat.name)}`}
                active={activeCategory === cat.name} activeStatus={activeStatus} />
            ))}
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1 pb-1 flex-shrink-0">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <Link key={s} href={statusHref(s)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full capitalize transition-all ${
                  activeStatus === s
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {categoryFiltered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Plus size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mb-1">No forms found</p>
            <Link href="/admin/forms/new"
              className="inline-flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors mt-3">
              <Plus size={14} />Create Form
            </Link>
          </div>
        ) : activeCategory === 'all' ? (
          /* Grouped by category view */
          grouped.map(({ name, id, forms: catForms, activeCount, inactiveCount }) => (
            <div key={id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-50 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                <div className="flex items-center gap-2.5">
                  <FolderOpen size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{name}</span>
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{catForms.length}</span>
                </div>
                {/* Per-category active/inactive pills */}
                <div className="flex items-center gap-1">
                  <Link href={`/admin/forms?category=${encodeURIComponent(name)}&status=active`}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 px-2 py-1 rounded-lg transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {activeCount} active
                  </Link>
                  {inactiveCount > 0 && (
                    <Link href={`/admin/forms?category=${encodeURIComponent(name)}&status=inactive`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                      {inactiveCount} inactive
                    </Link>
                  )}
                </div>
              </div>
              <FormsList forms={catForms} countByForm={countByForm} showCategory={false} />
            </div>
          ))
        ) : (
          /* Flat category view */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
            <FormsList forms={categoryFiltered} countByForm={countByForm} showCategory={false} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FormsList ────────────────────────────────────────────────────────────────

function FormsList({ forms, countByForm, showCategory }: {
  forms: FormShape[]
  countByForm: Record<string, number>
  showCategory: boolean
}) {
  return (
    <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
      {forms.map((form) => (
        <li key={form.id}
          className="group grid grid-cols-[1fr_80px_100px_160px] items-center px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors">

          {/* Form name + meta */}
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                  {form.title}
                </span>
                {showCategory && form.categories?.name && (
                  <Link
                    href={`/admin/forms?category=${encodeURIComponent(form.categories.name)}`}
                    className="flex-shrink-0 text-[10px] font-semibold text-gray-400 bg-gray-50 dark:bg-gray-800 hover:text-[#089447] hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-700 transition-colors">
                    {form.categories.name}
                  </Link>
                )}
              </div>
              <p className="text-[12px] text-gray-400 font-mono mt-0.5">/forms/{form.slug}</p>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-center">
            <FormsListClient formId={form.id} isActive={form.is_active} />
          </div>

          {/* Created */}
          <div className="text-right hidden sm:block">
            <span className="text-[12px] text-gray-400">
              {new Date(form.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-0.5">
            <QRModal formTitle={form.title} formSlug={form.slug} />
            <EmbedModal formTitle={form.title} formSlug={form.slug} />
            <DuplicateButton formId={form.id} />
            <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="Preview form">
              <ExternalLink size={13} />
            </a>
            <Link href={`/admin/submissions?form_id=${form.id}`}
              className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title="View submissions">
              <Inbox size={13} />
            </Link>
            <Link href={`/admin/forms/${form.id}/edit`}
              className="text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] px-2 py-1.5 rounded-lg hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 transition-all">
              Edit
            </Link>
            <DeleteFormButton formId={form.id} formTitle={form.title} submissionCount={countByForm[form.id] || 0} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── CategoryTab ──────────────────────────────────────────────────────────────

function CategoryTab({ label, count, href, active, activeStatus }: {
  label: string; count: number; href: string; active: boolean; activeStatus: string
}) {
  // Preserve status filter when switching categories
  const url = activeStatus !== 'all' ? `${href}${href.includes('?') ? '&' : '?'}status=${activeStatus}` : href
  return (
    <Link href={url} className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
      active
        ? 'border-[#089447] text-[#089447]'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
    }`}>
      {label}
      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      }`}>
        {count}
      </span>
    </Link>
  )
}
