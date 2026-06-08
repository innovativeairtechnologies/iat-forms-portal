import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')

  const { count } = await supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="min-h-screen flex bg-[#F7F6F3] dark:bg-gray-950">
      <AdminSidebar unreadCount={count ?? 0} adminName={admin.displayName} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
