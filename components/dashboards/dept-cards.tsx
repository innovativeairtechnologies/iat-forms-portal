import Link from 'next/link'
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
  MessageSquare, LayoutGrid, Compass,
} from 'lucide-react'

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

export type DeptRole = Exclude<StaffRole, 'admin' | 'production'>
export type Span = 1 | 2 | 3
export type QuickLink = { href: string; label: string; perm: string }
export type LayoutItem = { id: string; span: Span }
export type CardCtx = { role: DeptRole; can: (p: Perm) => boolean; headcount: number; quickLinks: QuickLink[] }

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
  jerry: MessageSquare, tools: LayoutGrid,
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

const recentCard = (key: 'tickets' | 'submissions' | 'timeoff' | 'presentations', title: string, perm: Perm): CardDef => ({
  id: `recent_${key}`,
  title,
  perm,
  defaultSpan: 2,
  sizes: [1, 2, 3],
  available: (ctx) => ctx.can(perm),
  Component: async () => <RecentCard recent={await RECENT_LOADERS[key]()} />,
})

export const CARD_REGISTRY: CardDef[] = [
  {
    id: 'metrics', title: 'Key Metrics', defaultSpan: 3, sizes: [2, 3],
    available: () => true,
    Component: async (ctx) => <MetricsStrip stats={await loadStats(ctx)} />,
  },
  recentCard('tickets', 'Recent Tickets', 'tickets'),
  recentCard('submissions', 'Recent Submissions', 'submissions'),
  recentCard('timeoff', 'Recent Time Off', 'pto'),
  recentCard('presentations', 'Recent Presentations', 'presentations'),
  {
    id: 'tickets_donut', title: 'Tickets by Status', perm: 'tickets', defaultSpan: 1, sizes: [1, 2],
    available: (ctx) => ctx.can('tickets'),
    Component: async () => <TicketsDonutCard status={await loadTicketStatus()} />,
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
]

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARD_REGISTRY.map((c) => [c.id, c]))

/** The code default layout for a role — reproduces the shipped arrangement. */
export function defaultLayout(ctx: CardCtx): LayoutItem[] {
  const items: LayoutItem[] = [{ id: 'metrics', span: 3 }]
  const topRecent = ['tickets', 'submissions', 'timeoff', 'presentations']
    .map((k) => `recent_${k}`)
    .find((id) => CARD_BY_ID[id]?.available(ctx))
  if (topRecent) items.push({ id: topRecent, span: 2 })

  if (ctx.can('tickets')) {
    items.push({ id: 'tickets_donut', span: 1 }, { id: 'quick_links', span: 2 }, { id: 'snapshot', span: 1 })
  } else {
    items.push({ id: 'snapshot', span: 1 }, { id: 'quick_links', span: 3 })
  }
  return items.filter((it) => CARD_BY_ID[it.id]?.available(ctx))
}
