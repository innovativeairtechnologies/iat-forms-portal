export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import SchedulingCalendar from './SchedulingCalendar'

export default async function SchedulingPage() {
  // Show confirmed (approved) and upcoming (pending) time off. Denied requests
  // are excluded from the planning calendar.
  const { data: requests } = await supabaseAdmin
    .from('time_off_requests')
    .select('*, employees!time_off_requests_employee_id_fkey(*)')
    .in('status', ['approved', 'pending'])
    .order('start_date', { ascending: true })

  return <SchedulingCalendar requests={requests || []} />
}
