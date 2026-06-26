import { notFound } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DetailShell, DetailTopBar } from '@/components/admin/detail-ui'

export const dynamic = 'force-dynamic'

// The performance-review rating scale. The tally counts how many of each an
// employee received across all rating questions in all of their reviews.
const RATINGS = ['Superstar', 'Rockstar', 'Star', 'Performer'] as const
type Rating = (typeof RATINGS)[number]
const RATING_SET = new Set<string>(RATINGS)

// The field whose value names the person being reviewed.
const EMPLOYEE_FIELD = 'Employee Name'

type Tally = { employee: string; counts: Record<Rating, number>; reviews: number }

export default async function FormTallyPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const { data: form } = await supabaseAdmin.from('forms').select('id, title').eq('id', id).single()
  if (!form) notFound()

  const [{ data: fieldsData }, { data: subsData }] = await Promise.all([
    supabaseAdmin.from('form_fields').select('label, field_type').eq('form_id', id),
    supabaseAdmin.from('submissions').select('data').eq('form_id', id).order('submitted_at', { ascending: false }),
  ])

  // Only count answers to rating questions (radio fields) — so a stray word in a
  // free-text box can never be mistaken for a rating.
  const ratingFieldLabels = new Set(
    (fieldsData || []).filter((f) => f.field_type === 'radio').map((f) => f.label),
  )

  const byEmployee = new Map<string, Tally>()
  let totalReviews = 0

  for (const sub of subsData || []) {
    const data = (sub.data || {}) as Record<string, unknown>
    const empRaw = data[EMPLOYEE_FIELD]
    const employee = typeof empRaw === 'string' && empRaw.trim() ? empRaw.trim() : '(no name)'

    let tally = byEmployee.get(employee)
    if (!tally) {
      tally = { employee, counts: { Superstar: 0, Rockstar: 0, Star: 0, Performer: 0 }, reviews: 0 }
      byEmployee.set(employee, tally)
    }
    tally.reviews++
    totalReviews++

    for (const [label, v] of Object.entries(data)) {
      if (ratingFieldLabels.has(label) && typeof v === 'string' && RATING_SET.has(v)) {
        tally.counts[v as Rating]++
      }
    }
  }

  const rows = [...byEmployee.values()].sort((a, b) => a.employee.localeCompare(b.employee))
  const grand: Record<Rating, number> = { Superstar: 0, Rockstar: 0, Star: 0, Performer: 0 }
  for (const r of rows) for (const k of RATINGS) grand[k] += r.counts[k]

  return (
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'Forms', href: '/admin/forms' },
          { label: form.title || 'Form', href: `/admin/forms/${id}/edit` },
          { label: 'Ratings tally' },
        ]}
      />
      <div className="mx-auto max-w-[1000px] p-5 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <BarChart3 size={20} className="text-zinc-500 dark:text-zinc-300" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">Ratings tally</h1>
            <p className="truncate text-[13px] text-zinc-400">
              {rows.length} employee{rows.length === 1 ? '' : 's'} · {totalReviews} review{totalReviews === 1 ? '' : 's'} · {form.title}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center text-[13px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
            No submissions with ratings yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3 text-left">Employee</th>
                  {RATINGS.map((r) => (
                    <th key={r} className="px-3 py-3 text-center">{r}</th>
                  ))}
                  <th className="px-4 py-3 text-center">Reviews</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-100">{r.employee}</td>
                    {RATINGS.map((k) => (
                      <td key={k} className="px-3 py-3 text-center tabular-nums text-zinc-700 dark:text-zinc-300">
                        {r.counts[k] || <span className="text-zinc-300 dark:text-zinc-600">·</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center tabular-nums text-zinc-400">{r.reviews}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50/60 font-semibold dark:border-zinc-700 dark:bg-zinc-800/40">
                  <td className="px-5 py-3 text-zinc-700 dark:text-zinc-200">All employees</td>
                  {RATINGS.map((k) => (
                    <td key={k} className="px-3 py-3 text-center tabular-nums text-zinc-800 dark:text-zinc-100">{grand[k]}</td>
                  ))}
                  <td className="px-4 py-3 text-center tabular-nums text-zinc-500">{totalReviews}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11.5px] text-zinc-400">
          Counts every Superstar / Rockstar / Star / Performer selected across all rating questions in each
          employee&apos;s reviews, grouped by the &ldquo;Employee Name&rdquo; field.
        </p>
      </div>
    </DetailShell>
  )
}
