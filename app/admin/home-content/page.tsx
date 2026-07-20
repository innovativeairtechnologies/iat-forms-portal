export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import { HomeContentManager } from './HomeContentManager'

/* /admin/home-content — manage the editorial content behind the company home
   (/home): news, calendar events, open positions, and spotlights. Gated by the
   'home_content' perm (admin-only by default). Reads every row (published +
   drafts) directly; the home page itself falls back to code defaults when a
   table is empty (see docs/company-home.md). */

export default async function AdminHomeContentPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('home_content')) redirect('/admin')

  const [ann, evt, job, spot, emps, customers] = await Promise.all([
    supabaseAdmin.from('announcements').select('*').order('pinned', { ascending: false }).order('published_at', { ascending: false }),
    supabaseAdmin.from('company_events').select('*').order('starts_on', { ascending: false }),
    supabaseAdmin.from('job_openings').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true }),
    supabaseAdmin.from('employee_spotlights').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('employees').select('id, name, job_title, department').eq('is_active', true).order('name'),
    getCustomerIds(),
  ])

  const staff = (emps.data || []).filter((e: any) => !customers.has(e.id))
  const tablesMissing = !!(ann.error || evt.error || job.error || spot.error)

  return (
    <HomeContentManager
      announcements={ann.data || []}
      events={evt.data || []}
      openings={job.data || []}
      spotlights={spot.data || []}
      employees={staff}
      tablesMissing={tablesMissing}
    />
  )
}
