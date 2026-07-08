export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getSrvSections } from '@/lib/srv-config'
import SrvEditor from './SrvEditor'

// Edit the Start-Up Readiness Verification content (its checklist items, readings,
// and photos per section). Gated by the 'srv' perm (admin-only by default).
export default async function AdminSrvPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('srv')) redirect('/admin')

  const sections = await getSrvSections()
  return <SrvEditor initialSections={sections} />
}
