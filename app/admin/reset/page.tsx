import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import ResetClient from './ResetClient'

export const dynamic = 'force-dynamic'

const STAFF_NON_ADMIN_ROLES = [
  'sales', 'hr', 'marketing', 'engineering', 'production_manager', 'production', 'employee',
]

export default async function ResetPage() {
  // Full-admin only. Middleware also gates /admin/reset behind the 'system' perm,
  // but re-check here as defense in depth (getAdminUser is strict).
  const admin = await getAdminUser()
  if (!admin) redirect('/admin')

  const head = { count: 'exact' as const, head: true }
  const [
    { count: submissions },
    { count: tickets },
    { count: equipment },
    { count: customers },
    { count: pto },
    { count: sick },
    { count: employees },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', head),
    supabaseAdmin.from('tickets').select('*', head),
    supabaseAdmin.from('equipment').select('*', head),
    supabaseAdmin.from('customers').select('*', head),
    supabaseAdmin.from('time_off_requests').select('*', head).eq('type', 'pto'),
    supabaseAdmin.from('time_off_requests').select('*', head).eq('type', 'sick'),
    supabaseAdmin.from('profiles').select('*', head).in('role', STAFF_NON_ADMIN_ROLES).neq('id', admin.user.id),
  ])

  return (
    <ResetClient
      counts={{
        submissions: submissions ?? 0,
        tickets: tickets ?? 0,
        equipment: equipment ?? 0,
        customers: customers ?? 0,
        pto: pto ?? 0,
        sick: sick ?? 0,
        employees: employees ?? 0,
      }}
    />
  )
}
