import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserLearnStats } from '@/lib/learn'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import {
  Calendar, Clock, Briefcase, Building2, CalendarClock, FileText, Wrench, Users,
  GraduationCap, Flame, ArrowRight, Sparkles, UserCog, Package,
} from 'lucide-react'
import type { Employee, TimeOffRequest } from '@/lib/supabase'

/* Employee home — dashboard-first (mirrors /admin): a dark greeting band, a KPI
   row, the employee's own time-off + learning progress, and quick links. The
   editable profile form lives at /employee/profile/edit. Real data only — no
   fabricated charts, same rule as the admin dashboard. */

export const dynamic = 'force-dynamic'

const REQ_PILL: Record<string, string> = {
  pending:  'border-amber-300/60 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  denied:   'border-rose-300/60 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tenureLabel(hireDate: string): string {
  const start = new Date(hireDate + 'T00:00:00')
  const months = Math.max(0, Math.floor((Date.now() - start.getTime()) / (30.44 * 864e5)))
  if (months < 12) return `${months} mo${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}m` : `${years} yr${years === 1 ? '' : 's'}`
}

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function EmployeeHome() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: employee }, { data: reqRows }, learn] = await Promise.all([
    supabaseAdmin.from('employees').select('*').eq('id', user.id).single(),
    supabaseAdmin.from('time_off_requests').select('*').eq('employee_id', user.id).order('created_at', { ascending: false }),
    getUserLearnStats(user.id).catch(() => null),
  ])
  if (!employee) redirect('/login')
  const emp = employee as Employee

  const requests = (reqRows ?? []) as TimeOffRequest[]
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const recent = requests.slice(0, 4)

  // Greeting + date anchored to Eastern time (IAT is US-based; matches /admin).
  const hourET = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10,
  )
  const dateET = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })
  const firstName = emp.name?.trim().split(' ')[0] || ''
  const hasLearn = !!learn && learn.totalLessons > 0

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      <div className="mx-auto w-full max-w-[1400px] space-y-4 p-5 sm:p-6">

        {/* ── Greeting band ──────────────────────────────────────────── */}
        <PortalHero
          eyebrow={dateET}
          title={`${greeting(hourET)}${firstName ? `, ${firstName}` : ''}`}
          subtitle={
            pendingCount > 0
              ? <>You have <span className="font-semibold text-zinc-700 dark:text-zinc-200">{pendingCount}</span> request{pendingCount === 1 ? '' : 's'} awaiting review.</>
              : <>You&apos;re all caught up — have a great day. <Sparkles size={12} className="-mt-0.5 inline text-emerald-500 dark:text-emerald-400" /></>
          }
          actions={
            <>
              <HeroAction href="/employee/requests" icon={CalendarClock} label="Request time off" variant="primary" />
              <HeroAction href="/learn" icon={GraduationCap} label="Browse training" />
              <HeroAction href="/employee/profile/edit" icon={UserCog} label="Edit profile" />
            </>
          }
        />

        {/* ── KPI row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi icon={<Calendar size={15} />} color="#10b981"
            label="PTO Balance" value={emp.pto_balance} unit="hrs"
            sub={`+${emp.pto_accrual_rate} hrs / week accrual`} href="/employee/requests" />
          <Kpi icon={<Clock size={15} />} color="#f59e0b"
            label="Sick Balance" value={emp.sick_balance} unit="hrs"
            sub={`+${emp.sick_accrual_rate} hrs / week accrual`} href="/employee/requests" />
          {emp.hire_date ? (
            <Kpi icon={<Briefcase size={15} />} color="#8b5cf6"
              label="Tenure" value={tenureLabel(emp.hire_date)} unit=""
              sub={`Since ${new Date(emp.hire_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`} />
          ) : (
            <Kpi icon={<Building2 size={15} />} color="#8b5cf6"
              label="Department" value={emp.department || '—'} unit=""
              sub="Set it in Edit profile" href="/employee/profile/edit" />
          )}
          <Kpi icon={<CalendarClock size={15} />} color="#0ea5e9"
            label="Pending Requests" value={pendingCount} unit={pendingCount === 1 ? 'request' : 'requests'}
            sub="Awaiting admin review" href="/employee/requests" />
        </div>

        {/* ── Time off + Learning ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* My time off */}
          <Card>
            <CardHead icon={<CalendarClock size={14} />} title="My Time Off"
              action={<Link href="/employee/requests" className="text-[12px] font-medium text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400">View all</Link>} />
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] text-zinc-400 dark:text-zinc-600">No requests yet</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {recent.map(r => (
                  <Link key={r.id} href="/employee/requests"
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
                        {r.type === 'pto' ? 'PTO' : 'Sick'} · {r.hours_requested} hrs
                      </p>
                      <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                        {fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex flex-shrink-0 items-center rounded-md border px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider ${REQ_PILL[r.status] || REQ_PILL.pending}`}>
                      {r.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* My learning */}
          <Card>
            <CardHead icon={<GraduationCap size={14} />} title="My Learning"
              action={hasLearn && learn!.currentStreak > 0
                ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500"><Flame size={13} /> {learn!.currentStreak}-day streak</span>
                : <Link href="/learn" className="text-[12px] font-medium text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400">Open</Link>} />
            {hasLearn ? (
              <div className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-bold text-zinc-900 dark:text-white">Level {learn!.level.level}</span>
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-400">{learn!.level.title}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#089447] to-[#44c07d]" style={{ width: `${learn!.level.progressPct}%` }} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                  <span className="tabular-nums">{learn!.totalXp.toLocaleString()} XP</span>
                  <span className="tabular-nums">{learn!.lessonsCompleted} / {learn!.totalLessons} lessons · {learn!.overallPct}%</span>
                </div>
                <Link href="/learn/me" className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400">
                  View my progress <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Start your first lesson to earn XP, build a streak, and unlock badges.</p>
                <Link href="/learn" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400">
                  Explore IAT Learn <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* ── Quick actions ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction icon={<FileText size={16} />} label="Submit a form" href="/employee/resources" />
          <QuickAction icon={<Users size={16} />} label="Team directory" href="/employee/directory" />
          <QuickAction icon={<Wrench size={16} />} label="Tools & apps" href="/employee/resources/tools" />
          <QuickAction icon={<Package size={16} />} label="US Rotors order" href="/employee/us-rotors/order" />
        </div>
      </div>
    </div>
  )
}

// ─── KPI card (matches /admin dashboard chrome; no fabricated sparklines) ─────
function Kpi({ icon, color, label, value, unit, sub, href }: {
  icon: React.ReactNode
  color: string
  label: string
  value: number | string
  unit: string
  sub: string
  href?: string
}) {
  const inner = (
    <div className="h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none dark:hover:border-zinc-700 dark:hover:bg-zinc-900/70">
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold leading-none tracking-tight text-zinc-900 tabular-nums dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{unit}</span>}
      </div>
      <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

// ─── Card shell (matches components/admin/detail-ui) ─────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
      {children}
    </div>
  )
}

function CardHead({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-3.5 dark:border-zinc-800/80">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      {action}
    </div>
  )
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href}
      className="group flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5">
      <span className="text-zinc-400 transition-colors group-hover:text-emerald-600 dark:text-zinc-500 dark:group-hover:text-emerald-400">{icon}</span>
      <span className="text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
    </Link>
  )
}
