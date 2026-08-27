export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { carryForwardThemes, listPreflights, recentJobs } from '@/lib/pp-data'
import PreflightListClient from './PreflightListClient'

/* /admin/engineering/post-production/preflight — pre-production checks.
 *
 * The other half of the loop. Post-production catches what went wrong; this is
 * where it stops happening again:
 *
 *   "All those issues are automatically carried over to the next pre-production
 *    meeting… that might be a checklist."
 *
 * Opening a check for a job generates its lines from the recurring issues that
 * are still open. Nobody has to remember to add anything, and nobody gets to
 * quietly leave the awkward one off.
 */
export default async function PreflightIndex() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const [checks, carry, jobs] = await Promise.all([
    listPreflights(),
    carryForwardThemes(),
    recentJobs(60),
  ])

  return <PreflightListClient checks={checks} carry={carry} jobs={jobs} />
}
