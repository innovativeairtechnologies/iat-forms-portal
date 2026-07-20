export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { HomePage } from '@/app/home/HomePage'

/* Company Home for admin-surface roles — the shared intranet landing rendered
   INSIDE the admin shell (app/admin/layout.tsx supplies the sidebar). Open to any
   admin-surface role: '/admin/home' is listed in OPEN_ADMIN_PREFIXES so the
   middleware doesn't gate it to full admin. */

export default async function AdminHome() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  // Admin content column has no top bar above the page → fill the full viewport.
  return <HomePage name={admin.displayName} heightClass="lg:h-[calc(100dvh-12px)]" />
}
