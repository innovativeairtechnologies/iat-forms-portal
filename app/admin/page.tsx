export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import Link from 'next/link'
import ExecutiveBriefing from './ExecutiveBriefing'
import DepartmentDashboard from '@/components/admin/DepartmentDashboard'
import SalesDashboardView from '@/components/dashboards/SalesDashboardView'
import { STAFF_ROLES, type StaffRole } from '@/lib/roles'
import type { Deal } from '@/lib/supabase'
import { PRESETS, DASH_PRESET_COOKIE, type Preset } from './dashboard-presets'
import {
  T, pct, Card, CardHead, CardBody, Kpi, Donut, DonutLegend, type LegendItem,
} from '@/components/dashboards/sales-charts'
import {
  Plus,
  Inbox, FileText, ClipboardList, Ticket, CheckCircle2, Clock,
  AlertCircle, ShieldCheck, Sparkles, Users, ArrowRight,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────────
   /admin — OPERATIONS DASHBOARD (theme-aware: light + dark)
   A clean "operations overview" modeled on the shipped Sales command center:
   warm canvas, hairline cards (no resting shadow), semantic tokens, and a
   measured amount of color via sanctioned Tone chips — populated entirely with
   IAT's real submissions / tickets / forms metrics. Server component; charts are
   server-rendered inline SVG (token-aware). Shares the presentational primitives
   in components/dashboards/sales-charts.tsx.
   ──────────────────────────────────────────────────────────────────────────── */

// ─── Accent palette (sanctioned Tone hues; read well on light + dark) ─────────
const C = {
  green:  '#10b981',
  blue:   '#3b82f6',
  violet: '#8b5cf6',
  amber:  '#f59e0b',
  rose:   '#f43f5e',
  sky:    '#0ea5e9',
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

function nameOf(data: Record<string, unknown>): string {
  return String(data?.['Employee Name'] || data?.['Full Name'] || data?.['Name'] || 'Anonymous')
}
function initialsOf(name: string) {
  if (!name || name === 'Anonymous') return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Data types ───────────────────────────────────────────────────────────────
type Sub = {
  id?: string
  form_title: string | null
  submitted_at: string
  is_read: boolean
  status?: string
  data: Record<string, unknown>
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
type AuditLite = {
  id: string
  actor_name: string | null
  action: string
  summary: string
  created_at: string
}

// Dot color for an audit entry, keyed by its action family.
function auditColor(action: string): string {
  if (action.startsWith('form.delete') || action.startsWith('employee.deactivate')) return C.rose
  if (action.startsWith('form.pause')) return C.amber
  if (action.startsWith('form.')) return C.green
  if (action.startsWith('role.')) return C.violet
  if (action.startsWith('request.')) return C.amber
  if (action.startsWith('submission.')) return C.blue
  if (action.startsWith('ticket.')) return C.rose
  if (action.startsWith('accrual.')) return C.sky
  if (action.startsWith('employee.')) return C.green
  return T.inkFaint
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
    { count: pendingApprovals },
    { data: subSample },
    { data: tktSample },
    { data: recentSubs },
    { data: forms },
    { data: recentAudit },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('created_at', sevenDaysAgo),
    supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
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
      .limit(8),
    supabaseAdmin.from('forms').select('id,title,is_active,created_at').order('created_at', { ascending: false }),
    supabaseAdmin
      .from('audit_log')
      .select('id,actor_name,action,summary,created_at')
      .order('created_at', { ascending: false })
      .limit(6),
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

  // Top submitters
  const peopleMap = new Map<string, { name: string; count: number }>()
  for (const s of subs) {
    const name = nameOf(s.data)
    const email = String(s.data?.['Employee Email'] || s.data?.['Email'] || s.data?.['Email Address'] || '')
    const key = email || name
    if (!peopleMap.has(key)) peopleMap.set(key, { name, count: 0 })
    peopleMap.get(key)!.count++
  }
  const people = Array.from(peopleMap.values()).sort((a, b) => b.count - a.count)
  const maxPeople = Math.max(1, ...people.map((p) => p.count))

  // Form status (every form)
  const formStatus = (forms || []).map((f) => {
    const agg = formMap.get(f.title)
    return { title: f.title || 'Untitled form', active: f.is_active, count: agg?.count ?? 0, last: agg?.last ?? null }
  })

  // Unified activity feed (recent submissions + tickets, chronological)
  const recents = (recentSubs || []) as Sub[]
  const activity = [
    ...recents.map((s) => ({
      kind: 'sub' as const, id: s.id!, name: nameOf(s.data),
      label: s.form_title || 'Form submission', time: s.submitted_at, href: `/admin/submissions/${s.id}`,
    })),
    ...tkts.slice(0, 8).map((t) => ({
      kind: 'ticket' as const, id: t.id, name: t.customer_name || 'Unknown',
      label: `Ticket ${t.ticket_number}`, time: t.created_at, href: `/admin/tickets/${t.id}`,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8)

  // Eastern-time greeting + date (business is US Eastern)
  const hourET = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10)
  const dateET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })

  return {
    kpi: {
      totalSubs: totalSubs ?? 0, activeForms: activeForms ?? 0, unread: unread ?? 0,
      openTickets: openTickets ?? 0, resolved7d: resolved7d ?? 0,
    },
    donut: { open: openTickets ?? 0, inProgress: inProgress ?? 0, resolved: resolvedTotal ?? 0, total: totalTickets ?? 0 },
    attention: { unread: unread ?? 0, openTickets: openTickets ?? 0, pendingApprovals: pendingApprovals ?? 0 },
    days, subSeries, tktSeries, subDelta, tktDelta,
    formRows, maxFormCount, people, maxPeople, formStatus,
    recentSubs: recents, recentTickets: tkts.slice(0, 6), activeTitles,
    activity, hourET, dateET,
    recentAudit: (recentAudit || []) as AuditLite[],
  }
}

// ─── Inline chart — two-series area + line (14-day activity), token-aware ──────
function LineChart({ days, a, b, ca, cb }: {
  days: { label: string }[]; a: number[]; b?: number[]; ca: string; cb?: string
}) {
  const W = 620, H = 190, padL = 30, padR = 12, padT = 14, padB = 26
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(2, ...a, ...(b ?? []))
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
        <linearGradient id="tgradA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ca} stopOpacity="0.26" />
          <stop offset="100%" stopColor={ca} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tgradB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cb} stopOpacity="0.18" />
          <stop offset="100%" stopColor={cb} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => {
        const gy = padT + ih * g
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={T.hair} strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fill={T.inkFaint} fontSize="9">
              {Math.round(max * (1 - g))}
            </text>
          </g>
        )
      })}
      <path d={area(a)} fill="url(#tgradA)" />
      {b && <path d={area(b)} fill="url(#tgradB)" />}
      {b && cb && <path d={line(b)} fill="none" stroke={cb} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />}
      <path d={line(a)} fill="none" stroke={ca} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {a.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3 : 0} fill={ca} />)}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fill={T.inkFaint} fontSize="9">
          {days[t]?.label}
        </text>
      ))}
    </svg>
  )
}

const PRIORITY_DOT: Record<string, string> = { high: C.rose, med: C.amber, low: C.sky }
const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: C.rose,  bg: 'rgba(244,63,94,0.12)' },
  in_progress: { label: 'In Progress', color: C.amber, bg: 'rgba(245,158,11,0.14)' },
  resolved:    { label: 'Resolved',    color: C.green, bg: 'rgba(16,185,129,0.14)' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  // The admin layout already gates this page to admin-surface roles (loose:
  // full admin OR a scoped role). Scoped roles get their own department
  // dashboard — a real page scoped to their permissions, not a stripped-down
  // preview of the executive view below.
  const surfaceUser = await getAdminSurfaceUser()

  // "View as" preview: a full admin who set a va_role cookie sees the previewed
  // role's dashboard (read-only). This only swaps what RENDERS — access is still
  // gated by the real session role in middleware, so it can never grant reach.
  if (surfaceUser && surfaceUser.role === 'admin') {
    const vaRaw = (await cookies()).get('va_role')?.value
    const preview = vaRaw && vaRaw !== 'admin' && (STAFF_ROLES as readonly string[]).includes(vaRaw) ? (vaRaw as StaffRole) : null
    if (preview === 'sales') {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: deals }, { count: followUpsDue }] = await Promise.all([
        supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('deal_follow_ups').select('*', { count: 'exact', head: true }).eq('done', false).lte('due_date', today),
      ])
      return <SalesDashboardView deals={(deals ?? []) as Deal[]} displayName={surfaceUser.displayName} followUpsDue={followUpsDue ?? 0} />
    }
    if (preview === 'production') {
      return (
        <div className="flex-1 flex items-center justify-center bg-canvas p-8 min-h-0">
          <div className="max-w-sm text-center">
            <p className="text-[14px] font-semibold text-ink">Production staff</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">
              Base production staff land on the Company Home and use the employee tools — they don&apos;t have an operations dashboard.
            </p>
          </div>
        </div>
      )
    }
    if (preview) {
      return <DepartmentDashboard role={preview as Exclude<StaffRole, 'admin' | 'production'>} displayName={surfaceUser.displayName} userId={surfaceUser.user.id} preview />
    }
  }

  // Sales is the first department separated out from the generic scoped
  // dashboard: they get the dedicated Sales command center (live deal metrics),
  // not the stripped-down DepartmentDashboard. Admin + Engineering + the other
  // scoped roles keep their current dashboards until each gets its own.
  if (surfaceUser && surfaceUser.role === 'sales') {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: deals }, { count: followUpsDue }] = await Promise.all([
      supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('deal_follow_ups').select('*', { count: 'exact', head: true }).eq('done', false).lte('due_date', today),
    ])
    return <SalesDashboardView deals={(deals ?? []) as Deal[]} displayName={surfaceUser.displayName} followUpsDue={followUpsDue ?? 0} />
  }
  if (surfaceUser && surfaceUser.role !== 'admin') {
    // isAdminSurfaceRole (inside getAdminSurfaceUser) already ruled out
    // 'production' and 'customer', so this is one of the 5 scoped roles.
    return <DepartmentDashboard role={surfaceUser.role as Exclude<StaffRole, 'admin' | 'production'>} displayName={surfaceUser.displayName} userId={surfaceUser.user.id} />
  }

  const d = await getData()

  const attentionCount = d.attention.unread + d.attention.openTickets + d.attention.pendingApprovals

  // Per-admin dashboard layout preset (cookie-backed; read server-side → no flash).
  const presetRaw = (await cookies()).get(DASH_PRESET_COOKIE)?.value
  const preset: Preset = (PRESETS as readonly string[]).includes(presetRaw ?? '') ? (presetRaw as Preset) : 'balanced'

  // Logged-in admin's first name for the greeting.
  const firstName = (surfaceUser?.displayName ?? '').trim().split(/[\s.]+/)[0]
  const firstNameDisplay = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : ''

  const deltaSub = (n: number, tail: string) => `${n >= 0 ? '+' : ''}${n} ${tail}`

  // KPI cards defined once, placed in two layouts (mobile grid vs. xl split) below.
  const kpiTotal = (
    <Link href="/admin/submissions" className="block">
      <Kpi tone="sky" label="Total Submissions" value={fmt(d.kpi.totalSubs)} sub={deltaSub(d.subDelta, 'vs last week')} icon={<ClipboardList size={16} />} />
    </Link>
  )
  const kpiForms = (
    <Link href="/admin/forms" className="block">
      <Kpi tone="violet" label="Active Forms" value={fmt(d.kpi.activeForms)} sub="Published & accepting input" icon={<FileText size={16} />} />
    </Link>
  )
  const kpiUnread = (
    <Link href="/admin/submissions?is_read=false" className="block">
      <Kpi tone="amber" label="Unread" value={fmt(d.kpi.unread)} sub="Submissions awaiting review" icon={<Inbox size={16} />} />
    </Link>
  )
  const kpiOpen = (
    <Link href="/admin/tickets" className="block">
      <Kpi tone="rose" label="Open Tickets" value={fmt(d.kpi.openTickets)} sub={deltaSub(d.tktDelta, 'intake vs last week')} icon={<Ticket size={16} />} />
    </Link>
  )
  const kpiResolved = (
    <Link href="/admin/tickets" className="block">
      <Kpi tone="emerald" label="Resolved" value={fmt(d.kpi.resolved7d)} sub="Tickets closed in last 7 days" icon={<CheckCircle2 size={16} />} />
    </Link>
  )
  const kpiInProgress = (
    <Link href="/admin/tickets" className="block">
      <Kpi tone="slate" label="In Progress" value={fmt(d.donut.inProgress)} sub="Tickets being worked" icon={<Clock size={16} />} />
    </Link>
  )

  return (
    <div className="relative isolate flex-1 overflow-y-auto overflow-x-hidden bg-canvas text-ink-secondary min-h-0">
      {/* Ambient background — a soft, very transparent gradient orb behind the
          dashboard content. `isolate` makes THIS scroll container own the
          stacking context, so the `-z-10` orb below paints over the container's
          own opaque bg instead of dropping behind it (the classic negative-z
          "disappears behind the parent background" trap). Purely decorative +
          static (no motion, per the calm-design convention). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
        <div className="absolute -top-44 right-[-120px] w-[620px] h-[620px] rounded-full bg-gradient-to-br from-emerald-400/25 via-emerald-500/10 to-transparent blur-3xl dark:from-emerald-500/20 dark:via-emerald-600/8" />
        <div className="absolute top-16 -left-32 w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-sky-400/15 via-teal-400/8 to-transparent blur-3xl dark:from-sky-500/14 dark:via-teal-500/7" />
      </div>

      {/* The operations top bar (breadcrumb · search · view-switcher · bell ·
          avatar) now lives in app/admin/layout.tsx as the shared AdminTopBar, so
          every /admin page carries it. The view-switcher shows only here. */}

      <div className="p-5 space-y-6 animate-fade-up">

        {/* ── AI Executive Briefing — plain-English read of the operation ── */}
        <ExecutiveBriefing />

        {/* ── KPI metric cards ─────────────────────────────────────────
             Balanced shows all 5 here (4 + Resolved atop the rail). Tickets /
             Submissions render their KPI row inside the left column below, so the
             rail rises to meet the top row instead of leaving a gap beside it. */}
        {preset === 'balanced' && (
          <>
            {/* below xl: all 5 in a responsive grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 xl:hidden">
              {kpiTotal}{kpiForms}{kpiUnread}{kpiOpen}{kpiResolved}
            </div>
            {/* xl+: 4 in the left zone, Resolved atop the rail column */}
            <div className="hidden xl:flex gap-4 items-stretch">
              <div className="flex-1 min-w-0 grid grid-cols-4 gap-3">
                {kpiTotal}{kpiForms}{kpiUnread}{kpiOpen}
              </div>
              <div className="w-[330px] flex-shrink-0">{kpiResolved}</div>
            </div>
          </>
        )}

        {/* ── Main + creative right rail ───────────────────────────── */}
        <div className="flex gap-4 items-start">
          {preset === 'balanced' ? (
            <MainBalanced d={d} />
          ) : (
            /* Tickets / Submissions: the KPI row + main share the left column, so
               the rail (right) starts at the same top row instead of dropping a row. */
            <div className="flex-1 min-w-0 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {preset === 'tickets'
                  ? <>{kpiOpen}{kpiInProgress}{kpiResolved}</>
                  : <>{kpiTotal}{kpiForms}{kpiUnread}</>}
              </div>
              {preset === 'tickets' ? <MainTickets d={d} /> : <MainSubmissions d={d} />}
            </div>
          )}

          {/* ── Creative right rail: Operations Pulse ──────────────── */}
          <aside className="hidden xl:flex flex-col gap-4 w-[330px] flex-shrink-0 sticky top-[72px]">

            {/* Greeting — warm surface card with the emerald brand glow (mirrors
                the shipped PortalHero warmth), token-driven for light + dark. */}
            <section className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-5">
              <div
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-[0.18] blur-3xl dark:opacity-25"
                style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
              />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{d.dateET}</p>
                <h2 className="mt-1 text-[20px] font-semibold text-ink leading-tight tracking-[-0.02em]">
                  {greeting(d.hourET)}{firstNameDisplay ? `, ${firstNameDisplay}` : ''}
                </h2>
                <p className="mt-1.5 text-[12px] text-ink-secondary leading-relaxed">
                  {attentionCount > 0
                    ? <>You have <span className="font-semibold text-ink">{attentionCount}</span> item{attentionCount === 1 ? '' : 's'} that need attention.</>
                    : <>Everything is handled. Nice work. <Sparkles size={12} className="inline -mt-0.5 text-emerald-600 dark:text-emerald-400" /></>}
                </p>
              </div>
            </section>

            {/* Needs attention */}
            <Card>
              <CardHead title="Needs Attention" icon={<AlertCircle size={13} />} iconTone="amber" />
              <div className="p-2">
                <AttentionRow icon={<Inbox size={15} />} color={C.amber} label="Unread submissions" value={d.attention.unread} href="/admin/submissions?is_read=false" />
                <AttentionRow icon={<Ticket size={15} />} color={C.rose} label="Open tickets" value={d.attention.openTickets} href="/admin/tickets" />
                <AttentionRow icon={<ShieldCheck size={15} />} color={C.violet} label="Forms pending approval" value={d.attention.pendingApprovals} href="/admin/forms" />
              </div>
              {attentionCount === 0 && (
                <div className="px-5 pb-4 -mt-1">
                  <div className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> All clear — you&apos;re caught up.
                  </div>
                </div>
              )}
            </Card>

            {/* Live activity */}
            <Card>
              <CardHead title="Live Activity" icon={<Sparkles size={13} />} iconTone="emerald" />
              <div className="px-5 py-4">
                {d.activity.length === 0 ? (
                  <p className="text-[12px] text-ink-muted text-center py-4">No recent activity</p>
                ) : (
                  <ol className="relative space-y-3.5">
                    <span className="absolute left-[11px] top-1 bottom-1 w-px bg-hairline" aria-hidden />
                    {d.activity.map((e) => (
                      <li key={`${e.kind}-${e.id}`}>
                        <Link href={e.href} className="group flex gap-3 items-start">
                          <span className="relative z-10 mt-0.5 w-[23px] h-[23px] rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-surface"
                            style={{ backgroundColor: e.kind === 'sub' ? 'rgba(16,185,129,0.14)' : 'rgba(244,63,94,0.14)', color: e.kind === 'sub' ? C.green : C.rose }}>
                            {e.kind === 'sub' ? <Inbox size={12} /> : <Ticket size={12} />}
                          </span>
                          <div className="flex-1 min-w-0 -mt-px">
                            <p className="text-[12px] text-ink-secondary leading-snug">
                              <span className="font-semibold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{e.name}</span>
                              {e.kind === 'sub' ? ' submitted ' : ' opened '}
                              <span className="text-ink-muted">{e.label}</span>
                            </p>
                            <p className="text-[10px] text-ink-faint tabular-nums mt-0.5">{timeAgo(e.time)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>

            {/* Admin activity (audit trail) — flat/borderless so only primary cards read as elevated */}
            <Card className="!border-transparent !bg-transparent">
              <CardHead title="Admin Activity" icon={<ShieldCheck size={13} />} iconTone="slate" action="Full log" href="/admin/audit" />
              <div className="px-5 py-4">
                {d.recentAudit.length === 0 ? (
                  <p className="text-[12px] text-ink-muted text-center py-3">No admin actions logged yet</p>
                ) : (
                  <ul className="space-y-3">
                    {d.recentAudit.map((a) => (
                      <li key={a.id} className="flex gap-2.5 items-start">
                        <span className="mt-[5px] w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: auditColor(a.action) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-ink-secondary leading-snug line-clamp-2">{a.summary}</p>
                          <p className="text-[10px] text-ink-faint tabular-nums mt-0.5">
                            {a.actor_name || 'Unknown'} · {timeAgo(a.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            {/* Quick actions — flat/borderless so only primary cards read as elevated */}
            <Card className="!border-transparent !bg-transparent">
              <CardHead title="Quick Actions" icon={<Plus size={13} />} />
              <div className="p-3 grid grid-cols-2 gap-2">
                <QuickAction icon={<Plus size={15} />} label="New Form" href="/admin/forms/new" />
                <QuickAction icon={<Inbox size={15} />} label="Review Unread" href="/admin/submissions?is_read=false" />
                <QuickAction icon={<Ticket size={15} />} label="Open Tickets" href="/admin/tickets" />
                <QuickAction icon={<Users size={15} />} label="Employees" href="/admin/employees" />
              </div>
            </Card>
          </aside>
        </div>

        <p className="text-[11px] text-ink-faint text-center pt-1 pb-4">
          Live data from your Supabase instance · refreshed on each load
        </p>
      </div>
    </div>
  )
}

// ─── Misc presentational ──────────────────────────────────────────────────────
function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function LegendInline({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function RankRow({ rank, label, value, pct: barPct, color }: { rank: number; label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-ink-faint w-3 tabular-nums">{rank}</span>
      <span className="text-[12px] text-ink-secondary truncate flex-1 min-w-0">{label}</span>
      <div className="w-28 h-1.5 rounded-full bg-surface-strong overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold text-ink tabular-nums w-10 text-right">{fmt(value)}</span>
    </div>
  )
}

function AttentionRow({ icon, color, label, value, href }: { icon: React.ReactNode; color: string; label: string; value: number; href: string }) {
  const has = value > 0
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-soft transition-colors group">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1f`, color }}>{icon}</span>
      <span className="flex-1 text-[12px] font-medium text-ink-secondary group-hover:text-ink transition-colors">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums" style={{ color: has ? color : undefined }}>
        <span className={has ? '' : 'text-ink-faint'}>{value}</span>
      </span>
      <ArrowRight size={13} className="text-ink-faint group-hover:text-ink-muted transition-colors" />
    </Link>
  )
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-start gap-2 p-3 rounded-lg border border-hairline hover:border-brand hover:bg-brand-soft transition-colors group">
      <span className="text-ink-faint group-hover:text-brand-ink transition-colors">{icon}</span>
      <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
    </Link>
  )
}

// ─── Dashboard widgets (one source per card; arranged differently per preset) ──
type DashData = Awaited<ReturnType<typeof getData>>
type WProps = { d: DashData; className?: string }

function WFormsPerformance({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Forms Performance" icon={<FileText size={13} />} iconTone="sky" action="View all" href="/admin/forms" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-5">Form</div>
        <div className="col-span-1 text-right">Subs</div>
        <div className="col-span-1 text-right">7d</div>
        <div className="col-span-1 text-right">Unread</div>
        <div className="col-span-2">Share</div>
        <div className="col-span-2 text-right">Last activity</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.formRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No submissions yet</div>
        ) : (
          d.formRows.slice(0, 7).map((f) => {
            const active = d.activeTitles.has(f.title)
            return (
              <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: active ? C.green : T.inkFaint }} />
                  <span className="font-medium text-ink truncate">{f.title}</span>
                </div>
                <div className="col-span-1 text-right tabular-nums text-ink-secondary">{fmt(f.count)}</div>
                <div className="col-span-1 text-right tabular-nums text-ink-muted">{f.week}</div>
                <div className="col-span-1 text-right tabular-nums">
                  {f.unread > 0 ? <span className="text-amber-600 dark:text-amber-400">{f.unread}</span> : <span className="text-ink-faint">0</span>}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(f.count / d.maxFormCount) * 100}%`, backgroundColor: C.sky }} />
                  </div>
                </div>
                <div className="col-span-2 text-right text-ink-muted tabular-nums">{timeAgo(f.last)}</div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

function WTicketsDonut({ d, className }: WProps) {
  const segs = [
    { value: d.donut.resolved, color: C.green },
    { value: d.donut.inProgress, color: C.amber },
    { value: d.donut.open, color: C.rose },
  ]
  const base = Math.max(1, d.donut.resolved + d.donut.inProgress + d.donut.open)
  const legend: LegendItem[] = [
    { label: 'Resolved', color: C.green, valueText: fmt(d.donut.resolved), pctText: `${pct(d.donut.resolved, base)}%` },
    { label: 'In Progress', color: C.amber, valueText: fmt(d.donut.inProgress), pctText: `${pct(d.donut.inProgress, base)}%` },
    { label: 'Open', color: C.rose, valueText: fmt(d.donut.open), pctText: `${pct(d.donut.open, base)}%` },
  ]
  return (
    <Card className={className}>
      <CardHead title="Tickets by Status" icon={<Ticket size={13} />} iconTone="rose" />
      <CardBody className="flex items-center gap-5 px-5 py-5">
        <Donut segments={segs} centerTop={fmt(d.donut.total)} centerSub="TICKETS" size={150} stroke={16} />
        <DonutLegend items={legend} />
      </CardBody>
    </Card>
  )
}

function WTopForms({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Top Forms by Volume" icon={<FileText size={13} />} iconTone="emerald" />
      <div className="px-5 py-4 space-y-3">
        {d.formRows.slice(0, 5).map((f, i) => (
          <RankRow key={f.title} rank={i + 1} label={f.title} value={f.count} pct={(f.count / d.maxFormCount) * 100} color={T.brand} />
        ))}
        {d.formRows.length === 0 && <p className="text-[13px] text-ink-muted py-4 text-center">No data yet</p>}
      </div>
    </Card>
  )
}

function WTopSubmitters({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Top Submitters" icon={<Inbox size={13} />} iconTone="violet" action="People" href="/admin/employees" />
      <div className="px-5 py-4 space-y-3">
        {d.people.slice(0, 5).map((p, i) => (
          <RankRow key={p.name + i} rank={i + 1} label={p.name} value={p.count} pct={(p.count / d.maxPeople) * 100} color={T.brand} />
        ))}
        {d.people.length === 0 && <p className="text-[13px] text-ink-muted py-4 text-center">No data yet</p>}
      </div>
    </Card>
  )
}

function WActivityChart({ d, view = 'both', className }: WProps & { view?: 'both' | 'tickets' | 'submissions' }) {
  const title =
    view === 'tickets' ? 'Ticket Intake · Last 14 days'
    : view === 'submissions' ? 'Submissions · Last 14 days'
    : 'Activity · Last 14 days'
  return (
    <Card className={className}>
      <div className="flex items-center gap-2 px-4 h-9 border-b border-hairline-soft">
        <h3 className="text-[12px] font-semibold text-ink tracking-[-0.006em] truncate">{title}</h3>
        <div className="ml-auto flex items-center gap-4">
          {view !== 'tickets' && <LegendInline color={C.green} label="Submissions" />}
          {view !== 'submissions' && <LegendInline color={C.rose} label="Tickets" />}
        </div>
      </div>
      <div className="px-3 py-4">
        {view === 'tickets'
          ? <LineChart days={d.days} a={d.tktSeries} ca={C.rose} />
          : view === 'submissions'
          ? <LineChart days={d.days} a={d.subSeries} ca={C.green} />
          : <LineChart days={d.days} a={d.subSeries} b={d.tktSeries} ca={C.green} cb={C.rose} />}
      </div>
    </Card>
  )
}

function WRecentSubmissions({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Recent Submissions" icon={<Inbox size={13} />} iconTone="emerald" action="View all" href="/admin/submissions" />
      <div className="divide-y divide-hairline-soft">
        {d.recentSubs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">Nothing yet</div>
        ) : (
          d.recentSubs.map((s) => {
            const name = nameOf(s.data)
            return (
              <Link key={s.id} href={`/admin/submissions/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-soft transition-colors">
                <div className="w-8 h-8 rounded-full bg-surface-strong flex items-center justify-center text-[11px] font-semibold text-ink-muted flex-shrink-0">
                  {initialsOf(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink truncate">{name}</p>
                  <p className="text-[11px] text-ink-muted truncate">{s.form_title || 'Form submission'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-ink-muted tabular-nums">{timeAgo(s.submitted_at)}</span>
                  {!s.is_read && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} />}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </Card>
  )
}

function WRecentTickets({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Recent Tickets" icon={<Ticket size={13} />} iconTone="rose" action="View all" href="/admin/tickets" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-4">Customer</div>
        <div className="col-span-3">Equipment</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">Age</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.recentTickets.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No tickets yet</div>
        ) : (
          d.recentTickets.map((t) => {
            const sp = STATUS_PILL[t.status] || STATUS_PILL.open
            return (
              <Link key={t.id} href={`/admin/tickets/${t.id}`} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
                <div className="col-span-4 min-w-0">
                  <p className="font-medium text-ink truncate">{t.customer_name}</p>
                  <p className="text-[10px] text-ink-muted truncate">{t.ticket_number}</p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-ink-secondary truncate">{t.model_number || '—'}</p>
                  <p className="text-[10px] text-ink-faint truncate">{t.serial_number ? `S/N ${t.serial_number}` : ''}</p>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[t.priority ?? 'med'] || C.amber }} />
                    {t.priority ?? 'med'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sp.color, backgroundColor: sp.bg }}>{sp.label}</span>
                </div>
                <div className="col-span-1 text-right text-ink-muted tabular-nums">{timeAgo(t.created_at)}</div>
              </Link>
            )
          })
        )}
      </div>
    </Card>
  )
}

function WFormStatus({ d, className }: WProps) {
  return (
    <Card className={className}>
      <CardHead title="Form Status" icon={<FileText size={13} />} iconTone="slate" action="Manage" href="/admin/forms" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-6">Form</div>
        <div className="col-span-2 text-right">Subs</div>
        <div className="col-span-2">State</div>
        <div className="col-span-2 text-right">Last</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.formStatus.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No forms yet</div>
        ) : (
          d.formStatus.slice(0, 6).map((f) => (
            <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
              <div className="col-span-6 font-medium text-ink truncate">{f.title}</div>
              <div className="col-span-2 text-right tabular-nums text-ink-secondary">{fmt(f.count)}</div>
              <div className="col-span-2">
                {f.active ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: C.green }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} /> Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.inkFaint }} /> Draft
                  </span>
                )}
              </div>
              <div className="col-span-2 text-right text-ink-muted tabular-nums">{f.last ? timeAgo(f.last) : '—'}</div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

// ─── Layout presets — each composes the same widgets in a different order ──────
function MainBalanced({ d }: { d: DashData }) {
  return (
    <main className="flex-1 min-w-0 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><WFormsPerformance d={d} className="lg:col-span-2" /><WTicketsDonut d={d} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><WTopForms d={d} /><WTopSubmitters d={d} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><WActivityChart d={d} className="lg:col-span-2" /><WRecentSubmissions d={d} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><WRecentTickets d={d} /><WFormStatus d={d} /></div>
    </main>
  )
}

// Tickets preset — ticket metrics only (intake trend, status mix, recent queue).
function MainTickets({ d }: { d: DashData }) {
  return (
    <main className="flex-1 min-w-0 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><WActivityChart d={d} view="tickets" className="lg:col-span-2" /><WTicketsDonut d={d} /></div>
      <WRecentTickets d={d} />
    </main>
  )
}

// Submissions preset — form & submission metrics only (no ticket cards).
function MainSubmissions({ d }: { d: DashData }) {
  return (
    <main className="flex-1 min-w-0 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><WFormsPerformance d={d} className="lg:col-span-2" /><WRecentSubmissions d={d} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><WTopForms d={d} /><WTopSubmitters d={d} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><WActivityChart d={d} view="submissions" className="lg:col-span-2" /><WFormStatus d={d} /></div>
    </main>
  )
}
