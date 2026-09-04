import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { firstNameOf } from '@/lib/display-name'
import PageChrome from '@/app/admin/PageChrome'
import TimeClockClient from './TimeClockClient'

// Self-service punch clock, in the admin shell under '/admin/me' — which is in
// OPEN_ADMIN_PREFIXES, so it needs no permission and every admin-surface role
// reaches it. This is the page the QR at the door lands on.

export const dynamic = 'force-dynamic'

export default async function TimeClockPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/me/time-clock')

  const { data: emp } = await supabaseAdmin
    .from('employees').select('id, name').eq('id', user.id).maybeSingle()

  // The jobs THIS person has touched recently, newest first. One tap beats
  // typing a job number on a phone with gloves on, and the list is theirs rather
  // than everyone's so it stays short enough to scan.
  let recentJobs: string[] = []
  if (emp) {
    const { data: shifts } = await supabaseAdmin
      .from('time_shifts').select('id').eq('employee_id', emp.id)
      .order('started_at', { ascending: false }).limit(25)
    const ids = (shifts ?? []).map(s => s.id)
    if (ids.length) {
      const { data: segs } = await supabaseAdmin
        .from('time_segments').select('job_number, started_at')
        .in('shift_id', ids).not('job_number', 'is', null)
        .order('started_at', { ascending: false }).limit(60)
      recentJobs = [...new Set((segs ?? []).map(s => s.job_number as string))].slice(0, 6)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <PageChrome record="Time Clock" />
      <TimeClockClient firstName={firstNameOf(emp?.name ?? '')} recentJobs={recentJobs} />
    </div>
  )
}
