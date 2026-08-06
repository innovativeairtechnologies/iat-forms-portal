import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import PanelWorkbench from './PanelWorkbench'

/* c.pCO panel simulator — the working surface.
 *
 * This sits under /admin/tools, so it inherits the 'tools' perm through
 * ADMIN_PATH_PERMS longest-prefix matching and needs no new permission and no
 * migration.
 *
 * It is deliberately NOT listed in lib/tools.ts yet. The course this belongs to
 * lives in Learn, where completion is tracked and it can be assigned with a due
 * date; a second, untracked front door would let people "do the training"
 * without it counting. Add the launcher entry only if we decide we want that.
 * For now this is where the simulator gets driven and verified.
 */

export const metadata: Metadata = { title: 'Control Panel Simulator' }

export default async function PanelSimulatorPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('tools')) redirect('/admin')

  return <PanelWorkbench />
}
