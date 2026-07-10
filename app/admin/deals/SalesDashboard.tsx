'use client'

import { useMemo, useRef, useState } from 'react'
import {
  TrendingUp, Target, Trophy, Filter, Upload, X, ArrowRight, Gauge,
  AlertTriangle, FileSpreadsheet, DollarSign, Percent, Layers, CalendarRange,
  CheckCircle2, Loader2, Inbox,
} from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { formatCurrency, formatCompactCurrency as fmtC } from '@/lib/utils'
import {
  computeSummary, monthlyQuoteSeries, confidenceBands, groupStats,
  projectedBuckets, attentionSignals,
  type MonthBucket, type ConfidenceBand, type GroupStat, type ProjectedBucket,
} from '@/lib/deals'
import { timeAgo, type Tone } from '@/components/admin/list'
import type { ImportGroup } from '@/lib/deals-import'

/* ────────────────────────────────────────────────────────────────────────────
   Sales "Command Center" — the overview tab of /admin/deals. Every figure is
   computed live from the deals table (imported from the sales team's
   monday.com "Sales Forecasting" export via the Import button; see
   lib/deals-import.ts). No sample numbers anywhere — cards that would need
   data the board doesn't carry (quotas, bookings-by-close-date, activity
   counters) simply don't exist yet rather than showing invented values.
   Follows DESIGN.md "Quiet Precision": hairline cards, semantic tokens, brand
   green as the single accent, tones only on status meaning, tabular-nums, one
   fade-up entrance.
   ──────────────────────────────────────────────────────────────────────────── */

const T = {
  brand: 'var(--brand)',
  ink: 'var(--ink)',
  inkMuted: 'var(--ink-muted)',
  inkFaint: 'var(--ink-faint)',
  hair: 'var(--hairline)',
  surfaceStrong: 'var(--surface-strong)',
  emerald: '#10b981',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  amber: '#f59e0b',
}
// Brand ramp for charts (DESIGN.md §2.3 sanctions the ramp for charts only) —
// light = low confidence, dark = near-certain.
const GREEN_RAMP = ['#BCE6CD', '#8DD3AB', '#4FBA7F', '#1AA35C', '#089447']

const pct = (v: number, base: number) => (base <= 0 ? 0 : Math.round((v / base) * 100))

// ── Primitives ────────────────────────────────────────────────────────────────
function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-hairline bg-surface ${className}`}>{children}</div>
}

function CardHead({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 h-12 border-b border-hairline-soft min-w-0">
      {icon && <span className="text-ink-faint flex-shrink-0">{icon}</span>}
      <h3 className="text-[13px] font-semibold text-ink tracking-[-0.006em] truncate">{title}</h3>
      {hint && <span className="text-[11px] text-ink-muted hidden sm:inline truncate">· {hint}</span>}
    </div>
  )
}

function Overline({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{children}</p>
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 transition-colors hover:border-hairline-strong">
      <div className="flex items-center gap-2">
        <span className="text-ink-faint">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      </div>
      <p className="mt-3 text-[27px] font-semibold text-ink leading-none tabular-nums tracking-[-0.02em]">{value}</p>
      {sub && <p className="mt-2.5 text-[11px] text-ink-muted">{sub}</p>}
    </Card>
  )
}

// ── Quoting activity — $ quoted per month, trailing 12 ───────────────────────
function QuoteActivityChart({ months }: { months: MonthBucket[] }) {
  const W = 720, H = 200, padL = 40, padR = 10, padT = 16, padB = 26
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(1, ...months.map((m) => m.value)) * 1.1
  const n = months.length
  const slot = iw / n
  const bw = Math.min(34, slot * 0.58)
  const x = (i: number) => padL + slot * i + slot / 2
  const grid = [0, 0.25, 0.5, 0.75, 1]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {grid.map((g, i) => {
        const gy = padT + ih * g
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={T.hair} strokeWidth="1" />
            <text x={padL - 8} y={gy + 3} textAnchor="end" fill={T.inkFaint} fontSize="9" className="tabular-nums">
              {fmtC(Math.round(max * (1 - g)))}
            </text>
          </g>
        )
      })}
      {months.map((m, i) => {
        const h = m.value > 0 ? Math.max(2, (m.value / max) * ih) : 0
        const yb = padT + ih - h
        return (
          <g key={m.key}>
            {h > 0 && <rect x={x(i) - bw / 2} y={yb} width={bw} height={h} rx={3} fill={T.brand} opacity={0.9} />}
            {m.count > 0 && (
              <text x={x(i)} y={yb - 5} textAnchor="middle" fill={T.inkMuted} fontSize="8.5" className="tabular-nums">
                {m.count}
              </text>
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" fill={T.inkFaint} fontSize="9">{m.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Confidence funnel — open $ by confidence band ─────────────────────────────
function ConfidenceFunnel({ bands }: { bands: ConfidenceBand[] }) {
  const ordered = [...bands].reverse() // near-certain first
  const max = Math.max(1, ...ordered.map((b) => b.value))
  return (
    <div className="px-5 py-4 space-y-3">
      {ordered.map((b, i) => (
        <div key={b.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-ink-secondary flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: GREEN_RAMP[GREEN_RAMP.length - 1 - i] }} />
              <span className="truncate">{b.label}</span>
              <span className="text-ink-muted tabular-nums flex-shrink-0">{b.min}–{b.max}% · {b.count}</span>
            </span>
            <span className="text-[12px] font-semibold text-ink tabular-nums flex-shrink-0 pl-2">{fmtC(b.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-strong overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct(b.value, max)}%`, backgroundColor: GREEN_RAMP[GREEN_RAMP.length - 1 - i] }} />
          </div>
          <p className="text-[10px] text-ink-faint tabular-nums mt-0.5">{fmtC(b.weighted)} expected</p>
        </div>
      ))}
    </div>
  )
}

// ── Status donut ──────────────────────────────────────────────────────────────
function Donut({ segments, centerTop, centerSub, size = 150, stroke = 17 }: {
  segments: { value: number; color: string }[]; centerTop: string; centerSub: string; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const sum = Math.max(1, segments.reduce((a, s) => a + s.value, 0))
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={T.surfaceStrong} />
        {segments.map((s, i) => {
          const len = (s.value / sum) * c
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          )
          offset += len
          return el
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" fill={T.ink} fontSize="26" fontWeight="600" className="tabular-nums">{centerTop}</text>
      <text x="50%" y="62%" textAnchor="middle" fill={T.inkMuted} fontSize="10" fontWeight="600" letterSpacing="0.08em">{centerSub}</text>
    </svg>
  )
}

// ── Projected close buckets — weighted $ by parsed `projected` text ───────────
function ProjectedCloseBars({ buckets }: { buckets: ProjectedBucket[] }) {
  const shown = buckets.slice(0, 7)
  const max = Math.max(1, ...shown.map((b) => b.weighted))
  return (
    <div className="px-5 py-4 space-y-3">
      {shown.map((b) => {
        const soft = b.label === 'Unscheduled' || b.label === 'No date'
        return (
          <div key={b.label} className="flex items-center gap-3">
            <span className={`w-24 flex-shrink-0 text-[12px] tabular-nums ${soft ? 'text-ink-muted' : 'text-ink-secondary'}`}>{b.label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-strong overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct(b.weighted, max)}%`, backgroundColor: soft ? 'var(--hairline-strong)' : T.brand, opacity: soft ? 1 : 0.9 }}
              />
            </div>
            <span className="w-16 text-right text-[12px] font-semibold text-ink tabular-nums flex-shrink-0">{fmtC(b.weighted)}</span>
            <span className="w-8 text-right text-[11px] text-ink-faint tabular-nums flex-shrink-0">{b.count}</span>
          </div>
        )
      })}
      {shown.length === 0 && <p className="text-[12px] text-ink-muted text-center py-4">No open deals</p>}
    </div>
  )
}

// ── Group leaderboard row ─────────────────────────────────────────────────────
const LEADER_COLS = 'grid-cols-[26px_1.3fr_1.6fr_0.8fr_0.6fr_0.8fr]'

function LeaderRow({ g, rank, maxWeighted, totalWeighted }: {
  g: GroupStat; rank: number; maxWeighted: number; totalWeighted: number
}) {
  return (
    <div className={`grid ${LEADER_COLS} items-center gap-3 px-5 min-h-[54px] text-[13px] border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors`}>
      <span className="text-[12px] font-semibold text-ink-faint tabular-nums text-center">{rank}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-full bg-surface-strong flex items-center justify-center text-[10px] font-semibold text-ink-secondary flex-shrink-0">
          {g.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{g.name}</p>
          <p className="text-[11px] text-ink-muted tabular-nums">{g.openCount} open</p>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-ink-muted tabular-nums">{fmtC(g.weighted)} expected</span>
          <span className="text-[11px] font-semibold text-ink tabular-nums">{pct(g.weighted, totalWeighted)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-strong overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct(g.weighted, maxWeighted)}%`, backgroundColor: T.brand }} />
        </div>
      </div>
      <span className="text-right tabular-nums text-ink-secondary">{fmtC(g.raw)}</span>
      <span className="text-right tabular-nums text-ink-muted">{Math.round(g.blendedConfidence)}%</span>
      <span className="text-right tabular-nums text-ink-secondary">
        {g.winRate === null ? <span className="text-ink-faint">—</span> : `${Math.round(g.winRate)}%`}
      </span>
    </div>
  )
}

// ── Import modal — dry-run preview, then commit ───────────────────────────────
type ImportPreview = {
  groups: ImportGroup[]
  totalDeals: number
  totalCost: number
  totalWeighted: number
  warnings: string[]
  existingCount: number
}

type ImportStage = 'pick' | 'checking' | 'preview' | 'importing'

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (fresh: Deal[]) => void }) {
  const [stage, setStage] = useState<ImportStage>('pick')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<File | null>(null)

  const send = async (commit: boolean) => {
    const file = fileRef.current
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', mode)
    fd.append('commit', commit ? 'true' : 'false')
    const res = await fetch('/api/admin/deals/import', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Import failed.')
    return json
  }

  const check = async (file: File) => {
    fileRef.current = file
    setError('')
    setStage('checking')
    try {
      const json = await send(false)
      setPreview(json.preview)
      setStage('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
      setStage('pick')
    }
  }

  const commit = async () => {
    setError('')
    setStage('importing')
    try {
      const json = await send(true)
      if (Array.isArray(json.deals)) onImported(json.deals as Deal[])
      else window.location.reload() // insert succeeded but re-select failed — reload to refetch
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
      setStage('preview')
    }
  }

  const busy = stage === 'checking' || stage === 'importing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={busy ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-hairline bg-surface p-6 animate-fade-up max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-soft flex items-center justify-center" style={{ color: 'var(--brand-ink)' }}>
              <FileSpreadsheet size={17} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Import sales forecasting</h2>
              <p className="text-[12px] text-ink-muted">monday.com board export (.xlsx)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-ink-faint hover:text-ink-secondary transition-colors disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {(stage === 'pick' || stage === 'checking') && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) check(f)
            }}
            className={`mt-5 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-9 cursor-pointer transition-colors ${
              dragOver ? 'border-brand bg-brand-soft' : 'border-hairline-strong bg-surface-soft hover:border-brand'
            }`}
          >
            {stage === 'checking' ? (
              <>
                <Loader2 size={20} className="text-ink-muted animate-spin" />
                <span className="text-[13px] font-medium text-ink-secondary">Reading the board…</span>
              </>
            ) : (
              <>
                <Upload size={20} className="text-ink-muted" />
                <span className="text-[13px] font-medium text-ink-secondary">Drop the export here, or click to browse</span>
                <span className="text-[11px] text-ink-faint">Groups, deals, confidence and notes come across as-is</span>
              </>
            )}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f) }}
            />
          </label>
        )}

        {(stage === 'preview' || stage === 'importing') && preview && (
          <div className="mt-5 space-y-4">
            {/* What's in the file */}
            <div className="rounded-xl border border-hairline overflow-hidden">
              <div className="grid grid-cols-[1fr_60px_100px_100px] gap-2 px-3.5 h-8 items-center bg-surface-soft text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                <span>Group</span><span className="text-right">Deals</span><span className="text-right">Value</span><span className="text-right">Weighted</span>
              </div>
              {preview.groups.map((g) => (
                <div key={g.name} className="grid grid-cols-[1fr_60px_100px_100px] gap-2 px-3.5 h-9 items-center text-[12.5px] border-t border-hairline-soft">
                  <span className="font-medium text-ink truncate">{g.name}</span>
                  <span className="text-right tabular-nums text-ink-secondary">{g.count}</span>
                  <span className="text-right tabular-nums text-ink-secondary">{fmtC(g.totalCost)}</span>
                  <span className="text-right tabular-nums text-ink-secondary">{fmtC(g.weighted)}</span>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_60px_100px_100px] gap-2 px-3.5 h-9 items-center text-[12.5px] border-t border-hairline bg-surface-soft">
                <span className="font-semibold text-ink">Total</span>
                <span className="text-right tabular-nums font-semibold text-ink">{preview.totalDeals}</span>
                <span className="text-right tabular-nums font-semibold text-ink">{fmtC(preview.totalCost)}</span>
                <span className="text-right tabular-nums font-semibold" style={{ color: 'var(--brand-ink)' }}>{fmtC(preview.totalWeighted)}</span>
              </div>
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-400 mb-1">
                  {preview.warnings.length} row{preview.warnings.length === 1 ? '' : 's'} to double-check
                </p>
                <ul className="space-y-0.5">
                  {preview.warnings.slice(0, 4).map((w, i) => (
                    <li key={i} className="text-[12px] text-amber-700 dark:text-amber-300/90 leading-snug">{w}</li>
                  ))}
                  {preview.warnings.length > 4 && (
                    <li className="text-[12px] text-amber-600 dark:text-amber-400">…and {preview.warnings.length - 4} more (imported anyway)</li>
                  )}
                </ul>
              </div>
            )}

            {/* Mode */}
            <div className="space-y-2">
              <ModeRadio
                checked={mode === 'replace'}
                onSelect={() => setMode('replace')}
                title={`Replace the board (${preview.existingCount} current deal${preview.existingCount === 1 ? '' : 's'})`}
                blurb="The export is the whole board — clear what's here and load it fresh. Recommended."
              />
              <ModeRadio
                checked={mode === 'append'}
                onSelect={() => setMode('append')}
                title="Add on top"
                blurb="Keep the current deals and add these as new rows. Re-uploading the same export will duplicate."
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setStage('pick'); setPreview(null); fileRef.current = null }}
                disabled={stage === 'importing'}
                className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors disabled:opacity-50"
              >
                Different file
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={stage === 'importing'}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {stage === 'importing'
                  ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                  : <><CheckCircle2 size={14} /> Import {preview.totalDeals} deals</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeRadio({ checked, onSelect, title, blurb }: { checked: boolean; onSelect: () => void; title: string; blurb: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors ${
        checked ? 'border-brand bg-brand-soft' : 'border-hairline bg-surface hover:border-hairline-strong'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
          style={checked
            ? { borderColor: 'var(--brand)', backgroundColor: 'var(--brand)', boxShadow: 'inset 0 0 0 2.5px var(--surface)' }
            : { borderColor: 'var(--hairline-strong)' }}
        />
        <span className="text-[13px] font-medium text-ink tabular-nums">{title}</span>
      </span>
      <span className="block pl-[22px] text-[12px] text-ink-muted leading-snug mt-0.5">{blurb}</span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SalesDashboard({ deals, onImported }: { deals: Deal[]; onImported: (fresh: Deal[]) => void }) {
  const [showImport, setShowImport] = useState(false)

  // One timestamp per mount — every derivation shares it, so the whole view is
  // internally consistent (and SSR/hydration render the same buckets).
  const now = useMemo(() => new Date(), [])

  const d = useMemo(() => {
    const summary = computeSummary(deals)
    const open = deals.filter((x) => x.status === null)
    return {
      summary,
      openCount: summary.openCount,
      raw: open.reduce((a, x) => a + x.total_cost, 0),
      weighted: open.reduce((a, x) => a + x.total_cost * (x.confidence / 100), 0),
      wonValue: deals.filter((x) => x.status === 'Won').reduce((a, x) => a + x.total_cost, 0),
      months: monthlyQuoteSeries(deals, now),
      bands: confidenceBands(deals),
      groups: groupStats(deals),
      buckets: projectedBuckets(deals),
      attention: attentionSignals(deals, now),
      top: [...deals].filter((x) => x.status === null).sort((a, b) => b.total_cost - a.total_cost).slice(0, 6),
      lastTouch: deals.length ? deals.reduce((a, x) => (x.created_at > a ? x.created_at : a), deals[0].created_at) : null,
    }
  }, [deals, now])

  const blended = d.raw > 0 ? (d.weighted / d.raw) * 100 : 0
  const avgOpen = d.openCount > 0 ? d.raw / d.openCount : 0
  const maxGroupWeighted = Math.max(1, ...d.groups.map((g) => g.weighted))

  const statusSegs: { value: number; color: string; label: string; tone: Tone }[] = [
    { value: d.summary.wonCount, color: T.emerald, label: 'Won', tone: 'emerald' },
    { value: d.summary.openCount, color: T.sky, label: 'Open', tone: 'sky' },
    { value: d.summary.lostCount, color: T.rose, label: 'Lost', tone: 'rose' },
  ]

  // ── Empty board — first-run state points straight at the importer ──
  if (deals.length === 0) {
    return (
      <div className="animate-fade-up">
        <Card className="max-w-md mx-auto mt-10 p-8 text-center">
          <span className="mx-auto w-12 h-12 rounded-xl bg-surface-strong flex items-center justify-center text-ink-muted">
            <FileSpreadsheet size={20} />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold text-ink">No deals on the board yet</h2>
          <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">
            Import the sales team&apos;s forecasting export and this page becomes their live command center.
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="mt-5 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            <Upload size={15} /> Import from Excel
          </button>
        </Card>
        {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={onImported} />}
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-5">

      {/* Toolbar — live badge + import */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live board
          </span>
          <span className="text-[12px] text-ink-muted tabular-nums">
            {deals.length} deals{d.lastTouch ? ` · refreshed ${timeAgo(d.lastTouch)} ago` : ''}
          </span>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft hover:text-ink transition-colors"
        >
          <Upload size={15} /> Import from Excel
        </button>
      </div>

      {/* ── Hero — the forecast headline ── */}
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--brand-soft), transparent 70%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <Overline>Weighted pipeline forecast</Overline>
            <div className="mt-2 flex items-end gap-3 flex-wrap">
              <span className="text-[44px] sm:text-[52px] font-semibold text-ink leading-[0.95] tabular-nums tracking-[-0.03em]">
                {fmtC(d.weighted)}
              </span>
              <span className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums" style={{ color: 'var(--brand-ink)' }}>
                <TrendingUp size={15} /> {Math.round(blended)}% blended confidence
              </span>
            </div>
            <p className="mt-2.5 text-[13px] text-ink-secondary max-w-lg leading-relaxed">
              Expected value of <span className="text-ink font-medium tabular-nums">{d.openCount}</span> open deals worth{' '}
              <span className="text-ink font-medium tabular-nums">{formatCurrency(d.raw)}</span> in raw pipeline
              {d.summary.winRate !== null
                ? <> · winning <span className="text-ink font-medium tabular-nums">{Math.round(d.summary.winRate)}%</span> of closed deals</>
                : <> · no closed outcomes recorded yet — mark deals Won or Lost in the Pipeline tab and win rates light up</>}
              .
            </p>
          </div>
          <div className="flex gap-5 flex-shrink-0">
            <HeroStat label="Raw pipeline" value={fmtC(d.raw)} />
            <HeroStat label="Open deals" value={String(d.openCount)} />
            <HeroStat label="Won to date" value={d.wonValue > 0 ? fmtC(d.wonValue) : '—'} accent={d.wonValue > 0} />
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Raw pipeline" value={fmtC(d.raw)} sub="open, unweighted" icon={<Layers size={15} />} />
        <Kpi label="Weighted" value={fmtC(d.weighted)} sub="expected value" icon={<Target size={15} />} />
        <Kpi label="Open deals" value={String(d.openCount)} sub={`across ${d.groups.length} groups`} icon={<Inbox size={15} />} />
        <Kpi label="Avg open deal" value={fmtC(avgOpen)} sub="raw value" icon={<DollarSign size={15} />} />
        <Kpi label="Blended conf." value={`${Math.round(blended)}%`} sub="weighted ÷ raw" icon={<Percent size={15} />} />
        <Kpi
          label="Win rate"
          value={d.summary.winRate === null ? '—' : `${Math.round(d.summary.winRate)}%`}
          sub={d.summary.winRate === null ? 'no closed deals yet' : `${d.summary.wonCount} won · ${d.summary.lostCount} lost`}
          icon={<Trophy size={15} />}
        />
      </div>

      {/* ── Main + rail ── */}
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <main className="flex-1 min-w-0 w-full space-y-5">

          {/* Quoting activity */}
          <Card>
            <CardHead title="Quoting activity" hint="$ quoted per month · count above each bar" icon={<TrendingUp size={14} />} />
            <div className="px-3 pt-4 pb-3">
              <QuoteActivityChart months={d.months} />
            </div>
          </Card>

          {/* Confidence funnel + status donut */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-3">
              <CardHead title="Pipeline by confidence" hint={`${fmtC(d.raw)} open`} icon={<Filter size={14} />} />
              <ConfidenceFunnel bands={d.bands} />
            </Card>
            <Card className="lg:col-span-2">
              <CardHead title="Deals by status" icon={<Layers size={14} />} />
              <div className="flex items-center gap-4 px-5 py-5">
                <Donut segments={statusSegs} centerTop={String(deals.length)} centerSub="DEALS" />
                <div className="flex-1 space-y-2.5">
                  {statusSegs.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[12px] text-ink-secondary flex-1">{s.label}</span>
                      <span className="text-[12px] font-semibold text-ink tabular-nums">{s.value}</span>
                      <span className="text-[11px] text-ink-faint tabular-nums w-9 text-right">{pct(s.value, deals.length)}%</span>
                    </div>
                  ))}
                  {d.summary.wonCount === 0 && d.summary.lostCount === 0 && (
                    <p className="text-[11px] text-ink-faint leading-snug pt-1">
                      Outcomes live in the Pipeline tab&apos;s status column.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Group leaderboard */}
          <Card>
            <CardHead title="Pipeline by group" hint="share of expected value" icon={<Trophy size={14} />} />
            <div className={`grid ${LEADER_COLS} items-center gap-3 px-5 h-9 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft bg-surface-soft`}>
              <span className="text-center">#</span>
              <span>Group</span>
              <span>Share of forecast</span>
              <span className="text-right">Raw</span>
              <span className="text-right">Conf.</span>
              <span className="text-right">Win %</span>
            </div>
            {d.groups.map((g, i) => (
              <LeaderRow key={g.name} g={g} rank={i + 1} maxWeighted={maxGroupWeighted} totalWeighted={Math.max(1, d.weighted)} />
            ))}
          </Card>

          {/* Projected close + top deals */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-3">
              <CardHead title="Projected close" hint="expected $ by the board's own projections" icon={<CalendarRange size={14} />} />
              <ProjectedCloseBars buckets={d.buckets} />
            </Card>
            <Card className="lg:col-span-2">
              <CardHead title="Largest open deals" icon={<Trophy size={14} />} />
              <div>
                {d.top.map((deal) => (
                  <div key={deal.id} className="flex items-center gap-3 px-5 min-h-[56px] py-2 border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink truncate">{deal.customer}</p>
                      <p className="text-[11px] text-ink-muted truncate">{deal.job_name || deal.unit_model || deal.group_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13px] font-semibold text-ink tabular-nums">{fmtC(deal.total_cost)}</p>
                      <p className="text-[10px] text-ink-faint tabular-nums">{deal.confidence}% · {deal.group_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </main>

        {/* ── Right rail ── */}
        <aside className="w-full xl:w-[320px] flex-shrink-0 space-y-5">

          {/* Blended-confidence gauge */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Gauge size={14} className="text-ink-faint" />
              <h3 className="text-[13px] font-semibold text-ink">Blended confidence</h3>
            </div>
            <GaugeArc pctValue={Math.min(100, blended)} label={`${Math.round(blended)}%`} />
            <p className="text-center text-[12px] text-ink-muted -mt-1">
              {fmtC(d.weighted)} expected from {fmtC(d.raw)} quoted
            </p>
            <div className="mt-4 pt-4 border-t border-hairline-soft grid grid-cols-2 gap-3">
              <MiniStat label="Groups" value={String(d.groups.length)} />
              <MiniStat label="Avg open deal" value={fmtC(avgOpen)} />
            </div>
          </Card>

          {/* Needs attention — derived, not invented */}
          <Card>
            <CardHead title="Needs attention" icon={<AlertTriangle size={14} />} />
            <div className="p-2">
              {d.attention.length === 0 ? (
                <p className="text-[12px] text-ink-muted text-center py-4">Board looks healthy — nothing flagged.</p>
              ) : (
                d.attention.map((a, i) => {
                  const dot = a.tone === 'rose' ? T.rose : a.tone === 'amber' ? T.amber : T.sky
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface-soft transition-colors">
                      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-ink-secondary leading-snug">{a.label}</p>
                        <p className="text-[11px] text-ink-faint truncate">{a.meta}</p>
                      </div>
                      <ArrowRight size={13} className="text-ink-faint mt-1 flex-shrink-0" />
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Where this data comes from */}
          <div className="rounded-xl border border-hairline bg-surface-soft px-4 py-3.5">
            <Overline>Source</Overline>
            <p className="mt-1.5 text-[12px] text-ink-secondary leading-relaxed">
              The sales team&apos;s monday.com forecasting board, imported here. Re-upload a fresh export anytime —
              targets and quotas can join once Sales provides them.
            </p>
          </div>
        </aside>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={onImported} />}
    </div>
  )
}

// ── Small presentational bits ─────────────────────────────────────────────────
function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted whitespace-nowrap">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] leading-none" style={{ color: accent ? 'var(--brand-ink)' : 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className="mt-1 text-[16px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  )
}

// Semicircle gauge (0–100%).
function GaugeArc({ pctValue, label }: { pctValue: number; label: string }) {
  const W = 220, H = 122, cx = W / 2, cy = 108, r = 84, stroke = 14
  const circ = Math.PI * r
  const dash = (pctValue / 100) * circ
  const polar = (p: number) => {
    const ang = Math.PI + Math.PI * (p / 100)
    // Round to fixed precision: Math.sin/cos are implementation-approximated,
    // so Node (SSR) and the browser can differ by one ulp — enough for React
    // to flag a hydration attribute mismatch on the needle's cx/cy.
    return [Number((cx + r * Math.cos(ang)).toFixed(2)), Number((cy + r * Math.sin(ang)).toFixed(2))]
  }
  const [hx, hy] = polar(pctValue)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={T.surfaceStrong} strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={T.brand} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      {pctValue < 100 && <circle cx={hx} cy={hy} r={4.5} fill="var(--surface)" stroke={T.brand} strokeWidth="2.5" />}
      <text x={cx} y={cy - 14} textAnchor="middle" fill={T.ink} fontSize="30" fontWeight="600" className="tabular-nums">{label}</text>
      <text x={cx} y={cy + 4} textAnchor="middle" fill={T.inkMuted} fontSize="10" fontWeight="600" letterSpacing="0.06em">OF QUOTED $</text>
    </svg>
  )
}
