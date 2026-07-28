import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import SizingStudio from './SizingStudio'

/* Sizing Studio — psychrometric desiccant dehumidifier selection.
 *
 * Gated by the 'sizing' perm, which is admin-only by omission from
 * DEFAULT_ROLE_PERMS (the same approach as the SRV editor) — so no
 * role_permissions migration or check-perm-seed change is needed. Hand it to Sales
 * later from /admin/permissions, or seed the grant in a migration then.
 *
 * The page is a pure calculator: no reads, no writes, no server actions. All the
 * work happens client-side in lib/sizing.ts.
 */

export const metadata: Metadata = { title: 'Sizing Studio' }

export default async function SizingStudioPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('sizing')) redirect('/admin')

  return <SizingStudio />
}
