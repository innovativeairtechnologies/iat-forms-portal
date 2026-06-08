export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Plus, ExternalLink, Sparkles } from 'lucide-react'
import FormsListClient from './FormsListClient'
import DuplicateButton from './DuplicateButton'
import QRModal from './QRModal'
import EmbedModal from './EmbedModal'
import DeleteFormButton from './DeleteFormButton'

interface SearchParams { category?: string }

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

type FormShape = {
  id: string; title: string; slug: string; is_active: boolean;
  description: string | null; categories: { id: string; name: string } | null
}


export default async function FormsListPage({ searchParams }: { searchParams: SearchParams }) {
  const { forms, countByForm, categories } = await getData()

  const activeCategory = searchParams.category || 'all'
  const filtered: FormShape[] = activeCategory === 'all'
    ? forms
    : forms.filter((f: FormShape) => f.categories?.name === activeCategory)

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
              {filtered.length} {filtered.length === 1 ? 'form' : 'forms'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((form: FormShape) => (
              <FormCard
                key={form.id}
                form={form}
                count={countByForm[form.id] || 0}
                showCategory={activeCategory === 'all'}
              />
            ))}
          </div>

        )}
      </div>
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

function FormCard({ form, count, showCategory }: {
  form: FormShape; count: number; showCategory: boolean
}) {
  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card hover:shadow-card-hover hover:border-gray-200 dark:hover:border-gray-700 transition-all overflow-hidden flex flex-col h-full">

      {/* ── Visual area ── */}
      <div className="relative h-[118px] overflow-hidden flex-shrink-0 bg-[#f8f9fa] dark:bg-gray-800">

        {/* Form field mock */}
        <div className="absolute left-5 right-[80px] top-5 space-y-[6px]">
          {([62, 84, 48] as number[]).map((w, i) => (
            <div key={i} className="h-5 rounded-md flex items-center px-2 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
              <div className="h-[4px] rounded-full bg-gray-200 dark:bg-gray-600" style={{ width: `${w}%` }} />
            </div>
          ))}
          <div className="h-5 rounded-md flex items-center justify-center bg-[#089447]/80">
            <div className="h-[4px] w-8 rounded-full bg-white/60" />
          </div>
        </div>

        {/* Submission count */}
        <div className="absolute top-4 right-4 rounded-xl text-center px-2.5 py-2 min-w-[50px] bg-white dark:bg-gray-900 shadow-card border border-gray-100 dark:border-gray-700">
          <p className="text-[20px] font-bold leading-none tabular-nums text-gray-800 dark:text-white">{count}</p>
          <p className="text-[9px] uppercase tracking-wider mt-0.5 text-gray-400">{count === 1 ? 'response' : 'responses'}</p>
        </div>

        {!form.is_active && (
          <div className="absolute bottom-2.5 left-4 text-[10px] font-semibold bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
            Inactive
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-2.5 min-h-[18px]">
          {showCategory && form.categories?.name && (
            <Link href={`/admin/forms?category=${encodeURIComponent(form.categories.name)}`}
              className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 hover:text-[#089447] px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-700 transition-colors">
              {form.categories.name}
            </Link>
          )}
          <div className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${form.is_active ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
        </div>

        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug">{form.title}</h3>
        {form.description && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-relaxed mt-1.5 line-clamp-2 flex-1">
            {form.description}
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-0.5 mt-auto pt-4 border-t border-gray-50 dark:border-gray-800">
          <FormsListClient formId={form.id} isActive={form.is_active} />
          <div className="flex-1" />
          <QRModal formTitle={form.title} formSlug={form.slug} />
          <EmbedModal formTitle={form.title} formSlug={form.slug} />
          <DuplicateButton formId={form.id} />
          <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            title="Preview form">
            <ExternalLink size={13} />
          </a>
          <Link href={`/admin/forms/${form.id}/edit`}
            className="text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] px-2.5 py-1.5 rounded-lg hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 transition-all">
            Edit
          </Link>
          <DeleteFormButton formId={form.id} formTitle={form.title} submissionCount={count} />
        </div>
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
