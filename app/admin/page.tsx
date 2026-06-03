export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Plus, ArrowRight, Inbox, FileText, ClipboardList } from 'lucide-react'
import DashboardShell from './DashboardShell'

async function getData() {
  const [
    { count: total },
    { count: unread },
    { count: activeForms },
    { data: recent },
    { data: allForPeople },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin
      .from('submissions')
      .select('id,form_title,submitted_at,is_read,data,status')
      .order('submitted_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('submissions')
      .select('data,submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(500),
  ])

  // Aggregate unique submitters from raw data
  const map = new Map<string, { name: string; email: string; count: number; lastSeen: string }>()
  for (const sub of allForPeople || []) {
    const name = String(
      sub.data?.['Employee Name'] || sub.data?.['Full Name'] || sub.data?.['Name'] || 'Anonymous'
    )
    const email = String(
      sub.data?.['Employee Email'] || sub.data?.['Email'] || sub.data?.['Email Address'] || ''
    )
    const key = email || name
    if (!map.has(key)) {
      map.set(key, { name, email, count: 0, lastSeen: sub.submitted_at })
    }
    map.get(key)!.count++
  }
  const people = Array.from(map.values()).sort(
    (a, b) => b.count - a.count || new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  )

  return {
    total: total ?? 0,
    unread: unread ?? 0,
    activeForms: activeForms ?? 0,
    recent: recent || [],
    people,
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function avatarColor(name: string): string {
  const palette = [
    'bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400',
    'bg-violet-100 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400',
    'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400',
    'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400',
    'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400',
    'bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400',
    'bg-pink-100 dark:bg-pink-950/70 text-pink-600 dark:text-pink-400',
    'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  in_progress: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
  resolved:    'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
}

export default async function AdminDashboard() {
  const { total, unread, activeForms, recent, people } = await getData()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const panel = (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white">People</h2>
          {people.length > 0 && (
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full tabular-nums">
              {people.length}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400">Recent form submitters</p>
      </div>

      {/* Submitter list */}
      {people.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16 text-center px-6">
          <div>
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <span className="text-[18px]">👤</span>
            </div>
            <p className="text-[13px] font-medium text-gray-400">No submitters yet</p>
            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1 leading-relaxed">
              People who submit forms will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-50 dark:divide-gray-800/60 overflow-y-auto">
          {people.map((person) => {
            const initials =
              person.name === 'Anonymous'
                ? '?'
                : person.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
            const searchParam = encodeURIComponent(person.email || person.name)
            return (
              <li key={person.email || person.name}>
                <Link
                  href={`/admin/submissions?search=${searchParam}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${avatarColor(person.name)}`}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-[#089447] transition-colors">
                      {person.name}
                    </p>
                    {person.email && (
                      <p className="text-[11px] text-gray-400 truncate">{person.email}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full tabular-nums">
                    {person.count}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Footer note */}
      {people.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <p className="text-[10px] text-gray-300 dark:text-gray-700 text-center">
            Aggregated from form submissions · {people.length} unique {people.length === 1 ? 'person' : 'people'}
          </p>
        </div>
      )}
    </div>
  )

  return (
    <DashboardShell panel={panel} unreadCount={unread}>
      <div className="p-6 space-y-5">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0c1a2e 0%, #0d1f35 40%, #0a1f18 100%)' }}>
          <div
            className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, #089447 0%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/3 w-64 h-48 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
          />
          <div className="relative px-8 py-8 sm:py-10">
            <p className="text-[11px] font-bold text-[#34d399] uppercase tracking-widest mb-3">{today}</p>
            <h1 className="text-[26px] sm:text-[30px] font-bold text-white leading-tight tracking-tight mb-2">
              Welcome back, Admin
            </h1>
            <p className="text-[14px] text-gray-400 mb-6 max-w-sm leading-relaxed">
              Manage employee forms, review submissions, and stay on top of your organization.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/forms/new"
                className="inline-flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <Plus size={14} />
                New Form
              </Link>
              <Link
                href="/admin/submissions"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-gray-300 hover:text-white transition-colors"
              >
                View Submissions
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Compact stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CompactStat
            icon={<ClipboardList size={15} className="text-gray-400 dark:text-gray-500" />}
            label="Total Submissions"
            value={total}
          />
          <CompactStat
            icon={<FileText size={15} className="text-gray-400 dark:text-gray-500" />}
            label="Active Forms"
            value={activeForms}
          />
          <CompactStat
            icon={<Inbox size={15} className={unread > 0 ? 'text-[#089447]' : 'text-gray-400 dark:text-gray-500'} />}
            label="Unread"
            value={unread}
            highlight={unread > 0}
            href="/admin/submissions?is_read=false"
          />
        </div>

        {/* Recent submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Recent Submissions</h2>
              {total > 0 && (
                <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
                  {total}
                </span>
              )}
            </div>
            <Link
              href="/admin/submissions"
              className="flex items-center gap-1 text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
            {recent.length === 0 ? (
              <div className="py-20 text-center">
                <Inbox size={24} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-gray-400">No submissions yet</p>
                <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">
                  They&apos;ll show up here once employees start submitting forms.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                {recent.map((sub: {
                  id: string
                  form_title: string | null
                  submitted_at: string
                  is_read: boolean
                  status?: string
                  data: Record<string, unknown>
                }) => {
                  const name = String(
                    sub.data?.['Employee Name'] ||
                    sub.data?.['Full Name'] ||
                    sub.data?.['Name'] ||
                    'Anonymous'
                  )
                  const email = sub.data?.['Employee Email'] || sub.data?.['Email'] || sub.data?.['Email Address']
                  const initials = name === 'Anonymous'
                    ? '?'
                    : name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                  const status = sub.status || 'open'

                  return (
                    <li key={sub.id}>
                      <Link
                        href={`/admin/submissions/${sub.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        <div className="flex-shrink-0 w-1.5">
                          {!sub.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#089447]" />}
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold ${avatarColor(name)}`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-[13px] truncate transition-colors group-hover:text-[#089447] ${sub.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-white'}`}>
                              {name}
                            </p>
                            {!sub.is_read && (
                              <span className="flex-shrink-0 text-[10px] font-bold text-[#089447] bg-[#f0faf4] dark:bg-[#089447]/20 px-1.5 py-0.5 rounded-full">
                                NEW
                              </span>
                            )}
                          </div>
                          {typeof email === 'string' && email && (
                            <p className="text-[11px] text-gray-400 truncate">{email}</p>
                          )}
                        </div>
                        <span className="hidden sm:inline-flex flex-shrink-0 text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-lg whitespace-nowrap">
                          {sub.form_title || '—'}
                        </span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.open}`}>
                            {STATUS_LABELS[status] || 'Open'}
                          </span>
                          <span className="text-[12px] text-gray-400 tabular-nums w-16 text-right">
                            {timeAgo(sub.submitted_at)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

      </div>
    </DashboardShell>
  )
}

function CompactStat({
  icon,
  label,
  value,
  highlight = false,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  highlight?: boolean
  href?: string
}) {
  const content = (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border shadow-card px-4 py-3 flex items-center gap-3 transition-all ${
      highlight && value > 0
        ? 'border-l-[3px] border-l-[#089447] border-gray-100 dark:border-gray-800 border-t border-r border-b'
        : 'border-gray-100 dark:border-gray-800'
    } ${href ? 'hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-card-hover cursor-pointer' : ''}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className={`text-[22px] font-bold tracking-tight leading-none ${
          highlight && value > 0 ? 'text-[#089447]' : 'text-gray-900 dark:text-white'
        }`}>
          {value.toLocaleString()}
        </p>
        <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
