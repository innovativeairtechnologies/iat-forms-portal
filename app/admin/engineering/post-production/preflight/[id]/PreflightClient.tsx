'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react'
import PageChrome from '@/app/admin/PageChrome'
import { ListCardPage, ListCard } from '@/components/admin/list-card'
import {
  PREFLIGHT_VERDICTS, VERDICT_LABELS, shortDate,
  type PpThemeRow, type PreflightVerdict,
} from '@/lib/post-production'
import type { Preflight, PreflightItem } from '@/lib/pp-data'
import { VerdictChip } from '../../ui'

const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] ' +
  'font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors disabled:opacity-40'

export default function PreflightClient({
  preflight, items, themes,
}: {
  preflight: Preflight
  items: PreflightItem[]
  themes: PpThemeRow[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState(preflight.notes ?? '')
  const [local, setLocal] = useState(items)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/post-production/preflights/${preflight.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  }

  const setVerdict = async (item: PreflightItem, verdict: PreflightVerdict) => {
    setBusy(item.id)
    setLocal(cur => cur.map(i => (i.id === item.id ? { ...i, verdict } : i)))
    await patch({ item: { id: item.id, verdict, note: item.note ?? '' } })
    setBusy('')
    startTransition(() => router.refresh())
  }

  const setNote = async (item: PreflightItem, note: string) => {
    setLocal(cur => cur.map(i => (i.id === item.id ? { ...i, note } : i)))
    await patch({ item: { id: item.id, verdict: item.verdict, note } })
  }

  const pending = local.filter(i => i.verdict === 'pending').length
  const risks = local.filter(i => i.verdict === 'risk').length

  return (
    <ListCardPage>
      <PageChrome
        record={[
          { label: 'Pre-Production', href: '/admin/engineering/post-production/preflight' },
          { label: `Job ${preflight.job_number}` },
        ]}
      >
        <button
          type="button"
          disabled={busy === '__refresh'}
          onClick={async () => {
            setBusy('__refresh')
            await patch({ refresh: true })
            setBusy('')
            startTransition(() => router.refresh())
          }}
          className={BTN}
        >
          {busy === '__refresh' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Top up
        </button>
        <button
          type="button"
          disabled={busy === '__complete'}
          onClick={async () => {
            setBusy('__complete')
            await patch({ notes, complete: preflight.status !== 'complete' })
            setBusy('')
            startTransition(() => router.refresh())
          }}
          className={preflight.status === 'complete'
            ? BTN
            : 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-40'}
        >
          {busy === '__complete' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2} />}
          {preflight.status === 'complete' ? 'Reopen' : 'Sign it off'}
        </button>
      </PageChrome>

      <div className="space-y-4">
        <ListCard>
          <div className="px-5 py-4 border-b border-hairline">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Pre-production check
            </p>
            <h1 className="mt-1 text-[20px] font-semibold text-ink tracking-tight tabular-nums">
              Job {preflight.job_number}
            </h1>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Opened {shortDate(preflight.created_at)} by {preflight.held_by_name || 'unknown'}
              {preflight.status === 'complete' && preflight.completed_at && (
                <> · signed off {shortDate(preflight.completed_at)}</>
              )}
            </p>
          </div>

          <div className="px-5 py-3 border-b border-hairline bg-surface-soft flex items-center gap-4 flex-wrap">
            <span className="text-[12.5px] text-ink-secondary tabular-nums">
              {local.length - pending}/{local.length} discussed
            </span>
            {risks > 0 && (
              <span className="text-[12.5px] text-amber-700 dark:text-amber-400 tabular-nums">
                {risks} accepted as a known risk
              </span>
            )}
          </div>

          {local.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-[14px] text-ink-secondary">Nothing to carry into this one.</p>
              <p className="mt-1.5 text-[12.5px] text-ink-muted max-w-[54ch] mx-auto leading-relaxed">
                No recurring issue is open right now. That is the outcome the post-production meetings
                are aiming at — not a missing list.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline-soft">
              {local.map(item => {
                const theme = themes.find(t => t.id === item.theme_id)
                return (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="min-w-0 flex-1">
                        {/* The TITLE IS A SNAPSHOT taken when the check opened —
                            renaming the theme later must not rewrite what the
                            room agreed to. */}
                        <span className="block text-[14px] font-medium text-ink">{item.title}</span>
                        {theme && (
                          <span className="block mt-0.5 text-[11.5px] text-ink-muted">
                            Raised {theme.confirmed}× · jobs {theme.jobs.slice(0, 6).join(', ')}
                            {theme.jobs.length > 6 ? '…' : ''}
                            {' · '}
                            <Link
                              href={`/admin/engineering/post-production/themes?open=${theme.id}`}
                              className="hover:text-brand-ink transition-colors"
                            >
                              see the findings
                            </Link>
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0"><VerdictChip verdict={item.verdict} /></span>
                    </div>

                    <div className="mt-3 flex gap-1.5 flex-wrap">
                      {PREFLIGHT_VERDICTS.map(v => (
                        <button
                          key={v}
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => setVerdict(item, v)}
                          className={`h-8 px-2.5 rounded-lg text-[12px] font-medium transition-colors ${
                            item.verdict === v
                              ? 'bg-ink text-canvas'
                              : 'bg-surface-strong text-ink-muted hover:text-ink'
                          }`}
                        >
                          {VERDICT_LABELS[v]}
                        </button>
                      ))}
                    </div>

                    {item.verdict !== 'pending' && (
                      <input
                        defaultValue={item.note ?? ''}
                        onBlur={e => setNote(item, e.target.value)}
                        placeholder={item.verdict === 'risk'
                          ? 'Why it is being accepted this time'
                          : 'How it was handled on this job'}
                        className="mt-2.5 w-full h-9 px-3 rounded-lg bg-surface border border-hairline text-[12.5px] text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ListCard>

        <ListCard>
          <div className="px-5 py-3 border-b border-hairline">
            <h2 className="text-[13px] font-semibold text-ink">Meeting notes</h2>
          </div>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => patch({ notes })}
              rows={4}
              placeholder="Anything else agreed for this build."
              className="w-full resize-y rounded-lg bg-surface border border-hairline px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
            />
          </div>
        </ListCard>

        <Link
          href="/admin/engineering/post-production/preflight"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={15} /> All checks
        </Link>
      </div>
    </ListCardPage>
  )
}
