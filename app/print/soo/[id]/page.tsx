export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PrintButton from '@/components/PrintButton'
import { applyOverrides, type AssemblyResult, type RenderedClause, type SooDocument, type UnitFacts } from '@/lib/soo'

/* Print / save-as-PDF view of a Sequence of Operation — the deliverable that
   goes to the controls contractor. Lives under /print (outside the admin shell)
   like the other print sheets, so the sidebar and topbar never print.
   Renders the assembled document with human overrides applied, and stamps an
   obvious DRAFT banner on anything not yet approved so an unreviewed sequence
   cannot pass as final by accident.

   The "not applicable" list prints too, deliberately. A controls contractor
   reading this needs to be able to tell a clause that does not apply to this
   unit from one nobody ever wrote — that is the difference between a sequence
   they can commission against and one they have to ring up about. */

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function Clauses({ clauses }: { clauses: RenderedClause[] }) {
  return (
    <>
      {clauses.map((c) => (
        <div key={c.key} style={{ marginLeft: c.depth * 20 }}>
          {c.heading && <p className="font-semibold text-[13px] mt-4 mb-1.5 break-after-avoid">{c.heading}</p>}
          {c.text.trim() && (
            <p className="text-[12.5px] leading-relaxed mb-1.5">
              {c.depth > 0 && <span className="text-zinc-400">• </span>}
              {c.text}
            </p>
          )}
          {c.children.length > 0 && <Clauses clauses={c.children} />}
        </div>
      ))}
    </>
  )
}

export default async function SooPrintPage(props: { params: Promise<{ id: string }> }) {
  const viewer = await getAdminSurfaceUser()
  if (!viewer) redirect('/login')
  if (!viewer.can('soo')) redirect('/admin')

  const { id } = await props.params
  const { data } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (!data) notFound()

  const doc = data as SooDocument
  if (!doc.assembled) notFound()

  const result = applyOverrides(doc.assembled as AssemblyResult, doc.overrides)
  const facts = (doc.facts ?? {}) as UnitFacts
  const approved = doc.status === 'approved'

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white text-zinc-800">
      {/* Screen-only toolbar */}
      <div className="print:hidden max-w-[820px] mx-auto flex items-center gap-3 px-6 pt-5">
        <Link
          href={`/admin/soo/${doc.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft size={15} /> Back to editor
        </Link>
        <div className="flex-1" />
        <PrintButton label="Print / Save PDF" />
      </div>

      <div className="max-w-[820px] mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 px-10 py-10 print:px-0 print:py-0">
        {!approved && (
          <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-2.5 rounded">
            <p className="text-[12px] font-semibold text-amber-800">
              DRAFT — not approved for construction or controls programming
            </p>
          </div>
        )}

        {/* The loudest thing on the page when it applies, and it prints.
            This warning was computed correctly from day one but was only shown
            in the editor, so a gas unit produced a PDF with no reactivation
            sequence that read as complete — the exact failure the whole design
            exists to prevent, leaking at the last step. It belongs ABOVE the
            sequence: someone who reads no further must still see it. */}
        {result.uncovered.length > 0 && (
          <div className="mb-6 border-2 border-rose-400 bg-rose-50 px-4 py-3.5 rounded">
            <p className="text-[12.5px] font-semibold text-rose-800 mb-1.5">
              INCOMPLETE — this sequence is missing {result.uncovered.length === 1 ? 'a section' : 'sections'}
            </p>
            <ul className="space-y-1">
              {result.uncovered.map((u) => (
                <li key={u.fact} className="text-[11.5px] text-rose-700">
                  {u.why} — this unit is <strong className="font-semibold">{u.value}</strong>.
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-rose-700 mt-2">
              Do not issue this document for controls programming. The master sequence has no
              content for the configuration above, so the corresponding clauses are absent
              rather than not applicable.
            </p>
          </div>
        )}

        <header className="mb-7 pb-5 border-b border-zinc-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
            Innovative Air Technologies
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight mb-3">Sequence of Operation</h1>
          <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1 text-[12.5px]">
            {facts.customer && (<><dt className="text-zinc-500">Customer</dt><dd>{facts.customer}</dd></>)}
            {facts.project_name && (<><dt className="text-zinc-500">Project</dt><dd>{facts.project_name}</dd></>)}
            {facts.model_number && (<><dt className="text-zinc-500">Model</dt><dd>{facts.model_number}</dd></>)}
            {facts.unit_tag && (<><dt className="text-zinc-500">Unit tag</dt><dd>{facts.unit_tag}</dd></>)}
            {facts.voltage && (<><dt className="text-zinc-500">Voltage</dt><dd>{facts.voltage}</dd></>)}
            {approved && doc.approved_at && (<><dt className="text-zinc-500">Approved</dt><dd>{fmtDate(doc.approved_at)}</dd></>)}
          </dl>
        </header>

        {result.sections.map((s) => (
          <section key={s.key} className="mb-7">
            <h2 className="text-[15px] font-semibold mb-3 break-after-avoid">{s.title}</h2>
            <Clauses clauses={s.clauses} />
          </section>
        ))}

        {result.excluded.length > 0 && (
          <section className="mt-9 pt-5 border-t border-zinc-200 break-before-auto">
            <h2 className="text-[13px] font-semibold mb-1">Not applicable to this unit</h2>
            <p className="text-[11.5px] text-zinc-500 mb-3">
              The following clauses of the master sequence were excluded because this unit is not
              configured for them. Listed so nothing is silently absent.
            </p>
            <ul className="space-y-0.5">
              {result.excluded.map((e) => (
                <li key={e.key} className="text-[11.5px] text-zinc-600">
                  <span className="text-zinc-800">{e.summary}</span> — {e.why}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-9 pt-4 border-t border-zinc-200 text-[10.5px] text-zinc-400 flex gap-4 flex-wrap">
          <span>Document {doc.id.slice(0, 8)}</span>
          <span>Master library v{doc.library_version ?? '—'}</span>
          {doc.assembled_at && <span>Assembled {fmtDate(doc.assembled_at)}</span>}
          <span>info@dehumidifiers.com · 770-788-6744 · dehumidifiers.com</span>
        </footer>
      </div>
    </div>
  )
}
