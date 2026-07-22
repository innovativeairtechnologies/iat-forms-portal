import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_SECTIONS, hasPermission, ROLE_LABELS, ROLE_DESCRIPTIONS, type StaffRole, type Perm } from '@/lib/roles'
import { getPermMatrix } from '@/lib/permissions'
import { Card, CardHead } from '@/components/admin/detail-ui'
import {
  ArrowRight, Ticket, Boxes, Building2, Clock, Inbox,
  Calendar, Users, FileText, Presentation, CalendarRange, ChevronRight, DollarSign, CalendarClock,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────────
   /admin for a SCOPED role (sales / hr / marketing / engineering /
   production_manager) — the executive dashboard in app/admin/page.tsx stays
   admin-only; this is the department-scoped landing page each role now gets
   instead of being redirected straight to their first permitted section.

   Cards are gated by PERMISSION, not hardcoded per role: a card shows only when
   the role holds its perm (getPermMatrix, the same source nav + middleware use),
   so granting/revoking a perm in /admin/permissions reshapes the dashboard with
   no code change. Real counts from the same tables the exec dashboard reads.
   ──────────────────────────────────────────────────────────────────────────── */

type StatCardDef = { label: string; value: number; icon: React.ReactNode; color: string; href?: string }
type RecentRow = { id: string; primary: string; secondary: string; href: string; tone?: 'amber' | 'emerald' | 'rose' | 'zinc' }
type RecentList = { title: string; rows: RecentRow[]; emptyLabel: string; viewAllHref?: string }

const HEAD = { count: 'exact' as const, head: true }

// Declarative stat-card catalog. Each entry is gated by a perm and builds one or
// more cards. Order here = display order. Add a card = add an entry (+ its perm).
const STAT_WIDGETS: { perm: Perm; build: () => Promise<StatCardDef[]> }[] = [
  {
    perm: 'tickets',
    build: async () => {
      const [{ count: open }, { count: prog }] = await Promise.all([
        supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'open'),
        supabaseAdmin.from('tickets').select('*', HEAD).eq('status', 'in_progress'),
      ])
      return [
        { label: 'Open Tickets', value: open ?? 0, icon: <Ticket size={15} />, color: '#f43f5e', href: '/admin/tickets' },
        { label: 'In Progress', value: prog ?? 0, icon: <Clock size={15} />, color: '#f59e0b', href: '/admin/tickets' },
      ]
    },
  },
  {
    perm: 'submissions',
    build: async () => {
      const { count } = await supabaseAdmin.from('submissions').select('*', HEAD).eq('is_read', false)
      return [{ label: 'Unread Submissions', value: count ?? 0, icon: <Inbox size={15} />, color: '#f59e0b', href: '/admin/submissions?is_read=false' }]
    },
  },
  {
    perm: 'deals',
    build: async () => {
      // Deal follow-ups due today or overdue and still open — the in-app rep nudge.
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabaseAdmin.from('deal_follow_ups').select('*', HEAD).eq('done', false).lte('due_date', today)
      return [{ label: 'Follow-ups Due', value: count ?? 0, icon: <CalendarClock size={15} />, color: '#f59e0b', href: '/admin/deals' }]
    },
  },
  {
    perm: 'customers',
    build: async () => {
      const { count } = await supabaseAdmin.from('customers').select('*', HEAD)
      return [{ label: 'Customers', value: count ?? 0, icon: <Building2 size={15} />, color: '#3b82f6', href: '/admin/customers' }]
    },
  },
  {
    perm: 'equipment',
    build: async () => {
      const { count } = await supabaseAdmin.from('equipment').select('*', HEAD)
      return [{ label: 'Equipment Units', value: count ?? 0, icon: <Boxes size={15} />, color: '#10b981', href: '/admin/equipment' }]
    },
  },
  {
    perm: 'pto',
    build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'pto').eq('status', 'pending')
      return [{ label: 'PTO Pending', value: count ?? 0, icon: <Calendar size={15} />, color: '#f59e0b', href: '/admin/requests/pto' }]
    },
  },
  {
    perm: 'sick',
    build: async () => {
      const { count } = await supabaseAdmin.from('time_off_requests').select('*', HEAD).eq('type', 'sick').eq('status', 'pending')
      return [{ label: 'Sick Pending', value: count ?? 0, icon: <Clock size={15} />, color: '#f59e0b', href: '/admin/requests/sick' }]
    },
  },
  {
    perm: 'employees',
    build: async () => {
      const { count } = await supabaseAdmin.from('employees').select('*', HEAD).eq('is_active', true)
      return [{ label: 'Active Employees', value: count ?? 0, icon: <Users size={15} />, color: '#3b82f6', href: '/admin/employees' }]
    },
  },
  {
    perm: 'forms',
    build: async () => {
      const { count } = await supabaseAdmin.from('forms').select('*', HEAD).eq('is_active', true)
      return [{ label: 'Active Forms', value: count ?? 0, icon: <FileText size={15} />, color: '#10b981', href: '/admin/forms' }]
    },
  },
  {
    perm: 'presentations',
    build: async () => {
      const { count } = await supabaseAdmin.from('presentations').select('*', HEAD)
      return [{ label: 'Presentations', value: count ?? 0, icon: <Presentation size={15} />, color: '#8b5cf6', href: '/admin/presentations' }]
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
        title: 'Recent Tickets', viewAllHref: '/admin/tickets', emptyLabel: 'No tickets yet',
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
        title: 'Recent Submissions', viewAllHref: '/admin/submissions', emptyLabel: 'No submissions yet',
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
        title: 'Recent Time Off Requests', viewAllHref: '/admin/requests/pto', emptyLabel: 'No requests yet',
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
        title: 'Recent Presentations', viewAllHref: '/admin/presentations', emptyLabel: 'No presentations yet',
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

  // Stats: every catalog widget whose perm the role holds (catalog order), capped.
  const groups = await Promise.all(STAT_WIDGETS.filter((w) => can(w.perm)).map((w) => w.build()))
  const stats = groups.flat().slice(0, 8)

  // Recent: the first list (by priority) the role can see.
  const builder = RECENT_BUILDERS.find((b) => can(b.perm))
  const recent: RecentList = builder ? await builder.build() : { title: '', rows: [], emptyLabel: '' }

  return { stats, recent }
}

function StatCard({ stat }: { stat: StatCardDef }) {
  const inner = (
    <div className="h-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md dark:hover:bg-zinc-900/70 transition-all p-4">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: stat.color }}>{stat.icon}</span>
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</span>
      </div>
      <span className="text-[28px] font-bold text-zinc-900 dark:text-white leading-none tabular-nums tracking-tight">
        {stat.value.toLocaleString()}
      </span>
    </div>
  )
  return stat.href ? <Link href={stat.href} className="block h-full">{inner}</Link> : inner
}

const TONE_DOT: Record<NonNullable<RecentRow['tone']>, string> = {
  amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', zinc: 'bg-zinc-300 dark:bg-zinc-600',
}

const SECTION_ICON: Partial<Record<string, LucideIcon>> = {
  submissions: Inbox, tickets: Ticket, equipment: Boxes, customers: Building2, deals: DollarSign, gantt: CalendarRange,
  org_chart: Users, forms: FileText, employee_forms: FileText, pto: Calendar, sick: Clock,
  scheduling: Calendar, accrual: Clock, presentations: Presentation, employees: Users,
}

export default async function DepartmentDashboard({ role, displayName }: { role: Exclude<StaffRole, 'admin' | 'production'>; displayName: string }) {
  const { stats, recent } = await getRoleData(role)
  const matrix = await getPermMatrix()
  const quickLinks = ADMIN_SECTIONS.filter((s) => hasPermission(role, s.perm, matrix))

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">{ROLE_LABELS[role]}</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</span>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-5xl">
        <div>
          <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">
            {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h1>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => <StatCard key={s.label} stat={s} />)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recent.rows.length > 0 || recent.title ? (
            <Card className="lg:col-span-2">
              <CardHead
                title={recent.title}
                action={recent.viewAllHref && (
                  <Link href={recent.viewAllHref} className="text-[12px] font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors">
                    View all
                  </Link>
                )}
              />
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {recent.rows.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[13px] text-zinc-400 dark:text-zinc-600">{recent.emptyLabel}</div>
                ) : (
                  recent.rows.map((r) => (
                    <Link key={r.id} href={r.href} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.tone ? TONE_DOT[r.tone] : 'bg-zinc-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200 truncate">{r.primary}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate capitalize">{r.secondary}</p>
                      </div>
                      <ArrowRight size={13} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            </Card>
          ) : null}

          <Card className={recent.rows.length > 0 || recent.title ? '' : 'lg:col-span-3'}>
            <CardHead title="Quick Links" />
            <div className="p-3 grid grid-cols-2 gap-2">
              {quickLinks.map((s) => {
                const Icon = SECTION_ICON[s.perm] ?? FileText
                const label = s.href.split('/').pop()?.replace(/-/g, ' ') ?? s.perm
                return (
                  <Link key={s.href} href={s.href}
                    className="flex flex-col items-start gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors group">
                    <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      <Icon size={15} />
                    </span>
                    <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300 capitalize">{label}</span>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center pt-1 pb-4">
          Live data from your Supabase instance · scoped to your role&apos;s sections
        </p>
      </div>
    </div>
  )
}
