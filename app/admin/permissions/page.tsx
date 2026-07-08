export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getPermMatrix } from '@/lib/permissions'
import PermissionsMatrix from './PermissionsMatrix'

// Admin-only permission matrix. The 'permissions' perm is non-delegatable, so
// only a full admin's can() returns true here (scoped roles are redirected, and
// middleware gates the path too).
export default async function PermissionsPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('permissions')) redirect('/admin')

  const matrix = await getPermMatrix()
  return <PermissionsMatrix initialMatrix={matrix} />
}
