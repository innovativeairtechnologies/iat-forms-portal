import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getSizingCatalog } from '@/lib/dryware-sizing'
import SizingStudio from './SizingStudio'

/* Sizing Studio — psychrometric desiccant dehumidifier selection.
 *
 * Gated by the 'sizing' perm, which is admin-only by omission from
 * DEFAULT_ROLE_PERMS (the same approach as the SRV editor) — so no
 * role_permissions migration or check-perm-seed change is needed. Hand it to Sales
 * later from /admin/permissions, or seed the grant in a migration then.
 *
 * The only server work is fetching the product catalog from Dryware, which falls
 * back to the baked-in copy if Dryware is unreachable (and tells the UI which one
 * it used — a silent fallback to stale data is the failure mode to avoid). All the
 * sizing maths then runs client-side in lib/sizing.ts; nothing here writes.
 */

export const metadata: Metadata = { title: 'Sizing Studio' }

// The catalog changes when engineering adds a product — rarely. Cache it briefly so
// a rep tabbing between pages doesn't hit Dryware on every navigation.
export const revalidate = 900

export default async function SizingStudioPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('sizing')) redirect('/admin')

  const { sizes, source, error } = await getSizingCatalog()

  return <SizingStudio catalog={sizes} catalogSource={source} catalogError={error} />
}
