export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { HomePage } from '@/app/home/HomePage'

/* Company Home for admin-surface roles — the shared intranet landing rendered
   INSIDE the admin shell (app/admin/layout.tsx supplies the sidebar). Open to any
   admin-surface role: '/admin/home' is listed in OPEN_ADMIN_PREFIXES so the
   middleware doesn't gate it to full admin. */

export default async function AdminHome() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')

  // Bell counts for the home top bar (submissions awaiting review + open tickets).
  const [{ count: unread }, { count: openTickets }] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  return (
    <HomePage
      name={admin.displayName}
      profileHref="/admin/profile"
      unreadCount={unread ?? 0}
      ticketCount={openTickets ?? 0}
    />
  )
}
