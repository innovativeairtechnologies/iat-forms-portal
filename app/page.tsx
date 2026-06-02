import { supabase } from '@/lib/supabase'
import type { Category, Form } from '@/lib/supabase'
import Link from 'next/link'
import { Clock, ClipboardCheck, UserPlus, Send, Wrench, ChevronRight, FileText } from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  'clipboard-check': ClipboardCheck,
  'user-plus': UserPlus,
  send: Send,
  tool: Wrench,
}

async function getData() {
  const [{ data: categories }, { data: forms }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('forms').select('*, categories(*)').eq('is_active', true).order('title'),
  ])
  return {
    categories: (categories || []) as Category[],
    forms: (forms || []) as (Form & { categories: Category })[],
  }
}

export const revalidate = 60

export default async function HomePage() {
  const { categories, forms } = await getData()

  const formsByCategory: Record<string, typeof forms> = {}
  const uncategorized: typeof forms = []

  forms.forEach((form) => {
    if (form.category_id) {
      if (!formsByCategory[form.category_id]) formsByCategory[form.category_id] = []
      formsByCategory[form.category_id].push(form)
    } else {
      uncategorized.push(form)
    }
  })

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-widest font-medium mb-1">
              Industrial Air Technology
            </p>
            <h1 className="text-xl font-bold tracking-tight">Forms Portal</h1>
          </div>
          <Link
            href="/admin"
            className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
          >
            Admin
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <h2 className="text-3xl font-bold text-[#1a1a2e] mb-2">Submit a Request</h2>
          <p className="text-gray-500 text-base">
            Select a form below to get started. All submissions are reviewed by the appropriate team.
          </p>
        </div>
      </div>

      {/* Forms Grid */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {categories.map((cat) => {
          const catForms = formsByCategory[cat.id] || []
          if (!catForms.length) return null
          const Icon = ICON_MAP[cat.icon || ''] || FileText

          return (
            <section key={cat.id}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a2e] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-semibold text-[#1a1a2e]">{cat.name}</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catForms.map((form) => (
                  <FormCard key={form.id} form={form} />
                ))}
              </div>
            </section>
          )
        })}

        {uncategorized.length > 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-[#1a1a2e]">Other Forms</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uncategorized.map((form) => (
                <FormCard key={form.id} form={form} />
              ))}
            </div>
          </section>
        )}

        {forms.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No forms available yet.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function FormCard({ form }: { form: Form }) {
  return (
    <Link
      href={`/forms/${form.slug}`}
      className="group block bg-white border border-gray-200 rounded-[8px] p-5 hover:border-[#0a7cff] hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#1a1a2e] text-sm leading-snug mb-1.5 group-hover:text-[#0a7cff] transition-colors">
            {form.title}
          </h4>
          {form.description && (
            <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{form.description}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className="text-gray-300 group-hover:text-[#0a7cff] flex-shrink-0 mt-0.5 transition-colors"
        />
      </div>
    </Link>
  )
}
