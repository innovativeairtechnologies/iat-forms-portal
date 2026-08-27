export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getFinding, listAssignees, listThemes } from '@/lib/pp-data'
import FindingDetailClient from './FindingDetailClient'

/* /admin/engineering/post-production/[id] — one finding.
 *
 * Where the answer gets written. Everything the walk captured is here — the
 * words, the photographs, the clips, the recording — beside the two fields that
 * make it accountable: who owns it and what the solution is.
 */
export default async function FindingPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { id } = await params
  const finding = await getFinding(id)
  if (!finding) notFound()

  const [assignees, themes] = await Promise.all([listAssignees(), listThemes()])

  return <FindingDetailClient finding={finding} assignees={assignees} themes={themes} />
}
