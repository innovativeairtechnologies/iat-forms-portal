export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PrintButton from '@/components/PrintButton'
import { SECTION_KEYS, SECTION_LABELS, type CaseStudy, type CaseStudyUnit } from '@/lib/case-studies'

/* Print / save-as-PDF view of a case study — the deliverable sales attaches to
   an email. Lives under /print (outside the admin shell) like the other print
   sheets, so the sidebar/topbar never print. Renders edited_sections (the
   reviewed copy), honors the disclosure setting, and stamps an obvious DRAFT
   banner on anything not yet approved so an unreviewed draft can't pass as
   final by accident. */

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function CaseStudyPrintPage(props: { params: Promise<{ id: string }> }) {
  const viewer = await getAdminSurfaceUser()
  if (!viewer) redirect('/login')
  if (!viewer.can('case_studies')) redirect('/admin')

  const { id } = await props.params
  const { data } = await supabaseAdmin
    .from('case_studies')
    .select('*, customers(company_name), case_study_units(*)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'case_study_units', ascending: true })
    .single()
  if (!data) notFound()

  const study = data as CaseStudy
  const sections = study.edited_sections
  const units = (study.case_study_units ?? []) as CaseStudyUnit[]
  const anon = study.customer_disclosure === 'anonymized'
  const approved = study.status === 'approved'

  const customerLine = anon
    ? [study.industry, study.region].filter(Boolean).join(' · ') || 'Customer withheld by request'
    : study.customers?.company_name ?? ''

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white text-zinc-800">
      {/* Screen-only toolbar */}
      <div className="print:hidden max-w-[820px] mx-auto flex items-center gap-3 px-6 pt-5">
        <Link
          href={`/admin/case-studies/${study.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft size={15} /> Back to editor
        </Link>
        <div className="flex-1" />
        <PrintButton label="Print / Save PDF" />
      </div>

      <article className="max-w-[820px] mx-auto bg-white my-5 print:my-0 px-12 py-14 print:px-0 print:py-0 shadow-sm print:shadow-none rounded-xl print:rounded-none">
        {!approved && (
          <div className="mb-8 px-4 py-2.5 border-2 border-amber-400 bg-amber-50 text-amber-800 text-[13px] font-semibold uppercase tracking-widest text-center">
            Draft — not approved for distribution
          </div>
        )}

        <header className="mb-9 pb-7 border-b-2 border-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
            IAT · Innovative Air Technologies — Case Study
          </p>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold text-zinc-900">
            {sections?.title || study.title || 'Untitled case study'}
          </h1>
          {customerLine && <p className="mt-2 text-[14px] text-zinc-500">{customerLine}</p>}
        </header>

        {sections ? (
          <div className="grid gap-7">
            {SECTION_KEYS.filter((k) => k !== 'title').map((k) => (
              <section key={k}>
                {k !== 'summary' && (
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-2">
                    {SECTION_LABELS[k]}
                  </h2>
                )}
                <p className={`whitespace-pre-wrap leading-relaxed ${k === 'summary' ? 'text-[15.5px] text-zinc-700 font-medium' : 'text-[14px] text-zinc-700'}`}>
                  {sections[k]}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-zinc-500">No draft has been generated yet.</p>
        )}

        {units.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-3">
              Equipment
            </h2>
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-[10.5px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3 font-semibold">Model</th>
                  {!anon && <th className="py-2 pr-3 font-semibold">Serial</th>}
                  <th className="py-2 pr-3 font-semibold">Application</th>
                  <th className="py-2 pr-3 font-semibold">Entering</th>
                  <th className="py-2 pr-3 font-semibold">Target</th>
                  <th className="py-2 font-semibold">Airflow</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-200 align-top">
                    <td className="py-2 pr-3 font-medium text-zinc-800 tabular-nums">{u.model_number}</td>
                    {!anon && <td className="py-2 pr-3 tabular-nums">{u.serial_number ?? '—'}</td>}
                    <td className="py-2 pr-3">{u.application}</td>
                    <td className="py-2 pr-3">{u.entering_conditions}</td>
                    <td className="py-2 pr-3">{u.target_conditions}</td>
                    <td className="py-2 tabular-nums">{u.airflow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-12 pt-5 border-t border-zinc-300 flex items-baseline justify-between text-[11.5px] text-zinc-500">
          <span>Innovative Air Technologies · dehumidifiers.com</span>
          <span>
            {approved && study.approved_at ? `Approved ${fmtDate(study.approved_at)}` : fmtDate(study.updated_at)}
          </span>
        </footer>
      </article>
    </div>
  )
}
