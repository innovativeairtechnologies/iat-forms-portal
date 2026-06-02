import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { Inbox, TrendingUp, FileText, AlertCircle } from 'lucide-react'

async function getDashboardData() {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    { count: total },
    { count: thisWeek },
    { count: thisMonth },
    { count: unread },
    { data: recent },
    { data: forms },
    { data: formCounts },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', startOfWeek.toISOString()),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', startOfMonth.toISOString()),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('submissions').select('id,form_id,form_title,submitted_at,is_read').order('submitted_at', { ascending: false }).limit(10),
    supabaseAdmin.from('forms').select('id,title,slug').eq('is_active', true).order('title'),
    supabaseAdmin.from('submissions').select('form_id').eq('is_read', false),
  ])

  const unreadByForm: Record<string, number> = {}
  ;(formCounts || []).forEach((s: { form_id: string }) => {
    unreadByForm[s.form_id] = (unreadByForm[s.form_id] || 0) + 1
  })

  return { total, thisWeek, thisMonth, unread, recent: recent || [], forms: forms || [], unreadByForm }
}

export default async function AdminDashboard() {
  const { total, thisWeek, thisMonth, unread, recent, forms, unreadByForm } = await getDashboardData()

  const stats = [
    { label: 'All Time', value: total ?? 0, icon: FileText, color: 'text-[#1a1a2e]' },
    { label: 'This Month', value: thisMonth ?? 0, icon: TrendingUp, color: 'text-[#0a7cff]' },
    { label: 'This Week', value: thisWeek ?? 0, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Unread', value: unread ?? 0, icon: AlertCircle, color: 'text-orange-500' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Submission activity overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-[8px] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</span>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Submissions */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-[8px]">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#1a1a2e] text-sm">Recent Submissions</h2>
            <Link href="/admin/submissions" className="text-xs text-[#0a7cff] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">No submissions yet</div>
            )}
            {recent.map((sub: { id: string; form_title: string | null; submitted_at: string; is_read: boolean }) => (
              <Link
                key={sub.id}
                href={`/admin/submissions/${sub.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.is_read ? 'bg-gray-200' : 'bg-[#0a7cff]'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${sub.is_read ? 'text-gray-600' : 'font-semibold text-[#1a1a2e]'}`}>
                    {sub.form_title || 'Unknown Form'}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(sub.submitted_at)}</p>
                </div>
                {!sub.is_read && (
                  <span className="text-[10px] font-semibold text-[#0a7cff] bg-[#e8f2ff] px-1.5 py-0.5 rounded">NEW</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Forms Quick Links */}
        <div className="bg-white border border-gray-200 rounded-[8px]">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#1a1a2e] text-sm">Active Forms</h2>
            <Link href="/admin/forms" className="text-xs text-[#0a7cff] hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {forms.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">No forms yet</div>
            )}
            {forms.map((form: { id: string; title: string; slug: string }) => (
              <Link
                key={form.id}
                href={`/admin/submissions?form_id=${form.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Inbox size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-[#1a1a2e] truncate">{form.title}</span>
                </div>
                {unreadByForm[form.id] ? (
                  <span className="text-xs font-bold text-white bg-[#0a7cff] px-2 py-0.5 rounded-full">
                    {unreadByForm[form.id]}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
