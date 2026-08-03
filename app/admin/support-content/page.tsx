export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getSupportReferencePhotos } from '@/lib/support-reference-server'
import { SupportReferenceManager } from './SupportReferenceManager'

/* /admin/support-content — staff-managed content for the PUBLIC equipment
   support form. Today that's the two Wheel & Seals reference photos; it's the
   natural home for anything else the form shows that shouldn't need a deploy.

   Gated on 'tickets' (the audience that works the support queue), so it needs no
   new Perm key and no role_permissions seed. It's a sibling of /admin/tickets
   rather than a child so the longest-prefix match in ADMIN_PATH_PERMS stays
   unambiguous — and it must be listed there, because an unmapped /admin/* path
   falls back to 'dashboard', which every scoped role holds. */

export default async function AdminSupportContentPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('tickets')) redirect('/admin')

  const photos = await getSupportReferencePhotos()
  return <SupportReferenceManager initial={photos} />
}
