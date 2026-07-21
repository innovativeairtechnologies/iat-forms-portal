import type { Deal } from '@/lib/supabase'
import { formatCompactCurrency as fmtC } from '@/lib/utils'
import type { MonthBucket, ConfidenceBand, GroupStat } from '@/lib/deals'
import type { Tone } from '@/components/admin/list'

/* ────────────────────────────────────────────────────────────────────────────
   Shared, PURE presentational primitives for the sales dashboards. No
   'use client', no hooks, no browser APIs — deterministic given props, so they
   render identically on the server pass and in a client tree.

   Density + color note: these are the COMPACT, one-screen variants. Per the
   dashboard owner's direction the /dashboard command center adds a measured
   amount of color on top of DESIGN.md "Quiet Precision" — colored KPI chips and
   multi-hue category charts — drawn from the sanctioned Tone palette
   (slate/emerald/amber/sky/rose/violet) so it still reads as one system rather
   than arbitrary rainbow. Hairline cards, tabular-nums, and the no-resting-
   shadow rule are all kept.
   ──────────────────────────────────────────────────────────────────────────── */

export const T = {
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
  violet: '#8b5cf6',
}

// Ordinal ramp for the confidence funnel (low → high).
export const GREEN_RAMP = ['#BCE6CD', '#8DD3AB', '#4FBA7F', '#1AA35C', '#089447']
// Categorical palette (Tone hues) for the industry donut — colorful, but every
// swatch is a semantic tone, not an off-system hue.
export const CATEGORICAL = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899']

// Soft-wash chip (icon tile) per tone — light + dark.
export const TONE_CHIP: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
}
// Icon text-color per tone (for card-header icons — a whisper of color, no chip).
export const TONE_TEXT: Record<Tone, string> = {
  slate: 'text-slate-500 dark:text-slate-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  sky: 'text-sky-600 dark:text-sky-400',
  rose: 'text-rose-600 dark:text-rose-400',
  violet: 'text-violet-600 dark:text-violet-400',
}

export const pct = (v: number, base: number) => (base <= 0 ? 0 : Math.round((v / base) * 100))

// ── Card shell (flex column so a body can fill remaining height) ──────────────
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-hairline bg-surface flex flex-col min-h-0 ${className}`}>{children}</div>
}

export function CardHead({ title, hint, icon, iconTone }: { title: string; hint?: string; icon?: React.ReactNode; iconTone?: Tone }) {
  return (
    <div className="flex items-center gap-2 px-4 h-9 border-b border-hairline-soft min-w-0 flex-shrink-0">
      {icon && <span className={`flex-shrink-0 ${iconTone ? TONE_TEXT[iconTone] : 'text-ink-faint'}`}>{icon}</span>}
      <h3 className="text-[12px] font-semibold text-ink tracking-[-0.006em] truncate">{title}</h3>
      {hint && <span className="text-[10px] text-ink-muted hidden 2xl:inline truncate">· {hint}</span>}
    </div>
  )
}

// Body that fills the remaining card height, clipping overflow (no scroll).
export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex-1 min-h-0 overflow-hidden ${className}`}>{children}</div>
}

export function Overline({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{children}</p>
}

// ── KPI tile — compact, horizontal, colored icon chip ─────────────────────────
export function Kpi({ label, value, sub, icon, tone = 'slate' }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; tone?: Tone
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-hairline-strong">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TONE_CHIP[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted truncate">{label}</p>
        <p className="text-[19px] font-semibold text-ink leading-[1.15] tabular-nums tracking-[-0.02em] truncate">{value}</p>
        {sub && <p className="text-[10px] text-ink-muted truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ── Quoting activity — $ quoted per month, trailing 12 ───────────────────────
export function QuoteActivityChart({ months }: { months: MonthBucket[] }) {
  const W = 720, H = 168, padL = 38, padR = 8, padT = 14, padB = 22
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(1, ...months.map((m) => m.value)) * 1.1
  const n = Math.max(1, months.length)
  const slot = iw / n
  const bw = Math.min(30, slot * 0.56)
  const x = (i: number) => padL + slot * i + slot / 2
  const grid = [0, 0.5, 1]
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      {grid.map((g, i) => {
        const gy = padT + ih * g
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={T.hair} strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fill={T.inkFaint} fontSize="9" className="tabular-nums">
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
              <text x={x(i)} y={yb - 4} textAnchor="middle" fill={T.inkMuted} fontSize="8" className="tabular-nums">{m.count}</text>
            )}
            <text x={x(i)} y={H - 7} textAnchor="middle" fill={T.inkFaint} fontSize="9">{m.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Confidence funnel — open $ by confidence band ─────────────────────────────
export function ConfidenceFunnel({ bands }: { bands: ConfidenceBand[] }) {
  const ordered = [...bands].reverse() // near-certain first
  const max = Math.max(1, ...ordered.map((b) => b.value))
  return (
    <div className="px-4 py-3 space-y-2.5 h-full flex flex-col justify-center">
      {ordered.map((b, i) => (
        <div key={b.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11.5px] text-ink-secondary flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: GREEN_RAMP[4 - i] }} />
              <span className="truncate">{b.label}</span>
              <span className="text-ink-muted tabular-nums flex-shrink-0 hidden sm:inline">{b.count}</span>
            </span>
            <span className="text-[11.5px] font-semibold text-ink tabular-nums flex-shrink-0 pl-2">{fmtC(b.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-strong overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct(b.value, max)}%`, backgroundColor: GREEN_RAMP[4 - i] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Donut (generic) + legend ──────────────────────────────────────────────────
export function Donut({ segments, centerTop, centerSub, size = 116, stroke = 14 }: {
  segments: { value: number; color: string }[]; centerTop: string; centerSub: string; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const sum = Math.max(1, segments.reduce((a, s) => a + s.value, 0))
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
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
      <text x="50%" y="47%" textAnchor="middle" fill={T.ink} fontSize="19" fontWeight="600" className="tabular-nums">{centerTop}</text>
      <text x="50%" y="61%" textAnchor="middle" fill={T.inkMuted} fontSize="8.5" fontWeight="600" letterSpacing="0.08em">{centerSub}</text>
    </svg>
  )
}

export type LegendItem = { label: string; color: string; valueText: string; pctText: string }

export function DonutLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: it.color }} />
          <span className="text-[11px] text-ink-secondary flex-1 truncate">{it.label}</span>
          <span className="text-[11px] font-semibold text-ink tabular-nums">{it.valueText}</span>
          <span className="text-[10px] text-ink-faint tabular-nums w-8 text-right">{it.pctText}</span>
        </div>
      ))}
    </div>
  )
}

// ── Rep leaderboard row — narrow, top-3 get a colored rank chip ───────────────
const MEDAL: Tone[] = ['amber', 'sky', 'violet']

export function RepRow({ g, rank, maxWeighted, totalWeighted }: {
  g: GroupStat; rank: number; maxWeighted: number; totalWeighted: number
}) {
  const chip = rank <= 3 ? TONE_CHIP[MEDAL[rank - 1]] : 'bg-surface-strong text-ink-faint'
  return (
    <div className="flex items-center gap-2.5 px-4 min-h-[42px] py-1.5 border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums flex-shrink-0 ${chip}`}>{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-ink truncate">{g.name}</p>
          <p className="text-[12px] font-semibold text-ink tabular-nums flex-shrink-0">{fmtC(g.weighted)}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-surface-strong overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct(g.weighted, maxWeighted)}%`, backgroundColor: T.brand }} />
          </div>
          <span className="text-[10px] text-ink-muted tabular-nums flex-shrink-0 w-14 text-right">{g.openCount} open · {pct(g.weighted, totalWeighted)}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Projection tile — one honest forward-looking read ─────────────────────────
export function ProjectionTile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="px-4 py-2.5 border-t border-hairline-soft first:border-t-0 flex-1 flex flex-col justify-center">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
        <span
          className="text-[17px] font-semibold text-ink tabular-nums tracking-[-0.02em] leading-none"
          style={accent ? { color: 'var(--brand-ink)' } : undefined}
        >
          {value}
        </span>
      </div>
      <p className="text-[10px] text-ink-muted mt-1 truncate">{sub}</p>
    </div>
  )
}

// ── Recently-won row ──────────────────────────────────────────────────────────
export function RecentWonRow({ deal }: { deal: Deal }) {
  return (
    <div className="flex items-center gap-2.5 px-4 min-h-[40px] py-1.5 border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink truncate">{deal.customer}</p>
        <p className="text-[10px] text-ink-muted truncate">{deal.job_name || deal.unit_model || deal.group_name}</p>
      </div>
      <p className="text-[12px] font-semibold text-ink tabular-nums flex-shrink-0">{fmtC(deal.total_cost)}</p>
    </div>
  )
}

// ── Open-deal row — biggest live opportunities (customer · industry · $ · conf) ─
export function OpenDealRow({ deal }: { deal: Deal }) {
  return (
    <div className="flex items-center gap-2.5 px-4 min-h-[44px] py-1.5 border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink truncate">{deal.customer}</p>
        <p className="text-[10px] text-ink-muted truncate">{deal.project_type || deal.job_name || deal.group_name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[12px] font-semibold text-ink tabular-nums">{fmtC(deal.total_cost)}</p>
        <p className="text-[10px] text-ink-faint tabular-nums truncate">{deal.confidence}% · {deal.rep || deal.group_name}</p>
      </div>
    </div>
  )
}

// ── "Not tracked yet" — honest placeholder row (no fabricated number) ─────────
export function NotTracked({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-hairline-soft first:border-t-0">
      <span className="text-[12px] text-ink-secondary">{label}</span>
      <span className="text-[10px] text-ink-faint">Not tracked yet</span>
    </div>
  )
}
