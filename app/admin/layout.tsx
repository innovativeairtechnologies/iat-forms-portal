import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import AdminSidebar from '@/components/admin/AdminSidebar'
import RefreshOnNavigate from '@/components/admin/RefreshOnNavigate'
import CommandPalette from '@/components/admin/CommandPalette'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const metadata: Metadata = {
  title: 'IAT Operations',
  description: 'Operations admin portal for Innovative Air Technologies',
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')

  const [
    { count: unreadCount },
    { count: openTickets },
    { count: ptoPending },
    { count: sickPending },
    { count: usRotorsOrders },
    { count: newIntakes },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'pto').eq('status', 'pending'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'sick').eq('status', 'pending'),
    supabaseAdmin.from('us_rotors_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('troubleshooting_intakes').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ])

  return (
    <div className="min-h-screen flex bg-[#F7F6F3] dark:bg-zinc-950">
      <RefreshOnNavigate />
      <CommandPalette />
      <AdminSidebar
        unreadCount={unreadCount ?? 0}
        ticketCount={openTickets ?? 0}
        troubleshootingCount={newIntakes ?? 0}
        ptoPending={ptoPending ?? 0}
        sickPending={sickPending ?? 0}
        usRotorsOrders={usRotorsOrders ?? 0}
        adminName={admin.displayName}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
