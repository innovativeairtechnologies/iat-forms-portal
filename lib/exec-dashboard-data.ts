import { supabaseAdmin } from '@/lib/supabase-admin'

/* Shared loader for the admin EXECUTIVE dashboard cards (components/dashboards/
   exec-cards.tsx). Loaded once per render (DepartmentDashboard, when role ===
   'admin') and threaded through the card context so the ~9 exec cards read from
   one batch instead of each re-querying. Moved verbatim from the old inline
   app/admin/page.tsx getData(). Deterministic given the DB + now. */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function nameOf(data: Record<string, unknown>): string {
  return String(data?.['Employee Name'] || data?.['Full Name'] || data?.['Name'] || 'Anonymous')
}

export type ExecSub = {
  id?: string
  form_title: string | null
  submitted_at: string
  is_read: boolean
  status?: string
  data: Record<string, unknown>
}
export type ExecTkt = {
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
export type ExecAudit = {
  id: string
  actor_name: string | null
  action: string
  summary: string
  created_at: string
}

export async function getExecData() {
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

  const subs = (subSample || []) as ExecSub[]
  const tkts = (tktSample || []) as ExecTkt[]

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
  const recents = (recentSubs || []) as ExecSub[]
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
    activity, hourET: 0, dateET: '',
    recentAudit: (recentAudit || []) as ExecAudit[],
  }
}

export type ExecData = Awaited<ReturnType<typeof getExecData>>
