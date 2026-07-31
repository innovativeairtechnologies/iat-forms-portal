import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import DiagramStudio from './DiagramStudio'

/* Application Diagram Studio — the sales team builds the airflow figure that
 * goes into a proposal, then exports it as a PNG.
 *
 * Gated by the 'diagrams' perm, seeded for sales + engineering + marketing in
 * migration 073 (the code default in lib/roles.ts is only the fallback — the
 * migration is what actually grants access; see docs/roles-and-permissions.md).
 *
 * Like the Sizing Studio, the page is pure client-side: no reads, no writes, no
 * server actions. Work autosaves to the rep's browser and travels as a .json
 * file. That is deliberate for v1 — see docs/diagram-studio.md for what a
 * DB-backed library would add.
 */

export const metadata: Metadata = { title: 'Application Diagrams' }

export default async function DiagramStudioPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('diagrams')) redirect('/admin')

  return <DiagramStudio />
}
