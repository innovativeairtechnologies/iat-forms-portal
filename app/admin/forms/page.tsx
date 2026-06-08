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

// Span logic: 4-col grid, rows of 3 forms alternate [wide, norm, norm] ↔ [norm, norm, wide]
function spanClass(i: number) {
  const g = Math.floor(i / 3)
  const p = i % 3
  if (g % 2 === 0 && p === 0) return 'lg:col-span-2'
  if (g % 2 === 1 && p === 2) return 'lg:col-span-2'
  return 'lg:col-span-1'
}
function isFeatured(i: number) {
  return spanClass(i) === 'lg:col-span-2'
}

export default async function FormsListPage({ searchParams }: { searchParams: SearchParams }) {
  const { forms, countByForm, categories } = await getData()

  const activeCategory = searchParams.category || 'all'
  const filtered = activeCategory === 'all'
    ? forms
    : forms.filter((f: { categories: { name: string } | null }) => f.categories?.name === activeCategory)

  const countByCategory: Record<string, number> = {}
  forms.forEach((f: { categories: { name: string } | null }) => {
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

        {/* Category tabs */}
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
            {filtered.map((form: {
              id: string; title: string; slug: string; is_active: boolean;
              created_at: string; description: string | null;
              categories: { id: string; name: string } | null
            }, i: number) => (
              <div key={form.id} className={spanClass(i)}>
                <FormCard
                  form={form}
                  count={countByForm[form.id] || 0}
                  showCategory={activeCategory === 'all'}
                  featured={isFeatured(i)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

type FormShape = {
  id: string; title: string; slug: string; is_active: boolean;
  description: string | null; categories: { id: string; name: string } | null
}

function FormCard({ form, count, showCategory, featured }: {
  form: FormShape; count: number; showCategory: boolean; featured: boolean
}) {
  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card hover:shadow-card-hover hover:border-gray-200 dark:hover:border-gray-700 transition-all overflow-hidden flex flex-col h-full">

      {/* ── Visual area ── */}
      <div className={`relative h-[152px] overflow-hidden flex-shrink-0 ${
        featured
          ? 'bg-gradient-to-br from-[#089447] to-[#054e27]'
          : 'bg-[#f8f9fa] dark:bg-gray-800'
      }`}>

        {/* Featured: decorative glows + dot grid */}
        {featured && (
          <>
            <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-30 bg-emerald-200" />
            <div className="pointer-events-none absolute -bottom-6 left-4 w-28 h-28 rounded-full blur-2xl opacity-20 bg-emerald-400" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08]"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '14px 14px' }}
            />
          </>
        )}

        {/* Form field illustration */}
        <div className="absolute left-5 right-[86px] top-5 space-y-[7px]">
          {([65, 88, 52] as number[]).map((w, i) => (
            <div key={i} className={`h-[22px] rounded-lg flex items-center px-2.5 ${
              featured ? 'bg-white/[0.18]' : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600'
            }`}>
              <div className={`h-[5px] rounded-full ${featured ? 'bg-white/50' : 'bg-gray-200 dark:bg-gray-600'}`} style={{ width: `${w}%` }} />
            </div>
          ))}
          <div className={`h-[22px] rounded-lg flex items-center justify-center mt-1 ${
            featured ? 'bg-white/30' : 'bg-[#089447]'
          }`}>
            <div className={`h-[5px] w-10 rounded-full ${featured ? 'bg-white/70' : 'bg-white/60'}`} />
          </div>
        </div>

        {/* Submission count badge */}
        <div className={`absolute top-4 right-4 rounded-2xl text-center px-3 py-2 min-w-[56px] ${
          featured
            ? 'bg-white/[0.18] backdrop-blur-sm'
            : 'bg-white dark:bg-gray-900 shadow-card border border-gray-100 dark:border-gray-700'
        }`}>
          <p className={`text-[22px] font-bold leading-none tabular-nums ${featured ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
            {count}
          </p>
          <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${featured ? 'text-white/70' : 'text-gray-400'}`}>
            {count === 1 ? 'response' : 'responses'}
          </p>
        </div>

        {/* Inactive pill */}
        {!form.is_active && (
          <div className="absolute bottom-3 left-4 text-[10px] font-semibold bg-black/20 text-white px-2 py-0.5 rounded-full">
            Inactive
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex flex-col flex-1 p-5">
        {/* Category + status dot */}
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
