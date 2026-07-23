import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_SECTIONS, hasPermission, ROLE_LABELS, ROLE_DESCRIPTIONS, type StaffRole, type Perm } from '@/lib/roles'
import { getPermMatrix } from '@/lib/permissions'
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
   /admin for a SCOPED role (hr / marketing / engineering / production_manager)
   — the executive dashboard in app/admin/page.tsx stays admin-only, and Sales
   has its own command center; this is the department-scoped landing page each
   other role gets instead of being dropped on their first permitted section.

   Same warm "Quiet Precision" bento as the exec + Sales dashboards: warm canvas,
   hairline cards (no resting shadow), semantic tokens, colored Tone-chip KPIs —
   built from the shared components/dashboards/sales-charts.tsx primitives.

   Cards are gated by PERMISSION, not hardcoded per role: a card shows only when
   the role holds its perm (getPermMatrix, the same source nav + middleware use),
   so granting/revoking a perm in /admin/permissions reshapes the dashboard with
   no code change. Real counts from the same tables the exec dashboard reads; a
   couple of always-on cards (team snapshot, quick links) give thin departments a
   complete-feeling page. This declarative catalog is also the substrate a future
   "build your own dashboard" (per-user card add/remove/reorder) would sit on.
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_HEX: Record<'emerald' | 'sky' | 'rose' | 'amber' | 'violet', string> = {
  emerald: '#10b981', sky: '#0ea5e9', rose: '#f43f5e', amber: '#f59e0b', violet: '#8b5cf6',
}

type StatDef = { label: string; value: number; tone: Tone; icon: React.ReactNode; href?: string }
type RecentRow = { id: string; primary: string; secondary: string; href: string; tone?: 'amber' | 'emerald' | 'rose' | 'zinc' }
type RecentList = { title: string; rows: RecentRow[]; emptyLabel: string; viewAllHref?: string; icon: React.ReactNode; iconTone: Tone }

const HEAD = { count: 'exact' as const, head: true }

// Declarative stat-card catalog. Each entry is gated by a perm and builds one or
// more Tone-chip KPIs. Order here = display order. Add a KPI = add an entry.
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
  {
    perm: 'submissions',
    build: async () => {
      const { count } = await supabaseAdmin.from('submissions').select('*', HEAD).eq('is_read', false)
      return [{ label: 'Unread Submissions', value: count ?? 0, tone: 'amber', icon: <Inbox size={16} />, href: '/admin/submissions?is_read=false' }]
    },
  },
  {
    perm: 'deals',
    build: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabaseAdmin.from('deal_follow_ups').select('*', HEAD).eq('done', false).lte('due_date', today)
      return [{ label: 'Follow-ups Due', value: count ?? 0, tone: 'amber', icon: <CalendarClock size={16} />, href: '/admin/deals' }]
    },
  },
  {
    perm: 'customers',
    build: async () => {
      const { count } = await supabaseAdmin.from('customers').select('*', HEAD)
      return [{ label: 'Customers', value: count ?? 0, tone: 'sky', icon: <Building2 size={16} />, href: '/admin/customers' }]
    },
  },
  {
    perm: 'equipment',
    build: async () => {
      const { count } = await supabaseAdmin.from('equipment').select('*', HEAD)
      return [{ label: 'Equipment Units', value: count ?? 0, tone: 'emerald', icon: <Boxes size={16} />, href: '/admin/equipment' }]
    },
  },
  {
    perm: 'pto',
    build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'pto').eq('status', 'pending')
      return [{ label: 'PTO Pending', value: count ?? 0, tone: 'amber', icon: <Calendar size={16} />, href: '/admin/requests/pto' }]
    },
  },
  {
    perm: 'sick',
    build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'sick').eq('status', 'pending')
      return [{ label: 'Sick Pending', value: count ?? 0, tone: 'violet', icon: <Clock size={16} />, href: '/admin/requests/sick' }]
    },
  },
  {
    perm: 'forms',
    build: async () => {
      const { count } = await supabaseAdmin.from('forms').select('*', HEAD).eq('is_active', true)
      return [{ label: 'Active Forms', value: count ?? 0, tone: 'emerald', icon: <FileText size={16} />, href: '/admin/forms' }]
    },
  },
  {
    perm: 'presentations',
    build: async () => {
      const { count } = await supabaseAdmin.from('presentations').select('*', HEAD)
      return [{ label: 'Presentations', value: count ?? 0, tone: 'violet', icon: <Presentation size={16} />, href: '/admin/presentations' }]
    },
  },
]

// Recent-activity list. The role gets the FIRST one (by this priority) it can see.
const RECENT_BUILDERS: { perm: Perm; build: () => Promise<RecentList> }[] = [
  {
    perm: 'tickets',
    build: async () => {
      const { data } = await supabaseAdmin.from('tickets').select('id,ticket_number,customer_name,status,created_at').order('created_at', { ascending: false }).limit(6)
      return {
        title: 'Recent Tickets', viewAllHref: '/admin/tickets', emptyLabel: 'No tickets yet', icon: <Ticket size={13} />, iconTone: 'rose',
        rows: (data ?? []).map((t) => ({
          id: t.id, primary: t.customer_name || 'Unknown', secondary: `${t.ticket_number} · ${String(t.status).replace('_', ' ')}`,
          href: `/admin/tickets/${t.id}`, tone: t.status === 'open' ? 'rose' : t.status === 'in_progress' ? 'amber' : 'emerald',
        })),
      }
    },
  },
  {
    perm: 'submissions',
    build: async () => {
      const { data } = await supabaseAdmin.from('submissions').select('id,form_title,submitted_at,is_read').order('submitted_at', { ascending: false }).limit(6)
      return {
        title: 'Recent Submissions', viewAllHref: '/admin/submissions', emptyLabel: 'No submissions yet', icon: <Inbox size={13} />, iconTone: 'emerald',
        rows: (data ?? []).map((s) => ({
          id: s.id, primary: s.form_title || 'Form submission', secondary: s.is_read ? 'Read' : 'Unread',
          href: `/admin/submissions/${s.id}`, tone: s.is_read ? 'zinc' : 'emerald',
        })),
      }
    },
  },
  {
    perm: 'pto',
    build: async () => {
      const { data } = await supabaseAdmin.from('time_off_requests').select('id,type,status,start_date,end_date,created_at,employee:employees(name)').order('created_at', { ascending: false }).limit(6)
      return {
        title: 'Recent Time Off Requests', viewAllHref: '/admin/requests/pto', emptyLabel: 'No requests yet', icon: <Calendar size={13} />, iconTone: 'amber',
        rows: (data ?? []).map((r) => {
          const employee = Array.isArray(r.employee) ? r.employee[0] : r.employee
          return {
            id: r.id, primary: employee?.name || 'Unknown', secondary: `${r.type === 'pto' ? 'PTO' : 'Sick'} · ${r.status}`,
            href: `/admin/requests/${r.type}`, tone: r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'emerald' : 'rose',
          }
        }),
      }
    },
  },
  {
    perm: 'presentations',
    build: async () => {
      const { data } = await supabaseAdmin.from('presentations').select('id,title,status,updated_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(6)
      return {
        title: 'Recent Presentations', viewAllHref: '/admin/presentations', emptyLabel: 'No presentations yet', icon: <Presentation size={13} />, iconTone: 'violet',
        rows: (data ?? []).map((p) => ({
          id: p.id, primary: p.title || 'Untitled deck', secondary: p.status === 'saved' ? 'Saved' : 'In progress',
          href: `/admin/presentations/${p.id}`, tone: p.status === 'saved' ? 'emerald' : 'amber',
        })),
      }
    },
  },
]

async function getRoleData(role: Exclude<StaffRole, 'admin' | 'production'>) {
  const matrix = await getPermMatrix()
  const can = (perm: Perm) => hasPermission(role, perm, matrix)

  const [statGroups, { count: headcount }] = await Promise.all([
    Promise.all(STAT_WIDGETS.filter((w) => can(w.perm)).map((w) => w.build())),
    supabaseAdmin.from('employees').select('*', HEAD).eq('is_active', true),
  ])

  // Real stats first, then a universal "Team" tile so thin departments still
  // show a couple of KPIs; capped so the strip stays one or two calm rows.
  const stats: StatDef[] = statGroups.flat()
  stats.push({ label: 'Team Members', value: headcount ?? 0, tone: 'sky', icon: <Users size={16} />, href: can('employees') ? '/admin/employees' : undefined })
  const cappedStats = stats.slice(0, 6)

  // Recent: the first list (by priority) the role can see.
  const builder = RECENT_BUILDERS.find((b) => can(b.perm))
  const recent = builder ? await builder.build() : null

  // Tickets-by-status donut — only when the role can see tickets.
  let ticketStatus: { open: number; prog: number; res: number } | null = null
  if (can('tickets')) {
    const [{ count: open }, { count: prog }, { count: res }] = await Promise.all([
      supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'open'),
      supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'in_progress'),
      supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'resolved'),
    ])
    ticketStatus = { open: open ?? 0, prog: prog ?? 0, res: res ?? 0 }
  }

  return { stats: cappedStats, recent, ticketStatus, headcount: headcount ?? 0 }
}

const TONE_DOT: Record<NonNullable<RecentRow['tone']>, string> = {
  amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', zinc: 'bg-slate-300 dark:bg-slate-600',
}

const SECTION_ICON: Partial<Record<string, LucideIcon>> = {
  submissions: Inbox, tickets: Ticket, equipment: Boxes, customers: Building2, deals: DollarSign, gantt: CalendarRange,
  org_chart: Users, forms: FileText, employee_forms: FileText, pto: Calendar, sick: Clock,
  scheduling: Calendar, accrual: Clock, presentations: Presentation, employees: Users,
  jerry: MessageSquare, tools: LayoutGrid,
}

// Quick-link targets a role can always reach beyond ADMIN_SECTIONS (Jerry + the
// Internal Apps launcher live outside that section list but every scoped role
// holds their perms), so thin departments get a fuller, useful link grid.
const EXTRA_LINKS: { perm: Perm; href: string; label: string }[] = [
  { perm: 'jerry', href: '/admin/jerry', label: 'Jerry' },
  { perm: 'tools', href: '/admin/tools', label: 'Internal Apps' },
]

function RecentCard({ recent, className }: { recent: RecentList; className?: string }) {
  return (
    <Card className={className}>
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

function TicketsDonutCard({ status, className }: { status: { open: number; prog: number; res: number }; className?: string }) {
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
    <Card className={className}>
      <CardHead title="Tickets by Status" icon={<Ticket size={13} />} iconTone="rose" />
      <CardBody className="flex items-center gap-5 px-5 py-5">
        <Donut segments={segs} centerTop={total.toLocaleString()} centerSub="TICKETS" size={140} stroke={15} />
        <DonutLegend items={legend} />
      </CardBody>
    </Card>
  )
}

function QuickLinksCard({ links, className }: { links: { href: string; label: string; perm: string }[]; className?: string }) {
  return (
    <Card className={className}>
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

function SnapshotCard({ role, headcount, toolCount, className }: { role: Exclude<StaffRole, 'admin' | 'production'>; headcount: number; toolCount: number; className?: string }) {
  return (
    <Card className={className}>
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

export default async function DepartmentDashboard({ role, displayName }: { role: Exclude<StaffRole, 'admin' | 'production'>; displayName: string }) {
  const { stats, recent, ticketStatus, headcount } = await getRoleData(role)
  const matrix = await getPermMatrix()
  const quickLinks = [
    ...ADMIN_SECTIONS.filter((s) => hasPermission(role, s.perm, matrix)).map((s) => ({
      href: s.href, perm: s.perm as string, label: (s.href.split('/').pop()?.replace(/-/g, ' ') ?? s.perm),
    })),
    ...EXTRA_LINKS.filter((l) => hasPermission(role, l.perm, matrix)).map((l) => ({ href: l.href, perm: l.perm as string, label: l.label })),
  ]

  return (
    <div className="relative isolate flex-1 overflow-y-auto overflow-x-hidden bg-canvas text-ink-secondary min-h-0">
      {/* Ambient emerald/sky wash — the same warmth signature the exec dashboard carries. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute -top-40 right-[-120px] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-emerald-400/20 via-emerald-500/8 to-transparent blur-3xl dark:from-emerald-500/16 dark:via-emerald-600/6" />
      </div>

      <div className="p-5 space-y-5 animate-fade-up">

        {/* Greeting hero — warm surface band with the emerald brand glow. */}
        <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface px-6 py-6 sm:px-8">
          <div
            className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full opacity-[0.18] blur-3xl dark:opacity-25"
            style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{ROLE_LABELS[role]} · Dashboard</p>
              <h1 className="mt-1 text-[24px] font-semibold text-ink leading-tight tracking-[-0.02em]">
                {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
              </h1>
              <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
        </section>

        {/* KPI strip — Tone-chip tiles that stretch to fill the row at any count. */}
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {stats.map((s) => {
              const tile = <Kpi tone={s.tone} label={s.label} value={s.value.toLocaleString()} icon={s.icon} />
              return s.href
                ? <Link key={s.label} href={s.href} className="flex-1 min-w-[180px] block">{tile}</Link>
                : <div key={s.label} className="flex-1 min-w-[180px]">{tile}</div>
            })}
          </div>
        )}

        {/* Bento — recent + (donut | snapshot) on top, quick links + snapshot below. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recent ? <RecentCard recent={recent} className="lg:col-span-2" /> : <QuickLinksCard links={quickLinks} className="lg:col-span-2" />}
          {ticketStatus
            ? <TicketsDonutCard status={ticketStatus} />
            : <SnapshotCard role={role} headcount={headcount} toolCount={quickLinks.length} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recent && <QuickLinksCard links={quickLinks} className={ticketStatus ? 'lg:col-span-2' : 'lg:col-span-3'} />}
          {ticketStatus && <SnapshotCard role={role} headcount={headcount} toolCount={quickLinks.length} />}
        </div>

        <p className="text-[11px] text-ink-faint text-center pt-1 pb-4">
          Live data from your Supabase instance · scoped to your role&apos;s sections
        </p>
      </div>
    </div>
  )
}
