export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, Search, Bell, Plus,
  Inbox, FileText, ClipboardList, Ticket, CheckCircle2,
  MoreHorizontal,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/test — DESIGN PREVIEW
   A dark "operations overview" dashboard modeled on a clean database admin UI,
   populated entirely with IAT's real submissions / tickets / forms metrics.
   Self-contained server component: all charts are server-rendered inline SVG.
   ──────────────────────────────────────────────────────────────────────────── */

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  green:  '#34d399',
  blue:   '#60a5fa',
  violet: '#a78bfa',
  amber:  '#fbbf24',
  rose:   '#fb7185',
  sky:    '#38bdf8',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString()
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initialsOf(name: string) {
  if (!name || name === 'Anonymous') return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Data ─────────────────────────────────────────────────────────────────────
type Sub = {
  form_title: string | null
  submitted_at: string
  is_read: boolean
  status?: string
  data: Record<string, unknown>
  id?: string
}
type Tkt = {
  id: string
  ticket_number: string
  customer_name: string
  customer_company: string | null
  model_number: string | null
  serial_number: string | null
  priority: string | null
  status: string
  created_at: string
}

async function getData() {
  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 864e5).toISOString()

  const [
    { count: totalSubs },
    { count: unread },
    { count: activeForms },
    { count: openTickets },
    { count: inProgress },
    { count: resolvedTotal },
    { count: totalTickets },
    { count: resolved7d },
    { data: subSample },
    { data: tktSample },
    { data: recentSubs },
    { data: forms },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('created_at', sevenDaysAgo),
    supabaseAdmin
      .from('submissions')
      .select('form_title,submitted_at,is_read,status,data')
      .order('submitted_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('tickets')
      .select('id,ticket_number,customer_name,customer_company,model_number,serial_number,priority,status,created_at')
      .order('created_at', { ascending: false })
      .limit(400),
    supabaseAdmin
      .from('submissions')
      .select('id,form_title,submitted_at,is_read,status,data')
      .order('submitted_at', { ascending: false })
      .limit(7),
    supabaseAdmin.from('forms').select('id,title,is_active,created_at').order('created_at', { ascending: false }),
  ])

  const subs = (subSample || []) as Sub[]
  const tkts = (tktSample || []) as Tkt[]

  // 14-day daily activity series (real counts, local-day buckets)
  const days: { key: string; label: string }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 864e5)
    days.push({ key: dayKey(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
  }
  const subByDay = new Map(days.map((d) => [d.key, 0]))
  const tktByDay = new Map(days.map((d) => [d.key, 0]))
  for (const s of subs) {
    const k = dayKey(new Date(s.submitted_at))
    if (subByDay.has(k)) subByDay.set(k, subByDay.get(k)! + 1)
  }
  for (const t of tkts) {
    const k = dayKey(new Date(t.created_at))
    if (tktByDay.has(k)) tktByDay.set(k, tktByDay.get(k)! + 1)
  }
  const subSeries = days.map((d) => subByDay.get(d.key)!)
  const tktSeries = days.map((d) => tktByDay.get(d.key)!)
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const subDelta = sum(subSeries.slice(7)) - sum(subSeries.slice(0, 7))
  const tktDelta = sum(tktSeries.slice(7)) - sum(tktSeries.slice(0, 7))

  // Per-form aggregation
  const activeTitles = new Set((forms || []).filter((f) => f.is_active).map((f) => f.title))
  const formMap = new Map<string, { title: string; count: number; week: number; unread: number; last: string }>()
  const weekAgo = now - 7 * 864e5
  for (const s of subs) {
    const title = s.form_title || 'Untitled form'
    if (!formMap.has(title)) formMap.set(title, { title, count: 0, week: 0, unread: 0, last: s.submitted_at })
    const f = formMap.get(title)!
    f.count++
    if (!s.is_read) f.unread++
    if (new Date(s.submitted_at).getTime() >= weekAgo) f.week++
    if (new Date(s.submitted_at) > new Date(f.last)) f.last = s.submitted_at
  }
  const formRows = Array.from(formMap.values()).sort((a, b) => b.count - a.count)
  const maxFormCount = Math.max(1, ...formRows.map((f) => f.count))

  // Top submitters (people)
  const peopleMap = new Map<string, { name: string; count: number }>()
  for (const s of subs) {
    const name = String(s.data?.['Employee Name'] || s.data?.['Full Name'] || s.data?.['Name'] || 'Anonymous')
    const email = String(s.data?.['Employee Email'] || s.data?.['Email'] || s.data?.['Email Address'] || '')
    const key = email || name
    if (!peopleMap.has(key)) peopleMap.set(key, { name, count: 0 })
    peopleMap.get(key)!.count++
  }
  const people = Array.from(peopleMap.values()).sort((a, b) => b.count - a.count)
  const maxPeople = Math.max(1, ...people.map((p) => p.count))

  // Forms status table (every form, with submission count + last activity)
  const formStatus = (forms || []).map((f) => {
    const agg = formMap.get(f.title)
    return {
      title: f.title || 'Untitled form',
      active: f.is_active,
      count: agg?.count ?? 0,
      last: agg?.last ?? null,
    }
  })

  return {
    kpi: {
      totalSubs: totalSubs ?? 0,
      activeForms: activeForms ?? 0,
      unread: unread ?? 0,
      openTickets: openTickets ?? 0,
      resolved7d: resolved7d ?? 0,
    },
    donut: {
      open: openTickets ?? 0,
      inProgress: inProgress ?? 0,
      resolved: resolvedTotal ?? 0,
      total: totalTickets ?? 0,
    },
    days,
    subSeries,
    tktSeries,
    subDelta,
    tktDelta,
    formRows,
    maxFormCount,
    people,
    maxPeople,
    formStatus,
    recentSubs: (recentSubs || []) as Sub[],
    recentTickets: tkts.slice(0, 6),
    activeTitles,
  }
}

// ─── Inline charts ────────────────────────────────────────────────────────────

/** Tiny bar sparkline for KPI cards. */
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data)
  const w = 96, h = 34, n = data.length
  const bw = (w - (n - 1) * 2) / n
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * h)
        const x = i * (bw + 2)
        const leading = i >= n - 3
        return (
          <rect
            key={i}
            x={x}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1}
            fill={color}
            opacity={leading ? 0.95 : 0.32}
          />
        )
      })}
    </svg>
  )
}

/** Donut from segments. */
function Donut({
  segments, total, size = 168, stroke = 18,
}: {
  segments: { value: number; color: string }[]
  total: number
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const sumv = Math.max(1, segments.reduce((a, s) => a + s.value, 0))
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = s.value / sumv
          const len = frac * c
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          )
          offset += len
          return el
        })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" className="fill-white" fontSize="30" fontWeight="700">
        {fmt(total)}
      </text>
      <text x="50%" y="60%" textAnchor="middle" fill="#71717a" fontSize="11" fontWeight="600" letterSpacing="0.08em">
        TOTAL
      </text>
    </svg>
  )
}

/** Two-series area + line chart (14-day activity). */
function LineChart({
  days, a, b, ca, cb,
}: {
  days: { label: string }[]
  a: number[]
  b: number[]
  ca: string
  cb: string
}) {
  const W = 620, H = 190, padL = 30, padR = 12, padT = 14, padB = 26
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(2, ...a, ...b)
  const n = a.length
  const x = (i: number) => padL + (iw * i) / (n - 1)
  const y = (v: number) => padT + ih * (1 - v / max)
  const line = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (d: number[]) => `${line(d)} L${x(n - 1).toFixed(1)},${(padT + ih).toFixed(1)} L${padL.toFixed(1)},${(padT + ih).toFixed(1)} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1]
  const ticks = [0, 4, 8, 11, 13]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ca} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ca} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cb} stopOpacity="0.20" />
          <stop offset="100%" stopColor={cb} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => {
        const gy = padT + ih * g
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#27272a" strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fill="#52525b" fontSize="9">
              {Math.round(max * (1 - g))}
            </text>
          </g>
        )
      })}
      <path d={area(a)} fill="url(#gradA)" />
      <path d={area(b)} fill="url(#gradB)" />
      <path d={line(b)} fill="none" stroke={cb} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d={line(a)} fill="none" stroke={ca} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {a.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3 : 0} fill={ca} />
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fill="#52525b" fontSize="9">
          {days[t]?.label}
        </text>
      ))}
    </svg>
  )
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/40 ${className}`}>{children}</div>
  )
}

function CardHead({ title, icon, action, href }: { title: string; icon?: React.ReactNode; action?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80">
      <div className="flex items-center gap-2">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <h3 className="text-[13px] font-semibold text-zinc-100">{title}</h3>
      </div>
      {action && (
        <Link href={href || '#'} className="text-[12px] font-medium text-zinc-400 hover:text-emerald-400 transition-colors">
          {action}
        </Link>
      )}
    </div>
  )
}

function Kpi({
  label, value, unit, delta, deltaLabel, sub, spark, color, icon, href,
}: {
  label: string
  value: number
  unit: string
  delta?: number
  deltaLabel?: string
  sub?: string
  spark: number[]
  color: string
  icon: React.ReactNode
  href?: string
}) {
  const up = (delta ?? 0) >= 0
  const inner = (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700 transition-colors p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-[12px] font-medium text-zinc-400">{label}</span>
        </div>
        <MoreHorizontal size={14} className="text-zinc-600" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold text-white leading-none tabular-nums tracking-tight">{fmt(value)}</span>
            <span className="text-[12px] text-zinc-500">{unit}</span>
          </div>
        </div>
        <div className="opacity-90 -mb-0.5">
          <Spark data={spark} color={color} />
        </div>
      </div>
      <div className="mt-2.5">
        {typeof delta === 'number' ? (
          <span className="text-[11px] font-medium">
            <span style={{ color: up ? C.green : C.rose }}>{up ? '+' : ''}{delta}</span>
            <span className="text-zinc-500"> {deltaLabel}</span>
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500">{sub}</span>
        )}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

const PRIORITY_DOT: Record<string, string> = {
  high: C.rose, med: C.amber, low: C.sky,
}
const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: C.rose,   bg: 'rgba(251,113,133,0.12)' },
  in_progress: { label: 'In Progress', color: C.amber,  bg: 'rgba(251,191,36,0.12)' },
  resolved:    { label: 'Resolved',    color: C.green,  bg: 'rgba(52,211,153,0.12)' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function TestDashboard() {
  const d = await getData()

  const donutSegs = [
    { value: d.donut.resolved, color: C.green },
    { value: d.donut.inProgress, color: C.amber },
    { value: d.donut.open, color: C.rose },
  ]
  const donutTotalForPct = Math.max(1, d.donut.resolved + d.donut.inProgress + d.donut.open)
  const pct = (n: number) => Math.round((n / donutTotalForPct) * 100)

  return (
    <div className="flex-1 overflow-y-auto bg-[#09090b] text-zinc-300 min-h-0">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur">
        <Link href="/admin" className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-500">Operations</span>
          <ChevronRight size={13} className="text-zinc-700" />
          <span className="font-semibold text-zinc-100">Overview</span>
        </div>
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Preview
        </span>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2 w-64 px-3 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500">
          <Search size={14} />
          <span className="text-[13px]">Search…</span>
        </div>
        <button className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          <Bell size={15} />
        </button>
        <Link
          href="/admin/forms/new"
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors"
        >
          <Plus size={14} /> New Form
        </Link>
      </div>

      <div className="p-5 space-y-4 max-w-[1400px]">

        {/* ── KPI row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Kpi
            label="Total Submissions" value={d.kpi.totalSubs} unit="all-time"
            delta={d.subDelta} deltaLabel="vs last week"
            spark={d.subSeries} color={C.blue} icon={<ClipboardList size={15} />}
            href="/admin/submissions"
          />
          <Kpi
            label="Active Forms" value={d.kpi.activeForms} unit="live"
            sub="Published & accepting input"
            spark={d.formRows.slice(0, 14).map((f) => f.count).reverse()} color={C.green} icon={<FileText size={15} />}
            href="/admin/forms"
          />
          <Kpi
            label="Unread" value={d.kpi.unread} unit="to review"
            sub="Submissions awaiting review"
            spark={d.subSeries} color={C.amber} icon={<Inbox size={15} />}
            href="/admin/submissions?is_read=false"
          />
          <Kpi
            label="Open Tickets" value={d.kpi.openTickets} unit="awaiting"
            delta={d.tktDelta} deltaLabel="intake vs last week"
            spark={d.tktSeries} color={C.rose} icon={<Ticket size={15} />}
            href="/admin/tickets"
          />
          <Kpi
            label="Resolved" value={d.kpi.resolved7d} unit="this week"
            sub="Tickets closed in last 7 days"
            spark={d.tktSeries} color={C.green} icon={<CheckCircle2 size={15} />}
            href="/admin/tickets"
          />
        </div>

        {/* ── Performance table + status column ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Forms performance */}
          <Card className="lg:col-span-2">
            <CardHead title="Forms Performance" icon={<FileText size={14} />} action="View all" href="/admin/forms" />
            <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-b border-zinc-800/60">
              <div className="col-span-5">Form</div>
              <div className="col-span-1 text-right">Subs</div>
              <div className="col-span-1 text-right">7d</div>
              <div className="col-span-1 text-right">Unread</div>
              <div className="col-span-2">Share</div>
              <div className="col-span-2 text-right">Last activity</div>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {d.formRows.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-zinc-600">No submissions yet</div>
              ) : (
                d.formRows.slice(0, 7).map((f) => {
                  const active = d.activeTitles.has(f.title)
                  return (
                    <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-zinc-900/60 transition-colors">
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0`} style={{ backgroundColor: active ? C.green : '#52525b' }} />
                        <span className="font-medium text-zinc-200 truncate">{f.title}</span>
                      </div>
                      <div className="col-span-1 text-right tabular-nums text-zinc-300">{fmt(f.count)}</div>
                      <div className="col-span-1 text-right tabular-nums text-zinc-400">{f.week}</div>
                      <div className="col-span-1 text-right tabular-nums">
                        {f.unread > 0 ? <span className="text-amber-400">{f.unread}</span> : <span className="text-zinc-600">0</span>}
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(f.count / d.maxFormCount) * 100}%`, backgroundColor: C.blue }} />
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-zinc-500 tabular-nums">{timeAgo(f.last)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Right column: donut + top lists */}
          <div className="space-y-4">
            <Card>
              <CardHead title="Tickets by Status" icon={<Ticket size={14} />} />
              <div className="flex items-center gap-5 px-5 py-5">
                <Donut segments={donutSegs} total={d.donut.total} />
                <div className="flex-1 space-y-3">
                  <Legend color={C.green} label="Resolved" value={d.donut.resolved} pct={pct(d.donut.resolved)} />
                  <Legend color={C.amber} label="In Progress" value={d.donut.inProgress} pct={pct(d.donut.inProgress)} />
                  <Legend color={C.rose} label="Open" value={d.donut.open} pct={pct(d.donut.open)} />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Top lists ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHead title="Top Forms by Volume" icon={<FileText size={14} />} />
            <div className="px-5 py-4 space-y-3">
              {d.formRows.slice(0, 5).map((f, i) => (
                <RankRow key={f.title} rank={i + 1} label={f.title} value={f.count} pct={(f.count / d.maxFormCount) * 100} color={C.violet} />
              ))}
              {d.formRows.length === 0 && <p className="text-[13px] text-zinc-600 py-4 text-center">No data yet</p>}
            </div>
          </Card>
          <Card>
            <CardHead title="Top Submitters" icon={<Inbox size={14} />} action="People" href="/admin/employees" />
            <div className="px-5 py-4 space-y-3">
              {d.people.slice(0, 5).map((p, i) => (
                <RankRow key={p.name + i} rank={i + 1} label={p.name} value={p.count} pct={(p.count / d.maxPeople) * 100} color={C.sky} />
              ))}
              {d.people.length === 0 && <p className="text-[13px] text-zinc-600 py-4 text-center">No data yet</p>}
            </div>
          </Card>
        </div>

        {/* ── Activity chart + recent submissions ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80">
              <h3 className="text-[13px] font-semibold text-zinc-100">Activity · Last 14 days</h3>
              <div className="flex items-center gap-4">
                <LegendInline color={C.green} label="Submissions" />
                <LegendInline color={C.rose} label="Tickets" />
              </div>
            </div>
            <div className="px-3 py-4">
              <LineChart days={d.days} a={d.subSeries} b={d.tktSeries} ca={C.green} cb={C.rose} />
            </div>
          </Card>

          <Card>
            <CardHead title="Recent Submissions" icon={<Inbox size={14} />} action="View all" href="/admin/submissions" />
            <div className="divide-y divide-zinc-800/50">
              {d.recentSubs.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-zinc-600">Nothing yet</div>
              ) : (
                d.recentSubs.map((s) => {
                  const name = String(s.data?.['Employee Name'] || s.data?.['Full Name'] || s.data?.['Name'] || 'Anonymous')
                  return (
                    <Link
                      key={s.id}
                      href={`/admin/submissions/${s.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300 flex-shrink-0">
                        {initialsOf(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-zinc-200 truncate">{name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{s.form_title || 'Form submission'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-zinc-500 tabular-nums">{timeAgo(s.submitted_at)}</span>
                        {!s.is_read && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} />}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* ── Recent tickets + form status ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent tickets */}
          <Card>
            <CardHead title="Recent Tickets" icon={<Ticket size={14} />} action="View all" href="/admin/tickets" />
            <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-b border-zinc-800/60">
              <div className="col-span-4">Customer</div>
              <div className="col-span-3">Equipment</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Age</div>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {d.recentTickets.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-zinc-600">No tickets yet</div>
              ) : (
                d.recentTickets.map((t) => {
                  const sp = STATUS_PILL[t.status] || STATUS_PILL.open
                  return (
                    <Link key={t.id} href={`/admin/tickets/${t.id}`} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-zinc-900/60 transition-colors">
                      <div className="col-span-4 min-w-0">
                        <p className="font-medium text-zinc-200 truncate">{t.customer_name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{t.ticket_number}</p>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <p className="text-zinc-300 truncate">{t.model_number || '—'}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{t.serial_number ? `S/N ${t.serial_number}` : ''}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 capitalize">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[t.priority ?? 'med'] || C.amber }} />
                          {t.priority ?? 'med'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sp.color, backgroundColor: sp.bg }}>
                          {sp.label}
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-zinc-500 tabular-nums">{timeAgo(t.created_at)}</div>
                    </Link>
                  )
                })
              )}
            </div>
          </Card>

          {/* Form status */}
          <Card>
            <CardHead title="Form Status" icon={<FileText size={14} />} action="Manage" href="/admin/forms" />
            <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-b border-zinc-800/60">
              <div className="col-span-6">Form</div>
              <div className="col-span-2 text-right">Subs</div>
              <div className="col-span-2">State</div>
              <div className="col-span-2 text-right">Last</div>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {d.formStatus.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-zinc-600">No forms yet</div>
              ) : (
                d.formStatus.slice(0, 6).map((f) => (
                  <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-zinc-900/60 transition-colors">
                    <div className="col-span-6 font-medium text-zinc-200 truncate">{f.title}</div>
                    <div className="col-span-2 text-right tabular-nums text-zinc-300">{fmt(f.count)}</div>
                    <div className="col-span-2">
                      {f.active ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: C.green }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Draft
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-zinc-500 tabular-nums">{f.last ? timeAgo(f.last) : '—'}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <p className="text-[11px] text-zinc-600 text-center pt-1 pb-4">
          Design preview · <span className="text-zinc-500">/admin/test</span> · live data from your Supabase instance · the dashboard at{' '}
          <Link href="/admin" className="text-emerald-500 hover:text-emerald-400">/admin</Link> is unchanged
        </p>
      </div>
    </div>
  )
}

// ─── Misc presentational ──────────────────────────────────────────────────────
function Legend({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[12px] text-zinc-400 flex-1">{label}</span>
      <span className="text-[12px] font-semibold text-zinc-100 tabular-nums">{fmt(value)}</span>
      <span className="text-[11px] text-zinc-500 tabular-nums w-9 text-right">{pct}%</span>
    </div>
  )
}

function LegendInline({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function RankRow({ rank, label, value, pct, color }: { rank: number; label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-zinc-600 w-3 tabular-nums">{rank}</span>
      <span className="text-[12px] text-zinc-300 truncate flex-1 min-w-0">{label}</span>
      <div className="w-28 h-1.5 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold text-zinc-200 tabular-nums w-10 text-right">{fmt(value)}</span>
    </div>
  )
}
