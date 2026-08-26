import Link from 'next/link'
import { cache } from 'react'
import type { LucideIcon } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_SECTIONS, hasPermission, ROLE_LABELS, ROLE_DESCRIPTIONS, type StaffRole, type Perm, type PermMatrix } from '@/lib/roles'
import type { Tone } from '@/components/admin/list'
import {
  pct, Card, CardHead, CardBody, Kpi, Donut, DonutLegend, type LegendItem,
} from '@/components/dashboards/sales-charts'
import {
  ArrowRight, Ticket, Boxes, Building2, Clock, Inbox, Sparkles,
  Calendar, Users, FileText, Presentation, CalendarRange, DollarSign, CalendarClock,
  MessageSquare, LayoutGrid, Compass, ClipboardList, CheckCircle2, AlertCircle,
  DraftingCompass,
} from 'lucide-react'
import type { ExecData } from '@/lib/exec-dashboard-data'
import { getMyRfqs, type MyRfqSummary } from '@/lib/rfq-mine'
import {
  FormsPerformanceCard, TopFormsCard, TopSubmittersCard, ActivityCard,
  FormStatusCard, NeedsAttentionCard, LiveActivityCard, AdminActivityCard, AttentionRow,
} from '@/components/dashboards/exec-cards'
import {
  EngStatusCard, EngRiskCard, EngMyWorkCard, EngLoadCard, getEngCardData,
} from '@/components/dashboards/eng-cards'

/* ────────────────────────────────────────────────────────────────────────────
   Department-dashboard CARD REGISTRY — the catalog behind both the default
   department dashboards and the per-user "build your own dashboard" editor.

   Each card is a self-contained async renderer (loads its own data + returns
   JSX), gated by a permission, with an allowed set of grid spans (S/M/L). The
   dashboard renders every card the role can access up front and hands the nodes
   to the client grid, which shows/reorders/resizes them per the user's saved
   layout (or the code default). All visuals reuse the shared sales-charts
   primitives + semantic tokens — same warm bento as the exec + Sales dashboards.
   ──────────────────────────────────────────────────────────────────────────── */

// Includes 'admin' (the exec dashboard is now the same customizable card grid);
// excludes 'production' (base tier has no ops dashboard) — sales has its own view.
export type DeptRole = Exclude<StaffRole, 'production'>
export type Span = 1 | 2 | 3
export type QuickLink = { href: string; label: string; perm: string }
export type LayoutItem = { id: string; span: Span }
// userId added 2026-08-15 for the 'my_rfqs' card — the first card that shows
// the VIEWER their own work rather than a department-wide roll-up.
export type CardCtx = {
  role: DeptRole; can: (p: Perm) => boolean; headcount: number; quickLinks: QuickLink[]
  userId: string
  /** employees.id for the signed-in person, or null when their account has no
   *  matching row. Resolved once in DepartmentDashboard — see lib/my-employee.ts
   *  for why email is the only join. */
  myEmployeeId: string | null
  execData?: ExecData
}

export type CardDef = {
  id: string
  title: string
  perm?: Perm
  defaultSpan: Span
  sizes: Span[]
  available: (ctx: CardCtx) => boolean
  Component: (ctx: CardCtx) => Promise<React.ReactNode>
}

/** Card metadata + its server-rendered node, handed to the client grid. */
export type RenderedCard = { id: string; title: string; defaultSpan: Span; sizes: Span[]; node: React.ReactNode }

const TONE_HEX: Record<'emerald' | 'sky' | 'rose' | 'amber' | 'violet', string> = {
  emerald: '#10b981', sky: '#0ea5e9', rose: '#f43f5e', amber: '#f59e0b', violet: '#8b5cf6',
}
const HEAD = { count: 'exact' as const, head: true }

// ─── Quick-link resolution ────────────────────────────────────────────────────
const SECTION_ICON: Partial<Record<string, LucideIcon>> = {
  submissions: Inbox, tickets: Ticket, equipment: Boxes, customers: Building2, deals: DollarSign, gantt: CalendarRange,
  org_chart: Users, forms: FileText, employee_forms: FileText, pto: Calendar, sick: Clock,
  scheduling: Calendar, accrual: Clock, presentations: Presentation, employees: Users,
  jerry: MessageSquare, tools: LayoutGrid, engineering_jobs: DraftingCompass,
}
// Jerry + the Internal Apps launcher live outside ADMIN_SECTIONS but every scoped
// role holds their perms, so thin departments still get a fuller link grid.
const EXTRA_LINKS: { perm: Perm; href: string; label: string }[] = [
  { perm: 'jerry', href: '/admin/jerry', label: 'Jerry' },
  { perm: 'tools', href: '/admin/tools', label: 'Internal Apps' },
]

export function computeQuickLinks(role: DeptRole, matrix: PermMatrix): QuickLink[] {
  const can = (perm: Perm) => hasPermission(role, perm, matrix)
  return [
    ...ADMIN_SECTIONS.filter((s) => can(s.perm)).map((s) => ({
      href: s.href, perm: s.perm as string, label: s.href.split('/').pop()?.replace(/-/g, ' ') ?? s.perm,
    })),
    ...EXTRA_LINKS.filter((l) => can(l.perm)).map((l) => ({ href: l.href, perm: l.perm as string, label: l.label })),
  ]
}

// ─── Shared data loaders ──────────────────────────────────────────────────────
type StatDef = { label: string; value: number; tone: Tone; icon: React.ReactNode; href?: string }

const STAT_WIDGETS: { perm: Perm; build: () => Promise<StatDef[]> }[] = [
  {
    perm: 'tickets',
    build: async () => {
      const [{ count: open }, { count: prog }] = await Promise.all([
        supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'open'),
        supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'in_progress'),
      ])
      return [
        { label: 'Open Tickets', value: open ?? 0, tone: 'rose', icon: <Ticket size={16} />, href: '/admin/tickets' },
        { label: 'In Progress', value: prog ?? 0, tone: 'amber', icon: <Clock size={16} />, href: '/admin/tickets' },
      ]
    },
  },
  { perm: 'submissions', build: async () => {
      const { count } = await supabaseAdmin.from('submissions').select('*', HEAD).eq('is_read', false)
      return [{ label: 'Unread Submissions', value: count ?? 0, tone: 'amber', icon: <Inbox size={16} />, href: '/admin/submissions?is_read=false' }]
    } },
  { perm: 'deals', build: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabaseAdmin.from('deal_follow_ups').select('*', HEAD).eq('done', false).lte('due_date', today)
      return [{ label: 'Follow-ups Due', value: count ?? 0, tone: 'amber', icon: <CalendarClock size={16} />, href: '/admin/deals' }]
    } },
  { perm: 'customers', build: async () => {
      const { count } = await supabaseAdmin.from('customers').select('*', HEAD)
      return [{ label: 'Customers', value: count ?? 0, tone: 'sky', icon: <Building2 size={16} />, href: '/admin/customers' }]
    } },
  { perm: 'equipment', build: async () => {
      const { count } = await supabaseAdmin.from('equipment').select('*', HEAD)
      return [{ label: 'Equipment Units', value: count ?? 0, tone: 'emerald', icon: <Boxes size={16} />, href: '/admin/equipment' }]
    } },
  { perm: 'pto', build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'pto').eq('status', 'pending')
      return [{ label: 'PTO Pending', value: count ?? 0, tone: 'amber', icon: <Calendar size={16} />, href: '/admin/requests/pto' }]
    } },
  { perm: 'sick', build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'sick').eq('status', 'pending')
      return [{ label: 'Sick Pending', value: count ?? 0, tone: 'violet', icon: <Clock size={16} />, href: '/admin/requests/sick' }]
    } },
  { perm: 'forms', build: async () => {
      const { count } = await supabaseAdmin.from('forms').select('*', HEAD).eq('is_active', true)
      return [{ label: 'Active Forms', value: count ?? 0, tone: 'emerald', icon: <FileText size={16} />, href: '/admin/forms' }]
    } },
  { perm: 'engineering_jobs', build: async () => {
      // Two tiles, and the second is the one that matters. "Open" is volume;
      // "past due" is the number the whole section exists to drive to zero. The
      // plain overdue count (the date has passed), NOT the projection — a KPI
      // strip is read at a glance and must not disagree with the nav badge,
      // which counts the same way for the same reason.
      const today = new Date().toISOString().slice(0, 10)
      const OPEN = ['not_started', 'in_progress', 'blocked']
      const [{ count: open }, { count: late }] = await Promise.all([
        supabaseAdmin.from('eng_tasks').select('*', HEAD).in('status', OPEN),
        supabaseAdmin.from('eng_tasks').select('*', HEAD).in('status', OPEN).lt('due_date', today),
      ])
      return [
        { label: 'Engineering Tasks', value: open ?? 0, tone: 'sky', icon: <DraftingCompass size={16} />, href: '/admin/engineering/tasks' },
        { label: 'Past Due', value: late ?? 0, tone: 'rose', icon: <AlertCircle size={16} />, href: '/admin/engineering/tasks' },
      ]
    } },
  { perm: 'presentations', build: async () => {
      const { count } = await supabaseAdmin.from('presentations').select('*', HEAD)
      return [{ label: 'Presentations', value: count ?? 0, tone: 'violet', icon: <Presentation size={16} />, href: '/admin/presentations' }]
    } },
]

type RecentRow = { id: string; primary: string; secondary: string; href: string; tone?: 'amber' | 'emerald' | 'rose' | 'zinc' }
type RecentList = { title: string; rows: RecentRow[]; emptyLabel: string; viewAllHref?: string; icon: React.ReactNode; iconTone: Tone }

const RECENT_LOADERS: Record<'tickets' | 'submissions' | 'timeoff' | 'presentations', () => Promise<RecentList>> = {
  tickets: async () => {
    const { data } = await supabaseAdmin.from('tickets').select('id,ticket_number,customer_name,status,created_at').order('created_at', { ascending: false }).limit(6)
    return {
      title: 'Recent Tickets', viewAllHref: '/admin/tickets', emptyLabel: 'No tickets yet', icon: <Ticket size={13} />, iconTone: 'rose',
      rows: (data ?? []).map((t) => ({
        id: t.id, primary: t.customer_name || 'Unknown', secondary: `${t.ticket_number} · ${String(t.status).replace('_', ' ')}`,
        href: `/admin/tickets/${t.id}`, tone: t.status === 'open' ? 'rose' : t.status === 'in_progress' ? 'amber' : 'emerald',
      })),
    }
  },
  submissions: async () => {
    const { data } = await supabaseAdmin.from('submissions').select('id,form_title,submitted_at,is_read').order('submitted_at', { ascending: false }).limit(6)
    return {
      title: 'Recent Submissions', viewAllHref: '/admin/submissions', emptyLabel: 'No submissions yet', icon: <Inbox size={13} />, iconTone: 'emerald',
      rows: (data ?? []).map((s) => ({
        id: s.id, primary: s.form_title || 'Form submission', secondary: s.is_read ? 'Read' : 'Unread',
        href: `/admin/submissions/${s.id}`, tone: s.is_read ? 'zinc' : 'emerald',
      })),
    }
  },
  timeoff: async () => {
    const { data } = await supabaseAdmin.from('time_off_requests').select('id,type,status,created_at,employee:employees(name)').order('created_at', { ascending: false }).limit(6)
    return {
      title: 'Recent Time Off', viewAllHref: '/admin/requests/pto', emptyLabel: 'No requests yet', icon: <Calendar size={13} />, iconTone: 'amber',
      rows: (data ?? []).map((r) => {
        const employee = Array.isArray(r.employee) ? r.employee[0] : r.employee
        return {
          id: r.id, primary: employee?.name || 'Unknown', secondary: `${r.type === 'pto' ? 'PTO' : 'Sick'} · ${r.status}`,
          href: `/admin/requests/${r.type}`, tone: r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'emerald' : 'rose',
        }
      }),
    }
  },
  presentations: async () => {
    const { data } = await supabaseAdmin.from('presentations').select('id,title,status,updated_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(6)
    return {
      title: 'Recent Presentations', viewAllHref: '/admin/presentations', emptyLabel: 'No presentations yet', icon: <Presentation size={13} />, iconTone: 'violet',
      rows: (data ?? []).map((p) => ({
        id: p.id, primary: p.title || 'Untitled deck', secondary: p.status === 'saved' ? 'Saved' : 'In progress',
        href: `/admin/presentations/${p.id}`, tone: p.status === 'saved' ? 'emerald' : 'amber',
      })),
    }
  },
}

// ─── Card body components ─────────────────────────────────────────────────────
const TONE_DOT: Record<NonNullable<RecentRow['tone']>, string> = {
  amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', zinc: 'bg-slate-300 dark:bg-slate-600',
}

function MetricsStrip({ stats }: { stats: StatDef[] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {stats.map((s) => {
        const tile = <Kpi tone={s.tone} label={s.label} value={s.value.toLocaleString()} icon={s.icon} />
        return s.href
          ? <Link key={s.label} href={s.href} className="flex-1 min-w-[180px] block">{tile}</Link>
          : <div key={s.label} className="flex-1 min-w-[180px]">{tile}</div>
      })}
    </div>
  )
}

function RecentCard({ recent }: { recent: RecentList }) {
  return (
    <Card className="h-full">
      <CardHead title={recent.title} icon={recent.icon} iconTone={recent.iconTone} action={recent.viewAllHref ? 'View all' : undefined} href={recent.viewAllHref} />
      <div className="divide-y divide-hairline-soft">
        {recent.rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">{recent.emptyLabel}</div>
        ) : (
          recent.rows.map((r) => (
            <Link key={r.id} href={r.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-soft transition-colors group">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.tone ? TONE_DOT[r.tone] : TONE_DOT.zinc}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-ink truncate">{r.primary}</p>
                <p className="text-[11px] text-ink-muted truncate capitalize">{r.secondary}</p>
              </div>
              <ArrowRight size={13} className="text-ink-faint group-hover:text-ink-muted transition-colors flex-shrink-0" />
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}

function TicketsDonutCard({ status }: { status: { open: number; prog: number; res: number } }) {
  const segs = [
    { value: status.res, color: TONE_HEX.emerald },
    { value: status.prog, color: TONE_HEX.amber },
    { value: status.open, color: TONE_HEX.rose },
  ]
  const total = status.open + status.prog + status.res
  const base = Math.max(1, total)
  const legend: LegendItem[] = [
    { label: 'Resolved', color: TONE_HEX.emerald, valueText: status.res.toLocaleString(), pctText: `${pct(status.res, base)}%` },
    { label: 'In Progress', color: TONE_HEX.amber, valueText: status.prog.toLocaleString(), pctText: `${pct(status.prog, base)}%` },
    { label: 'Open', color: TONE_HEX.rose, valueText: status.open.toLocaleString(), pctText: `${pct(status.open, base)}%` },
  ]
  return (
    <Card className="h-full">
      <CardHead title="Tickets by Status" icon={<Ticket size={13} />} iconTone="rose" />
      <CardBody className="flex items-center gap-5 px-5 py-5">
        <Donut segments={segs} centerTop={total.toLocaleString()} centerSub="TICKETS" size={140} stroke={15} />
        <DonutLegend items={legend} />
      </CardBody>
    </Card>
  )
}

function QuickLinksCard({ links }: { links: QuickLink[] }) {
  return (
    <Card className="h-full">
      <CardHead title="Quick Links" icon={<Compass size={13} />} iconTone="sky" />
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {links.map((l) => {
          const Icon = SECTION_ICON[l.perm] ?? FileText
          return (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-start gap-2 p-3 rounded-lg border border-hairline hover:border-brand hover:bg-brand-soft transition-colors group">
              <span className="text-ink-faint group-hover:text-brand-ink transition-colors"><Icon size={15} /></span>
              <span className="text-[12px] font-medium text-ink-secondary capitalize">{l.label}</span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

function SnapshotCard({ role, headcount, toolCount }: { role: DeptRole; headcount: number; toolCount: number }) {
  return (
    <Card className="h-full">
      <CardHead title="Your Workspace" icon={<Sparkles size={13} />} iconTone="emerald" />
      <CardBody className="p-4 flex flex-col gap-3">
        <p className="text-[12px] text-ink-secondary leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">Team</p>
            <p className="text-[18px] font-semibold text-ink tabular-nums leading-tight">{headcount.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">Your tools</p>
            <p className="text-[18px] font-semibold text-ink tabular-nums leading-tight">{toolCount.toLocaleString()}</p>
          </div>
        </div>
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Everything you need for {ROLE_LABELS[role].toLowerCase()} in one place — jump in from the links above.
        </p>
      </CardBody>
    </Card>
  )
}

// ─── The registry ─────────────────────────────────────────────────────────────
async function loadStats(ctx: CardCtx): Promise<StatDef[]> {
  // Admin gets the executive KPI set (from the shared exec batch), not the
  // perm-gated department tiles.
  if (ctx.role === 'admin' && ctx.execData) {
    const e = ctx.execData
    return [
      { label: 'Total Submissions', value: e.kpi.totalSubs, tone: 'sky', icon: <ClipboardList size={16} />, href: '/admin/submissions' },
      { label: 'Active Forms', value: e.kpi.activeForms, tone: 'violet', icon: <FileText size={16} />, href: '/admin/forms' },
      { label: 'Unread', value: e.kpi.unread, tone: 'amber', icon: <Inbox size={16} />, href: '/admin/submissions?is_read=false' },
      { label: 'Open Tickets', value: e.kpi.openTickets, tone: 'rose', icon: <Ticket size={16} />, href: '/admin/tickets' },
      { label: 'Resolved · 7d', value: e.kpi.resolved7d, tone: 'emerald', icon: <CheckCircle2 size={16} />, href: '/admin/tickets' },
      { label: 'In Progress', value: e.donut.inProgress, tone: 'slate', icon: <Clock size={16} />, href: '/admin/tickets' },
    ]
  }
  const groups = await Promise.all(STAT_WIDGETS.filter((w) => ctx.can(w.perm)).map((w) => w.build()))
  const stats = groups.flat()
  stats.push({ label: 'Team Members', value: ctx.headcount, tone: 'sky', icon: <Users size={16} />, href: ctx.can('employees') ? '/admin/employees' : undefined })
  return stats.slice(0, 6)
}

async function loadTicketStatus() {
  const [{ count: open }, { count: prog }, { count: res }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'open'),
    supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'in_progress'),
    supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'resolved'),
  ])
  return { open: open ?? 0, prog: prog ?? 0, res: res ?? 0 }
}

// ── Morning ticket alerts ────────────────────────────────────────────────────
//
// Two cards, deliberately separate rather than one merged list:
//
//   my_tickets    — what is YOURS and waiting. The first thing to look at.
//   ticket_alerts — what is nobody's, or old enough that leadership should know.
//
// Merging them would produce a list where "3 overdue" could mean yours or the
// company's, and a number you cannot act on is worse than no number.
//
// Every row links into the queue pre-filtered, so the card is a way in rather
// than a read-only stat. Counts come from HEAD requests — no rows are fetched.

const AGING_DAYS_CARD = 3
const OVERDUE_DAYS_CARD = 7
const REOPEN_LOOKBACK_DAYS = 7

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

/** The signed-in person's own queue. Returns null when their account has no
 *  matching employees row — the card then hides rather than showing four zeros
 *  that look like "all clear" when they actually mean "we cannot tell". */
async function loadMyTickets(employeeId: string | null) {
  if (!employeeId) return null
  const OPEN: readonly string[] = ['open', 'in_progress']
  const [{ count: mine }, { count: aging }, { count: overdue }, { count: myRfqs }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*', HEAD).eq('owner_id', employeeId).in('status', OPEN),
    supabaseAdmin.from('tickets').select('*', HEAD).eq('owner_id', employeeId).in('status', OPEN)
      .lt('created_at', daysAgo(AGING_DAYS_CARD)).gte('created_at', daysAgo(OVERDUE_DAYS_CARD)),
    supabaseAdmin.from('tickets').select('*', HEAD).eq('owner_id', employeeId).in('status', OPEN)
      .lt('created_at', daysAgo(OVERDUE_DAYS_CARD)),
    supabaseAdmin.from('rfq_requests').select('*', HEAD).eq('assignee_id', employeeId).neq('status', 'closed'),
  ])
  return { mine: mine ?? 0, aging: aging ?? 0, overdue: overdue ?? 0, myRfqs: myRfqs ?? 0 }
}

/** The company-wide ones worth a manager's attention first thing. */
async function loadTicketAlerts() {
  const OPEN: readonly string[] = ['open', 'in_progress']
  const [{ count: unassigned }, { count: overdue }, { count: unclaimedRfqs }, { data: reopens }] = await Promise.all([
    supabaseAdmin.from('tickets').select('*', HEAD).is('owner_id', null).in('status', OPEN),
    supabaseAdmin.from('tickets').select('*', HEAD).in('status', OPEN).lt('created_at', daysAgo(OVERDUE_DAYS_CARD)),
    supabaseAdmin.from('rfq_requests').select('*', HEAD).is('assignee_id', null).neq('status', 'closed'),
    // ⚠️ Reopens come from the audit trail: there is no reopen counter on the
    // ticket. `metadata->>from = closed` is the transition OUT of closed, which
    // is what a reopen IS — see lib/ticket-history.ts.
    supabaseAdmin.from('audit_log').select('id, metadata')
      .eq('action', 'ticket.status').gte('created_at', daysAgo(REOPEN_LOOKBACK_DAYS)).limit(500),
  ])
  // ⚠️ CUSTOMER reopens ONLY — `from: 'closed'` alone is not enough.
  //
  // A staff member dragging a ticket back out of `closed` writes exactly the same
  // `from: 'closed'` metadata as a customer replying to one. Counting both under a
  // label that reads "Reopened by a customer" reports our own triage back to us as
  // customer dissatisfaction, and it did: on 2026-08-24 this card showed 1, and
  // that 1 was a colleague moving a ticket from closed to in_progress.
  //
  // `via: 'status-page-reply'` is stamped only by app/api/tickets/status/message,
  // which is the only route a customer can reopen through — so it is the whole
  // discriminator. (`actor_id === null` works too, but `via` says why, not just who.)
  //
  // ⛔ The tickets REPORT must NOT adopt this filter. Its language is deliberately
  // actor-agnostic — "Reopen rate", "tickets that came back", "did we call things
  // done that were not done" — and a staff reopen is exactly that question.
  const reopened = (reopens ?? []).filter(r => {
    const m = r.metadata as { from?: string; via?: string } | null
    return m?.from === 'closed' && m?.via === 'status-page-reply'
  }).length
  return { unassigned: unassigned ?? 0, overdue: overdue ?? 0, unclaimedRfqs: unclaimedRfqs ?? 0, reopened }
}

function MyTicketsCard({ d }: { d: { mine: number; aging: number; overdue: number; myRfqs: number } }) {
  const total = d.mine + d.overdue + d.myRfqs
  return (
    <Card className="h-full">
      <CardHead title="My Tickets" icon={<Ticket size={13} />} iconTone="sky" action="Open queue" href="/admin/tickets" />
      <div className="p-2">
        <AttentionRow icon={<Ticket size={15} />} color={TONE_HEX.sky} label="Open and assigned to me" value={d.mine} href="/admin/tickets" />
        <AttentionRow icon={<Clock size={15} />} color={TONE_HEX.amber} label={`Aging (${AGING_DAYS_CARD}+ days)`} value={d.aging} href="/admin/tickets" />
        <AttentionRow icon={<AlertCircle size={15} />} color={TONE_HEX.rose} label={`Overdue (${OVERDUE_DAYS_CARD}+ days)`} value={d.overdue} href="/admin/tickets" />
        <AttentionRow icon={<FileText size={15} />} color={TONE_HEX.violet} label="Quote requests assigned to me" value={d.myRfqs} href="/admin/rfq" />
      </div>
      {total === 0 && (
        <div className="px-5 pb-4 -mt-1">
          <div className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Nothing waiting on you.
          </div>
        </div>
      )}
    </Card>
  )
}

function TicketAlertsCard({ d }: { d: { unassigned: number; overdue: number; unclaimedRfqs: number; reopened: number } }) {
  const total = d.unassigned + d.overdue + d.unclaimedRfqs + d.reopened
  return (
    <Card className="h-full">
      <CardHead title="Ticket Alerts" icon={<AlertCircle size={13} />} iconTone="amber" action="Open queue" href="/admin/tickets" />
      <div className="p-2">
        <AttentionRow icon={<Inbox size={15} />} color={TONE_HEX.rose} label="Unassigned — nobody owns these" value={d.unassigned} href="/admin/tickets" />
        <AttentionRow icon={<Clock size={15} />} color={TONE_HEX.amber} label={`Overdue company-wide (${OVERDUE_DAYS_CARD}+ days)`} value={d.overdue} href="/admin/tickets" />
        <AttentionRow icon={<ArrowRight size={15} />} color={TONE_HEX.violet} label={`Reopened by a customer (${REOPEN_LOOKBACK_DAYS}d)`} value={d.reopened} href="/admin/reports/tickets" />
        <AttentionRow icon={<FileText size={15} />} color={TONE_HEX.sky} label="Quote requests nobody has claimed" value={d.unclaimedRfqs} href="/admin/rfq" />
      </div>
      {total === 0 && (
        <div className="px-5 pb-4 -mt-1">
          <div className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Nothing needs chasing.
          </div>
        </div>
      )}
    </Card>
  )
}

const recentCard = (key: 'tickets' | 'submissions' | 'timeoff' | 'presentations', title: string, perm: Perm): CardDef => ({
  id: `recent_${key}`,
  title,
  perm,
  defaultSpan: 2,
  sizes: [1, 2, 3],
  available: (ctx) => ctx.can(perm),
  Component: async () => <RecentCard recent={await RECENT_LOADERS[key]()} />,
})

// Admin-only card that reads the shared exec data batch (ctx.execData).
const execCard = (id: string, title: string, defaultSpan: Span, sizes: Span[], render: (e: ExecData) => React.ReactNode): CardDef => ({
  id, title, defaultSpan, sizes,
  available: (ctx) => ctx.role === 'admin',
  Component: async (ctx) => (ctx.execData ? render(ctx.execData) : null),
})


// ── My Quote Requests ──────────────────────────────────────────────────────
// The only card that shows the VIEWER their own work. Everything else here is a
// department roll-up, so this one takes ctx.userId.
//
// It also shows the unclaimed count to everyone who can see the queue: a card
// that only listed your own assignments would go quiet exactly when nobody has
// picked something up, which is the failure the whole feature exists to stop.
//
// ⚠️ Every card Component supplies its OWN <Card> and <CardHead> — DashboardGrid
// wraps children in a bare <div> and adds no chrome. This one shipped with
// neither (2026-08-15), so it rendered as unstyled content with no border and no
// title: on a grid of titled cards, an anonymous block reading "5 unassigned"
// gives no clue what it belongs to. Caught the first time it was rendered in a
// browser, 2026-08-17. Do not drop the wrapper again.
function MyRfqCard({ d }: { d: MyRfqSummary }) {
  const head = (
    <CardHead
      title="My Quote Requests"
      icon={<ClipboardList size={13} />}
      iconTone="sky"
      action="View all"
      href="/admin/rfq"
    />
  )
  if (!d.mine.length && !d.unclaimed) {
    return (
      <Card className="h-full">
        {head}
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
          Nothing waiting on you. Every quote request has an owner.
        </p>
      </Card>
    )
  }
  return (
    <Card className="h-full">
      {head}
      <div className="px-1 py-1">
      {d.unclaimed > 0 && (
        <Link
          href="/admin/rfq"
          className="mx-3 mb-1.5 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15"
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="font-medium">{d.unclaimed} unassigned</span>
          <span className="truncate opacity-80">— nobody owns {d.unclaimed === 1 ? 'it' : 'them'} yet</span>
        </Link>
      )}
      {d.mine.map((r) => (
        <Link
          key={r.id}
          href={`/admin/rfq/${r.id}`}
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-soft"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{r.company || 'Not given'}</span>
            <span className="block truncate text-[11.5px] text-ink-muted">{r.project_name || r.reference}</span>
          </span>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              r.status === 'new'
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            }`}
          >
            {r.status === 'new' ? 'Not started' : 'Reviewing'}
          </span>
        </Link>
      ))}
      {!d.mine.length && (
        <p className="px-3 py-2 text-[12.5px] text-ink-muted">None assigned to you.</p>
      )}
      </div>
    </Card>
  )
}

/**
 * The engineering batch, memoized for the life of one render.
 *
 * React's `cache()` is per-request, which is exactly the scope wanted here: the
 * four engineering cards on one dashboard share a single read, and the next
 * request gets fresh data. Doing this inside the registry rather than threading
 * it through CardCtx keeps the ctx shape unchanged — `execData` is threaded that
 * way because the ADMIN dashboard needs it whether or not any exec card is
 * rendered, while these four are only ever loaded when one of them is.
 */
const engData = cache(() => getEngCardData())

export const CARD_REGISTRY: CardDef[] = [
  {
    id: 'metrics', title: 'Key Metrics', defaultSpan: 3, sizes: [2, 3],
    available: () => true,
    Component: async (ctx) => <MetricsStrip stats={await loadStats(ctx)} />,
  },
  {
    id: 'my_rfqs', title: 'My Quote Requests', perm: 'deals', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('deals'),
    Component: async (ctx) => <MyRfqCard d={await getMyRfqs(ctx.userId)} />,
  },
  recentCard('tickets', 'Recent Tickets', 'tickets'),
  recentCard('submissions', 'Recent Submissions', 'submissions'),
  recentCard('timeoff', 'Recent Time Off', 'pto'),
  recentCard('presentations', 'Recent Presentations', 'presentations'),
  {
    id: 'my_tickets', title: 'My Tickets', perm: 'tickets', defaultSpan: 1, sizes: [1, 2],
    // Hidden outright when the account has no employees row: a card that can
    // only ever show zeros reads as "all clear" when it means "cannot tell".
    available: (ctx) => ctx.can('tickets') && !!ctx.myEmployeeId,
    Component: async (ctx) => {
      const d = await loadMyTickets(ctx.myEmployeeId)
      return d ? <MyTicketsCard d={d} /> : null
    },
  },
  {
    id: 'ticket_alerts', title: 'Ticket Alerts', perm: 'tickets', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('tickets'),
    Component: async () => <TicketAlertsCard d={await loadTicketAlerts()} />,
  },
  {
    id: 'tickets_donut', title: 'Tickets by Status', perm: 'tickets', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('tickets'),
    Component: async () => <TicketsDonutCard status={await loadTicketStatus()} />,
  },
  // ── Engineering (096) ───────────────────────────────────────────────────
  // Four cards over ONE shared read. `engCardData` is memoized per request in
  // engData() below, so a dashboard showing all four fires the query once —
  // four cards each doing their own full table read is how a dashboard becomes
  // the slowest page in the portal.
  {
    id: 'eng_status', title: 'Engineering Status', perm: 'engineering_jobs', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('engineering_jobs'),
    Component: async () => <EngStatusCard d={await engData()} />,
  },
  {
    id: 'eng_risk', title: 'Engineering Risk', perm: 'engineering_jobs', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('engineering_jobs'),
    Component: async () => <EngRiskCard d={await engData()} />,
  },
  {
    id: 'eng_my_work', title: 'My Engineering Work', perm: 'engineering_jobs', defaultSpan: 1, sizes: [1, 2],
    // Hidden outright when the account has no employees row — the only join from
    // an auth user to eng_tasks.assignee_id is the email (lib/my-employee.ts), so
    // "no row" means "cannot tell what is yours", and a card that can only ever
    // show nothing reads as "you have nothing to do".
    available: (ctx) => ctx.can('engineering_jobs') && !!ctx.myEmployeeId,
    Component: async (ctx) => (ctx.myEmployeeId ? <EngMyWorkCard d={await engData()} employeeId={ctx.myEmployeeId} /> : null),
  },
  {
    id: 'eng_load', title: 'Engineering Load', perm: 'engineering_jobs', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('engineering_jobs'),
    Component: async () => <EngLoadCard d={await engData()} />,
  },
  {
    id: 'quick_links', title: 'Quick Links', defaultSpan: 2, sizes: [1, 2, 3],
    available: () => true,
    Component: async (ctx) => <QuickLinksCard links={ctx.quickLinks} />,
  },
  {
    id: 'snapshot', title: 'Your Workspace', defaultSpan: 1, sizes: [1, 2],
    available: () => true,
    Component: async (ctx) => <SnapshotCard role={ctx.role} headcount={ctx.headcount} toolCount={ctx.quickLinks.length} />,
  },
  // ── Admin executive cards (admin-only; read the shared exec data batch) ──
  execCard('exec_forms_performance', 'Forms Performance', 2, [1, 2, 3], (e) => <FormsPerformanceCard d={e} />),
  execCard('exec_top_forms', 'Top Forms by Volume', 1, [1, 2], (e) => <TopFormsCard d={e} />),
  execCard('exec_top_submitters', 'Top Submitters', 1, [1, 2], (e) => <TopSubmittersCard d={e} />),
  execCard('exec_activity', 'Activity · 14 days', 2, [1, 2, 3], (e) => <ActivityCard d={e} />),
  execCard('exec_form_status', 'Form Status', 1, [1, 2], (e) => <FormStatusCard d={e} />),
  execCard('exec_needs_attention', 'Needs Attention', 1, [1, 2], (e) => <NeedsAttentionCard d={e} />),
  execCard('exec_live_activity', 'Live Activity', 1, [1, 2], (e) => <LiveActivityCard d={e} />),
  execCard('exec_admin_activity', 'Admin Activity', 1, [1, 2], (e) => <AdminActivityCard d={e} />),
]

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARD_REGISTRY.map((c) => [c.id, c]))

/** The code default layout for a role — reproduces the shipped arrangement. */
export function defaultLayout(ctx: CardCtx): LayoutItem[] {
  // Admin default reproduces the old executive dashboard arrangement.
  if (ctx.role === 'admin') {
    return ([
      { id: 'metrics', span: 3 },
      // High and left on purpose: this is the only card showing work assigned to
      // the VIEWER, and it carries the unclaimed count. Buried below the fold it
      // cannot do the job it exists for — surfacing a quote request nobody owns.
      { id: 'my_rfqs', span: 1 },
      { id: 'exec_forms_performance', span: 2 }, { id: 'tickets_donut', span: 1 },
      // Morning alerts lead the exec dashboard: what is yours, then what is
      // nobody's. Everything below is analysis you go looking for.
      { id: 'my_tickets', span: 1 }, { id: 'ticket_alerts', span: 1 },
      // Engineering sits with the other morning-alert cards, not below the
      // analysis. The section's whole reason for existing is that a job trending
      // late has to be visible before the ship date, and a card leadership has to
      // scroll to is a card that does that a week too late.
      { id: 'eng_status', span: 1 }, { id: 'eng_risk', span: 1 }, { id: 'eng_load', span: 1 },
      { id: 'exec_top_forms', span: 1 }, { id: 'exec_top_submitters', span: 1 }, { id: 'exec_needs_attention', span: 1 },
      { id: 'exec_activity', span: 2 }, { id: 'recent_submissions', span: 1 },
      { id: 'recent_tickets', span: 2 }, { id: 'exec_form_status', span: 1 },
      { id: 'exec_live_activity', span: 1 }, { id: 'exec_admin_activity', span: 1 }, { id: 'quick_links', span: 1 },
    ] as LayoutItem[]).filter((it) => CARD_BY_ID[it.id]?.available(ctx))
  }
  const items: LayoutItem[] = [{ id: 'metrics', span: 3 }]
  const topRecent = ['tickets', 'submissions', 'timeoff', 'presentations']
    .map((k) => `recent_${k}`)
    .find((id) => CARD_BY_ID[id]?.available(ctx))
  if (topRecent) items.push({ id: topRecent, span: 2 })
  // Same reasoning as the admin default above. The trailing .filter() drops it
  // for roles without `deals`, so this is safe to push unconditionally — and it
  // means a scoped role that is later granted the quote queue gets the card
  // without anyone remembering to come back here.
  items.push({ id: 'my_rfqs', span: 1 })

  // Engineering leads the department dashboard for anyone who holds the section —
  // in practice James and his team. What is mine, then what is at risk, then the
  // bucket roll-up, then who is carrying what. The trailing .filter() drops
  // eng_my_work for an account with no employees row and drops all four for a
  // role that does not hold the perm, so this is safe to push unconditionally:
  // a scoped role granted the section later gets the cards without anyone
  // remembering to come back here.
  items.push(
    { id: 'eng_my_work', span: 1 }, { id: 'eng_risk', span: 1 },
    { id: 'eng_status', span: 1 }, { id: 'eng_load', span: 1 },
  )

  if (ctx.can('tickets')) {
    // Engineering and production_manager work the queue daily, so their morning
    // alerts lead here too — ahead of the status donut, which is a picture of the
    // whole queue rather than anything asking for them. `my_tickets` drops out via
    // the trailing .filter() when the account has no employees row.
    items.push(
      { id: 'my_tickets', span: 1 }, { id: 'ticket_alerts', span: 1 },
      { id: 'tickets_donut', span: 1 }, { id: 'quick_links', span: 2 }, { id: 'snapshot', span: 1 },
    )
  } else {
    items.push({ id: 'snapshot', span: 1 }, { id: 'quick_links', span: 3 })
  }
  return items.filter((it) => CARD_BY_ID[it.id]?.available(ctx))
}
