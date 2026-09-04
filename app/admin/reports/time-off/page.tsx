export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import TimeOffReportClient from './TimeOffReportClient'

export default async function TimeOffReportPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor?.can('accrual')) notFound()

  const [
    { data: employees },
    { data: tiers },
    { data: configs },
    customerIds,
  ] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, email, job_title, hire_date, pto_balance, sick_balance, pto_accrual_rate, sick_accrual_rate')
      .order('name'),
    supabaseAdmin.from('accrual_tiers').select('*').order('sort_order'),
    supabaseAdmin.from('accrual_config').select('sick_weekly_rate, pto_cap_hours, sick_cap_hours').eq('id', 1).limit(1),
    getCustomerIds(),
  ])

  const staff = (employees ?? []).filter(e => !customerIds.has(e.id))
  const config = configs?.[0] ?? null

  return (
    <TimeOffReportClient
      staff={staff}
      tiers={tiers ?? []}
      config={config}
      canEdit={actor.can('employees')}
    />
  )
}
