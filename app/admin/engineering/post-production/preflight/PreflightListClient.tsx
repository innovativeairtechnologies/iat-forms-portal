'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, ClipboardCheck, Loader2, Plus } from 'lucide-react'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat, CardTable, Row, EmptyRow } from '@/components/admin/list-card'
import { PREFLIGHT_LOOKBACK_DAYS, normalizeJobNumber, shortDate, type PpThemeRow } from '@/lib/post-production'
import type { Preflight } from '@/lib/pp-data'
import { CategoryChip } from '../ui'

const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[90px_minmax(0,1fr)_140px_120px_110px]'

type Job = { id: string; job_number: string; customer_name: string; ship_date: string | null }

export default function PreflightListClient({
  checks, carry, jobs,
}: {
  checks: (Preflight & { items: number; open: number })[]
  carry: PpThemeRow[]
  jobs: Job[]
}) {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = normalizeJobNumber(number)
  const suggestions = useMemo(
    () => (clean ? jobs.filter(j => j.job_number.includes(clean)) : jobs).slice(0, 6),
    [jobs, clean],
  )

  const open = async () => {
    if (!clean) { setError('Which job is the meeting for?'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/admin/post-production/preflights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_number: clean }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not open the check.'); return }
    router.push(`/admin/engineering/post-production/preflight/${json.preflight.id}`)
  }

  return (
    <ListCardPage>
      <div className="space-y-4">
        <ListCard>
          <CardHead
            overline="Post-production"
            title="Pre-production checks"
            count="Before the next unit is built, walk the list of what went wrong on the last ones."
            actions={
              <Link
                href="/admin/engineering/post-production"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                <ArrowLeft size={15} strokeWidth={1.75} /> Findings
              </Link>
            }
          />

          <StatStrip>
            <Stat tone="rose" label="Carried into the next check" value={carry.length} sub={`recurring, last ${PREFLIGHT_LOOKBACK_DAYS} days`} />
            <Stat tone="sky" label="Checks held" value={checks.length} sub="all time" />
            <Stat tone="amber" label="In progress" value={checks.filter(c => c.status === 'in_progress').length} sub="not signed off" />
          </StatStrip>

          <div className="p-5 border-b border-hairline">
            <p className="text-[12px] font-medium text-ink-secondary mb-2">Open a check for a job</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={number}
                onChange={e => setNumber(e.target.value)}
                inputMode="numeric"
                placeholder="4160"
                className="h-10 w-32 px-3 rounded-lg bg-surface border border-hairline text-[15px] font-medium text-ink tabular-nums placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              />
              <button
                type="button"
                onClick={open}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 transition-all"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2} />}
                Start the check
              </button>
              {suggestions.map(j => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setNumber(j.job_number)}
                  className="h-10 px-2.5 rounded-lg border border-hairline bg-surface text-left hover:bg-surface-soft hover:border-hairline-strong transition-colors"
                >
                  <span className="block text-[12.5px] font-medium text-ink tabular-nums leading-tight">{j.job_number}</span>
                  <span className="block text-[10.5px] text-ink-muted truncate max-w-[130px] leading-tight">
                    {j.customer_name || '—'}
                  </span>
                </button>
              ))}
            </div>
            {error && <p className="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">{error}</p>}
          </div>

          <CardTable
            cols={COLS}
            minWidth={860}
            head={
              <>
                <span className="hidden sm:block">Job</span>
                <span>Held</span>
                <span className="hidden sm:block">Lines</span>
                <span className="hidden sm:block">Status</span>
                <span className="hidden sm:block justify-self-end">Date</span>
              </>
            }
          >
            {checks.length === 0 ? (
              <EmptyRow>No pre-production checks yet. Open one above before the next kickoff.</EmptyRow>
            ) : (
              checks.map(c => (
                <Row key={c.id} cols={COLS} href={`/admin/engineering/post-production/preflight/${c.id}`}>
                  <span className="hidden sm:block tabular-nums text-[13px] font-medium text-ink">{c.job_number}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink group-hover:text-brand-ink transition-colors">
                      {c.held_by_name || 'Unknown'}
                    </span>
                    <span className="block text-[11px] text-ink-muted sm:hidden tabular-nums">
                      Job {c.job_number} · {shortDate(c.created_at)}
                    </span>
                  </span>
                  <span className="hidden sm:block text-[12.5px] text-ink-secondary tabular-nums">
                    {c.items === 0
                      ? <span className="text-ink-faint">Nothing to carry</span>
                      : `${c.items - c.open}/${c.items} discussed`}
                  </span>
                  <span className="hidden sm:block text-[12.5px]">
                    {c.status === 'complete'
                      ? <span className="text-brand-ink">Signed off</span>
                      : <span className="text-amber-700 dark:text-amber-400">In progress</span>}
                  </span>
                  <span className="justify-self-end text-[12px] text-ink-muted tabular-nums">
                    {shortDate(c.created_at)}
                  </span>
                </Row>
              ))
            )}
          </CardTable>
        </ListCard>

        {/* What the next check will carry, visible without opening one. */}
        <ListCard>
          <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
            <ClipboardCheck size={14} className="text-ink-muted" strokeWidth={1.75} />
            <h2 className="text-[13px] font-semibold text-ink">What the next check will carry</h2>
          </div>
          {carry.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13.5px] text-ink-secondary">Nothing recurring is open.</p>
              <p className="mt-1.5 text-[12.5px] text-ink-muted max-w-[54ch] mx-auto leading-relaxed">
                That is the target, not a gap — a pre-production meeting with nothing to carry means the
                last few units did not repeat anything.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline-soft">
              {carry.map(t => (
                <div key={t.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-medium text-ink">{t.title}</span>
                      <CategoryChip category={t.category} />
                    </span>
                    {t.summary && (
                      <span className="block mt-0.5 text-[12px] text-ink-muted leading-relaxed max-w-[78ch]">
                        {t.summary}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-[15px] font-semibold text-ink tabular-nums">{t.confirmed}×</span>
                    <span className="block text-[10.5px] text-ink-faint tabular-nums">
                      jobs {t.jobs.slice(0, 4).join(', ')}{t.jobs.length > 4 ? '…' : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </ListCard>
      </div>
    </ListCardPage>
  )
}
