import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminTopBar from './AdminTopBar'
import RefreshOnNavigate from '@/components/admin/RefreshOnNavigate'
import CommandPalette from '@/components/admin/CommandPalette'
import { ViewAsProvider, ViewAsBanner } from '@/components/admin/ViewAs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserFormDraftCount } from '@/lib/drafts'
import { getPermMatrix } from '@/lib/permissions'
import { STAFF_ROLES, type StaffRole } from '@/lib/roles'
import { DASH_PRESET_COOKIE, PRESETS, type Preset } from './dashboard-presets'

export const metadata: Metadata = {
  title: 'IAT Operations',
  description: 'Operations admin portal for Innovative Air Technologies',
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')

  const [
    { count: unreadCount },
    { count: openTickets },
    { count: ptoPending },
    { count: sickPending },
    { count: usRotorsOrders },
    { count: newIntakes },
    draftCount,
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'pto').eq('status', 'pending'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'sick').eq('status', 'pending'),
    supabaseAdmin.from('us_rotors_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('troubleshooting_intakes').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    getUserFormDraftCount(),
  ])

  const permMatrix = await getPermMatrix()

  const cookieStore = await cookies()
  const presetRaw = cookieStore.get(DASH_PRESET_COOKIE)?.value
  const preset: Preset = (PRESETS as readonly string[]).includes(presetRaw ?? '') ? (presetRaw as Preset) : 'balanced'

  // Seed the "View as" preview from the va_role cookie (admins only) so the
  // client provider agrees with the server-rendered page after a refresh.
  const vaRaw = cookieStore.get('va_role')?.value
  const viewAsInit: StaffRole | null =
    admin.role === 'admin' && vaRaw && vaRaw !== 'admin' && (STAFF_ROLES as readonly string[]).includes(vaRaw)
      ? (vaRaw as StaffRole)
      : null

  return (
    <ViewAsProvider realRole={admin.role} permMatrix={permMatrix} initialViewAs={viewAsInit}>
      <div className="min-h-screen flex bg-canvas">
        <RefreshOnNavigate />
        <CommandPalette />
        <AdminSidebar
          unreadCount={unreadCount ?? 0}
          ticketCount={openTickets ?? 0}
          troubleshootingCount={newIntakes ?? 0}
          ptoPending={ptoPending ?? 0}
          sickPending={sickPending ?? 0}
          usRotorsOrders={usRotorsOrders ?? 0}
          draftCount={draftCount}
          adminName={admin.displayName}
        />
        {/* pt-14 clears the fixed mobile top bar (the sidebar's old h-14 spacer sat in
            this flex-row, so it never actually pushed content down) */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden pt-14 md:pt-0">
          <AdminTopBar
            displayName={admin.displayName}
            unreadCount={unreadCount ?? 0}
            ticketCount={openTickets ?? 0}
            preset={preset}
          />
          <ViewAsBanner />
          {children}
        </div>
      </div>
    </ViewAsProvider>
  )
}
