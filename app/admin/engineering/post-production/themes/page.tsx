export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { listFindings, listThemes } from '@/lib/pp-data'
import ThemesClient from './ThemesClient'

/* /admin/engineering/post-production/themes — the recurring issues.
 *
 * "If all of a sudden it's like guys, we've brought these up twelve times
 * before… same comments, same issues."
 *
 * This is the screen that sentence lives on, and the reason the counts are
 * computed rather than stored, and the reason a model's guess is displayed
 * separately from a person's confirmation. A number leadership acts on has to
 * survive somebody checking it.
 */
export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { open } = await searchParams
  const [themes, findings] = await Promise.all([listThemes(), listFindings()])

  return (
    <ThemesClient
      themes={themes}
      findings={findings}
      openId={open ?? null}
      /* /api/admin/bulk-delete is full-admin only; this page is gated on
         engineering_jobs. Resolved here so a scoped role never sees a Delete
         that 403s. */
      canDelete={actor.role === 'admin'}
    />
  )
}
