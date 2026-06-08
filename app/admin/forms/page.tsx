export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Plus, ExternalLink, Sparkles, ArrowRight } from 'lucide-react'
import FormsListClient from './FormsListClient'
import DuplicateButton from './DuplicateButton'
import QRModal from './QRModal'
import EmbedModal from './EmbedModal'
import DeleteFormButton from './DeleteFormButton'

const PAGE_LIMIT = 10

interface SearchParams { category?: string }

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

  return { forms: forms || [], countByForm, categories: categories || [] }
}

export default async function FormsListPage({ searchParams }: { searchParams: SearchParams }) {
  const { forms, countByForm, categories } = await getData()

  const activeCategory = searchParams.category || 'all'
  const allFiltered: FormShape[] = activeCategory === 'all'
    ? forms
    : forms.filter((f: FormShape) => f.categories?.name === activeCategory)

  const filtered = allFiltered.slice(0, PAGE_LIMIT)
  const hasMore = allFiltered.length > PAGE_LIMIT

  const countByCategory: Record<string, number> = {}
  forms.forEach((f: FormShape) => {
    const name = f.categories?.name || 'Uncategorized'
    countByCategory[name] = (countByCategory[name] || 0) + 1
  })

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Manage</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Forms</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {allFiltered.length} {allFiltered.length === 1 ? 'form' : 'forms'}
              {activeCategory !== 'all' && ` in ${activeCategory}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/forms/ai"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-card-sm">
              <Sparkles size={15} />Build with AI
            </Link>
            <Link href="/admin/forms/new"
              className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-card-sm">
              <Plus size={15} />New Form
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <CategoryTab label="All" count={forms.length} href="/admin/forms" active={activeCategory === 'all'} />
          {categories.map((cat: { id: string; name: string }) => (
            <CategoryTab key={cat.id} label={cat.name} count={countByCategory[cat.name] || 0}
              href={`/admin/forms?category=${encodeURIComponent(cat.name)}`}
              active={activeCategory === cat.name} />
          ))}
        </div>
      </div>

      <div className="p-8">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Plus size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400 mb-1">No forms in this category</p>
            <Link href="/admin/forms/new"
              className="inline-flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors mt-3">
              <Plus size={14} />Create Form
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-6 py-3 border-b border-gray-50 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Form</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-24 text-right">Submissions</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-28 text-right hidden sm:block">Created</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[220px] text-right">Actions</span>
            </div>

            {/* Rows */}
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {filtered.map((form) => (
                <li key={form.id}
                  className="group grid grid-cols-[1fr_auto_auto_auto] items-center px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors">

                  {/* Form name + meta */}
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${form.is_active ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                          {form.title}
                        </span>
                        {activeCategory === 'all' && form.categories?.name && (
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

                  {/* Submissions */}
                  <div className="w-24 text-right">
                    <Link href={`/admin/submissions?form_id=${form.id}`}
                      className="text-[18px] font-bold text-gray-800 dark:text-white hover:text-[#089447] transition-colors tabular-nums">
                      {countByForm[form.id] || 0}
                    </Link>
                  </div>

                  {/* Created */}
                  <div className="w-28 text-right hidden sm:block">
                    <span className="text-[12px] text-gray-400">
                      {new Date(form.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="w-[220px] flex items-center justify-end gap-0.5">
                    <FormsListClient formId={form.id} isActive={form.is_active} />
                    <div className="w-px h-4 bg-gray-100 dark:bg-gray-800 mx-1" />
                    <QRModal formTitle={form.title} formSlug={form.slug} />
                    <EmbedModal formTitle={form.title} formSlug={form.slug} />
                    <DuplicateButton formId={form.id} />
                    <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                      title="Preview form">
                      <ExternalLink size={13} />
                    </a>
                    <Link href={`/admin/forms/${form.id}/edit`}
                      className="text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] px-2.5 py-1.5 rounded-lg hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 transition-all">
                      Edit
                    </Link>
                    <DeleteFormButton formId={form.id} formTitle={form.title} submissionCount={countByForm[form.id] || 0} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Footer — cap notice or clean count */}
            <div className="px-6 py-3 border-t border-gray-50 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20 flex items-center justify-between">
              <p className="text-[12px] text-gray-400">
                Showing {filtered.length} of {allFiltered.length} {allFiltered.length === 1 ? 'form' : 'forms'}
                {activeCategory !== 'all' && ` in ${activeCategory}`}
              </p>
              {hasMore && (
                <p className="flex items-center gap-1 text-[12px] text-gray-400">
                  Filter by category to browse the rest
                  <ArrowRight size={11} />
                </p>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ─── CategoryTab ──────────────────────────────────────────────────────────────

function CategoryTab({ label, count, href, active }: {
  label: string; count: number; href: string; active: boolean
}) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
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
