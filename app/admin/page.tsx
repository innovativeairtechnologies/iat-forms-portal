export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import DepartmentDashboard from '@/components/admin/DepartmentDashboard'
import SalesDashboardView from '@/components/dashboards/SalesDashboardView'
import { STAFF_ROLES, type StaffRole } from '@/lib/roles'
import type { Deal } from '@/lib/supabase'

/* ────────────────────────────────────────────────────────────────────────────
   /admin dashboard router. Every admin-surface role lands on the customizable
   card dashboard (components/admin/DepartmentDashboard — admin gets the executive
   card set, scoped roles their department set), EXCEPT Sales, which keeps its
   dedicated command center. A full admin can preview any role's dashboard
   read-only via the `va_role` "View as" cookie; access is still governed by the
   real session role in middleware, so a preview never grants reach or locks out.
   ──────────────────────────────────────────────────────────────────────────── */

async function salesDashboard(displayName: string) {
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: deals }, { count: followUpsDue }] = await Promise.all([
    supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('deal_follow_ups').select('*', { count: 'exact', head: true }).eq('done', false).lte('due_date', today),
  ])
  return <SalesDashboardView deals={(deals ?? []) as Deal[]} displayName={displayName} followUpsDue={followUpsDue ?? 0} />
}

export default async function AdminDashboard() {
  const surfaceUser = await getAdminSurfaceUser()
  if (!surfaceUser) return null // the admin layout already gates + redirects

  // "View as" preview (admin only).
  if (surfaceUser.role === 'admin') {
    const vaRaw = (await cookies()).get('va_role')?.value
    const preview = vaRaw && vaRaw !== 'admin' && (STAFF_ROLES as readonly string[]).includes(vaRaw) ? (vaRaw as StaffRole) : null
    if (preview === 'sales') return await salesDashboard(surfaceUser.displayName)
    if (preview === 'production') {
      return (
        <div className="flex-1 flex items-center justify-center bg-canvas p-8 min-h-0">
          <div className="max-w-sm text-center">
            <p className="text-[14px] font-semibold text-ink">Production staff</p>
            <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">
              Base production staff land on the Company Home and use the employee tools — they don&apos;t have an operations dashboard.
            </p>
          </div>
        </div>
      )
    }
    if (preview) {
      return <DepartmentDashboard role={preview as Exclude<StaffRole, 'production'>} displayName={surfaceUser.displayName} userId={surfaceUser.user.id} preview />
    }
  }

  // Sales keeps its dedicated command center.
  if (surfaceUser.role === 'sales') return await salesDashboard(surfaceUser.displayName)

  // Admin + the other scoped roles get the customizable card dashboard.
  return <DepartmentDashboard role={surfaceUser.role as Exclude<StaffRole, 'production'>} displayName={surfaceUser.displayName} userId={surfaceUser.user.id} />
}
