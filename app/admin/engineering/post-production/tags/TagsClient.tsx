'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft, Loader2, Plus, Printer, QrCode, RefreshCw, X,
} from 'lucide-react'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'
import { normalizeJobNumber, shortDate, walkTagUrl, type PpTag } from '@/lib/post-production'

/* The QR stickers.
 *
 * Two kinds, and the difference is the whole point:
 *
 *   • A UNIT tag names its job. Scan it and you are already walking that unit —
 *     no typing, which on a shop floor is the difference between a walk
 *     happening and not happening.
 *   • A STANDING tag is printed once and taped to the test bay wall. The scanner
 *     types the four digits. It outlives every unit.
 *
 * Modelled on /admin/production's board QR panel, including the deliberate white
 * plate behind the code: a QR must stay high-contrast to scan, and the dark
 * surface token would tank it.
 */

type Row = PpTag & { walks: number; open: number }
type Job = { id: string; job_number: string; customer_name: string }

const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] ' +
  'font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors disabled:opacity-40'

export default function TagsClient({ tags, jobs }: { tags: Row[]; jobs: Job[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showing, setShowing] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [job, setJob] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setBusy(true); setError('')
    const res = await fetch('/api/admin/post-production/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, job_number: normalizeJobNumber(job) || null }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not create the tag.'); return }
    setCreating(false); setLabel(''); setJob('')
    startTransition(() => router.refresh())
    setShowing({ ...json.tag, walks: 0, open: 0 })
  }

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true)
    const res = await fetch('/api/admin/post-production/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      setShowing(cur => (cur && cur.id === json.tag.id ? { ...cur, ...json.tag } : cur))
      startTransition(() => router.refresh())
    }
    return res.ok
  }

  const active = tags.filter(t => t.is_active)

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Post-production"
          title="Shop-floor tags"
          count="Print a QR, stick it on the unit, and anyone on the floor can file a finding without a login."
          actions={
            <>
              <Link
                href="/admin/engineering/post-production"
                className={BTN}
              >
                <ArrowLeft size={15} strokeWidth={1.75} /> Findings
              </Link>
              <button
                type="button"
                onClick={() => setCreating(v => !v)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all"
              >
                <Plus size={15} strokeWidth={2} /> New tag
              </button>
            </>
          }
        />

        <StatStrip>
          <Stat tone="emerald" label="Active tags" value={active.length} sub="printable right now" />
          <Stat tone="sky" label="Walks from tags" value={tags.reduce((n, t) => n + t.walks, 0)} sub="all time" />
          <Stat tone="amber" label="Open on a tag" value={tags.reduce((n, t) => n + t.open, 0)} sub="not handed over yet" />
        </StatStrip>

        {creating && (
          <div className="px-5 py-4 border-b border-hairline bg-surface-soft">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">What the sticker says</span>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Test bay"
                  className="h-9 w-56 px-2.5 rounded-lg bg-surface border border-hairline text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">
                  Serial <span className="text-ink-faint font-normal">— leave blank for a reusable tag</span>
                </span>
                <input
                  value={job}
                  onChange={e => setJob(e.target.value)}
                  inputMode="numeric"
                  placeholder="4153"
                  className="h-9 w-28 px-2.5 rounded-lg bg-surface border border-hairline text-[13px] text-ink tabular-nums placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                />
              </label>
              <button type="button" onClick={create} disabled={busy} className={BTN}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />} Create
              </button>
              {jobs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {jobs.slice(0, 5).map(j => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => { setJob(j.job_number); setLabel(`Unit ${j.job_number}`) }}
                      className="h-9 px-2.5 rounded-lg border border-hairline bg-surface text-[12px] text-ink-secondary hover:bg-surface-soft transition-colors tabular-nums"
                    >
                      {j.job_number}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2.5 text-[11.5px] text-ink-muted leading-relaxed max-w-[76ch]">
              A tag with a serial goes on that machine and skips the typing. A tag without one lives on
              the wall and asks for the number — print one of those and it never needs replacing.
            </p>
            {error && <p className="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">{error}</p>}
          </div>
        )}

        {tags.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[14px] text-ink-secondary">No tags yet.</p>
            <p className="mt-1.5 text-[12.5px] text-ink-muted max-w-[56ch] mx-auto leading-relaxed">
              One sticker on the test bay wall is enough to start. The person who wired the unit and
              the person who tested it are the two perspectives the portal cannot otherwise reach.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hairline-soft">
            {tags.map(t => (
              <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[14px] font-medium ${t.is_active ? 'text-ink' : 'text-ink-faint line-through'}`}>
                      {t.label}
                    </span>
                    {t.job_number
                      ? <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-md bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 tabular-nums">unit {t.job_number}</span>
                      : <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-md bg-surface-strong text-ink-muted">reusable</span>}
                    {!t.is_active && (
                      <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-md bg-surface-strong text-ink-muted">retired</span>
                    )}
                  </span>
                  <span className="block mt-0.5 text-[11.5px] text-ink-muted tabular-nums">
                    {t.walks} walk{t.walks === 1 ? '' : 's'}
                    {t.open > 0 && ` · ${t.open} open`} · made {shortDate(t.created_at)}
                  </span>
                </span>

                <button type="button" onClick={() => setShowing(t)} className={BTN}>
                  <QrCode size={15} strokeWidth={1.75} /> QR
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patch({ id: t.id, is_active: !t.is_active })}
                  className={BTN}
                >
                  {t.is_active ? 'Retire' : 'Reactivate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </ListCard>

      {showing && <QrPanel tag={showing} busy={busy} onPatch={patch} onClose={() => setShowing(null)} />}
    </ListCardPage>
  )
}

function QrPanel({
  tag, busy, onPatch, onClose,
}: {
  tag: PpTag
  busy: boolean
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const url = walkTagUrl(tag.token)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-[420px] rounded-xl border border-hairline bg-surface print:border-0 print:max-w-none">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-hairline print:hidden">
          <h2 className="text-[15px] font-semibold text-ink truncate flex-1">{tag.label}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* White plate regardless of theme — a QR must stay high-contrast to
              scan, and the dark surface token would tank it. */}
          <div className="flex flex-col items-center rounded-xl border border-hairline bg-white p-6 print:border-0">
            <QRCodeSVG value={url} size={220} level="M" />
            <p className="mt-4 text-[15px] font-semibold text-[#1F1E1B] text-center">
              {tag.label}
            </p>
            <p className="mt-0.5 text-[12px] text-[#57544D] text-center">
              {tag.job_number
                ? `Unit ${tag.job_number} — scan to log what you'd have done differently`
                : "Scan and enter the serial — tell engineering what you'd have done differently"}
            </p>
          </div>

          <p className="mt-4 break-all rounded-lg border border-hairline bg-canvas px-3 py-2 text-center text-[11.5px] text-ink-muted print:hidden">
            {url}
          </p>

          <div className="mt-4 flex items-center gap-2 print:hidden">
            <button onClick={() => window.print()} className={`${BTN} flex-1 justify-center`}>
              <Printer size={15} strokeWidth={1.75} /> Print
            </button>
            {confirming ? (
              <button
                onClick={async () => { if (await onPatch({ id: tag.id, rotate: true })) setConfirming(false) }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-600 text-white text-[13px] font-medium hover:bg-rose-700 transition-colors flex-1 justify-center"
              >
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                Yes — kill old QRs
              </button>
            ) : (
              <button onClick={() => setConfirming(true)} className={`${BTN} flex-1 justify-center`}>
                <RefreshCw size={15} /> New link
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint print:hidden">
            {confirming
              ? 'Every printed QR for this tag stops working immediately. You will need to re-print.'
              : 'Anyone with this link can file findings against this tag. Issue a new one if a printout goes missing.'}
          </p>
        </div>
      </div>
    </div>
  )
}
