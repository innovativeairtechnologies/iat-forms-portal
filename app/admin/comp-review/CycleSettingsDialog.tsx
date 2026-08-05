'use client'

/* Cycle settings — the four constants the workbook hardcoded, plus finalize.
   Admin-only, on both sides (the button is hidden for HR, and the PATCH route
   rejects them): every value here is a multiplier on the ENTIRE payroll, so
   changing one silently re-prices everybody at once.

   The constants ship as the workbook had them. Two are known to be contested and
   both are labelled as such rather than quietly corrected — the sheet's own
   column header reads "% of 3.4% Raise" over a 4.1 multiplier, and the /48
   divisor makes an average performer's raise 8.5% rather than the 4.1% the pool
   implies. Jacob reviewed both and chose to keep them; the fields exist so that
   decision can be revisited without a deploy.

   The benchmark links are the ones cited in the workbook's own footer rows, kept
   so the provenance of the raise pool travels with the tool instead of living in
   a spreadsheet nobody opens. */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Loader2, Lock, LockOpen } from 'lucide-react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/Drawer'
import { constantsOf, fmtPct, fmtScore, num, type CompCycle } from '@/lib/comp-review'
import { send } from './CompReviewClient'

const INPUT_CX =
  'w-full h-9 px-2.5 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink outline-none focus:border-brand transition-colors tabular-nums'
const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'

/** The market-rate sources cited in the workbook's rows 45–51, with the figure
 *  each one reported. Their mean is ~3.46 — which is what makes the 4.1 pool
 *  worth a second look. */
const BENCHMARKS: { pct: string; label: string; url: string }[] = [
  { pct: '3.3', label: 'BLS — Employment Cost Index, Atlanta', url: 'https://www.bls.gov/regions/southeast/news-release/employmentcostindex_atlanta.htm' },
  { pct: '3.4', label: 'WTW — 2026 salary budget planning', url: 'https://www.wtwco.com/en-us/news/2026/01/salary-budgets-have-stabilised-as-employers-focus-on-pay-strategy-for-2026' },
  { pct: '3.5', label: 'Atlanta Fed — Wage Growth Tracker', url: 'https://www.atlantafed.org/chcs/wage-growth-tracker' },
  { pct: '3.4', label: 'BLS — Employment Cost Index', url: 'https://www.bls.gov/news.release/pdf/eci.pdf' },
  { pct: '3.6', label: 'WorldatWork — projected pay increases', url: 'https://worldatwork.org/resources/publications/workspan-daily/reports-2024-pay-increases-projected-to-exceed-inflation' },
  { pct: '3.5', label: 'WorldatWork — salary budget report', url: 'https://worldatwork.org/resources/publications/workspan-daily/report-employers-taking-more-conservative-approach-to-salary-budgets' },
]

type Draft = { raise_pool: string; divisor: string; hours_per_week: string; weeks_per_year: string }

export default function CycleSettingsDialog({
  cycle, avg, scoredCount, onClose, onSaved,
}: {
  cycle: CompCycle
  avg: number | null
  scoredCount: number
  onClose: () => void
  onSaved: () => void
}) {
  const c = useMemo(() => constantsOf(cycle), [cycle])
  const [draft, setDraft] = useState<Draft>({
    raise_pool: String(c.raisePool),
    divisor: String(c.divisor),
    hours_per_week: String(c.hoursPerWeek),
    weeks_per_year: String(c.weeksPerYear),
  })
  const [saving, setSaving] = useState(false)
  const [confirmFinal, setConfirmFinal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFinal = cycle.status === 'final'
  const set = <K extends keyof Draft>(k: K, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const dirty =
    String(c.raisePool) !== draft.raise_pool ||
    String(c.divisor) !== draft.divisor ||
    String(c.hoursPerWeek) !== draft.hours_per_week ||
    String(c.weeksPerYear) !== draft.weeks_per_year

  // What an exactly-average performer would receive under the current draft —
  // the single clearest read on what these four numbers actually do.
  const atAverage = useMemo(() => {
    const pool = Number(draft.raise_pool)
    const div = Number(draft.divisor)
    if (!Number.isFinite(pool) || !Number.isFinite(div) || div <= 0) return null
    return pool / div // relScore 1 → adjustment = pool → applied = pool / divisor
  }, [draft.raise_pool, draft.divisor])

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true); setError(null)
    try {
      await send(`/api/admin/comp-review/cycles/${cycle.id}`, 'PATCH', body)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose} dismissable={!dirty && !saving} width={500} labelledBy="cycle-settings-title">
      <DrawerHeader>
        <h2 id="cycle-settings-title" className="text-[15px] font-semibold text-ink">{cycle.year} review settings</h2>
        <p className="text-[12px] text-ink-muted mt-0.5">
          These four values are multipliers on the whole payroll.
        </p>
      </DrawerHeader>

      <DrawerBody>
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-2.5">The raise math</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Raise pool"
              hint="The workbook's 4.1. Its own column header says 3.4%."
            >
              <input className={INPUT_CX} inputMode="decimal" disabled={isFinal}
                value={draft.raise_pool} onChange={(e) => set('raise_pool', e.target.value)} />
            </Field>
            <Field
              label="Divisor"
              hint="The workbook's 48. A percent conversion would be 100."
            >
              <input className={INPUT_CX} inputMode="decimal" disabled={isFinal}
                value={draft.divisor} onChange={(e) => set('divisor', e.target.value)} />
            </Field>
            <Field label="Hours per week" hint="Used to annualize hourly pay.">
              <input className={INPUT_CX} inputMode="decimal" disabled={isFinal}
                value={draft.hours_per_week} onChange={(e) => set('hours_per_week', e.target.value)} />
            </Field>
            <Field label="Weeks per year" hint="The workbook's 52.">
              <input className={INPUT_CX} inputMode="decimal" disabled={isFinal}
                value={draft.weeks_per_year} onChange={(e) => set('weeks_per_year', e.target.value)} />
            </Field>
          </div>

          <p className="mt-3 text-[11.5px] text-ink-muted rounded-lg bg-surface-soft border border-hairline px-2.5 py-2">
            Someone scoring exactly the average currently receives{' '}
            <b className="font-semibold text-ink tabular-nums">{atAverage === null ? '—' : fmtPct(atAverage, 2)}</b>.
            {atAverage !== null && Number(draft.divisor) === 48 && (
              <> That is the pool divided by 48 rather than 100 — the spreadsheet's behaviour, kept deliberately.</>
            )}
          </p>
        </section>

        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-2.5">Market benchmarks</h3>
          <p className="text-[11.5px] text-ink-muted mb-2">
            The sources cited in the original spreadsheet. Mean of these: <b className="font-semibold text-ink tabular-nums">3.46%</b>.
          </p>
          <ul className="space-y-1">
            {BENCHMARKS.map((b) => (
              <li key={b.url} className="flex items-baseline gap-2 text-[12px]">
                <span className="tabular-nums text-ink-secondary font-medium w-8 flex-shrink-0">{b.pct}%</span>
                <a
                  href={b.url} target="_blank" rel="noopener noreferrer"
                  className="text-ink-muted hover:text-brand transition-colors inline-flex items-baseline gap-1 min-w-0"
                >
                  <span className="truncate">{b.label}</span>
                  <ExternalLink size={11} className="flex-shrink-0 self-center" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-2.5">Status</h3>
          {isFinal ? (
            <>
              <p className="text-[12.5px] text-ink-secondary">
                Finalized, with the average score frozen at{' '}
                <b className="font-semibold text-ink tabular-nums">{fmtScore(cycle.avg_score_final)}</b>.
                Nothing in this year can change while it stays that way.
              </p>
              <button type="button" disabled={saving} onClick={() => patch({ status: 'draft' })} className={`${BTN_QUIET} mt-3`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <LockOpen size={15} />}
                Reopen for editing
              </button>
            </>
          ) : (
            <>
              <p className="text-[12.5px] text-ink-secondary">
                While this is a draft, every raise divides by the live average of the recorded
                scores — so each new score moves everyone. Finalizing freezes that average
                {avg !== null && <> at <b className="font-semibold text-ink tabular-nums">{fmtScore(avg)}</b></>}
                {' '}and locks the year.
              </p>
              {scoredCount === 0 ? (
                <p className="mt-3 text-[11.5px] text-ink-faint">Score at least one person before finalizing.</p>
              ) : confirmFinal ? (
                <button
                  type="button" disabled={saving} onClick={() => patch({ status: 'final' })}
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-500/40 text-[13px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                  Finalize {cycle.year} — {scoredCount} scored
                </button>
              ) : (
                <button type="button" disabled={saving} onClick={() => setConfirmFinal(true)} className={`${BTN_QUIET} mt-3`}>
                  <Lock size={15} />
                  Finalize the year
                </button>
              )}
            </>
          )}
        </section>

        {error && (
          <p className="mt-4 text-[12.5px] text-rose-500 flex items-start gap-1.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}
      </DrawerBody>

      <DrawerFooter>
        <span />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={BTN_QUIET}>
            {dirty ? 'Discard' : 'Close'}
          </button>
          {!isFinal && (
            <button
              type="button"
              disabled={saving || !dirty || num(draft.divisor) === null || Number(draft.divisor) <= 0}
              onClick={() => patch({
                raise_pool: Number(draft.raise_pool),
                divisor: Number(draft.divisor),
                hours_per_week: Number(draft.hours_per_week),
                weeks_per_year: Number(draft.weeks_per_year),
              })}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save
            </button>
          )}
        </div>
      </DrawerFooter>
    </Drawer>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}
