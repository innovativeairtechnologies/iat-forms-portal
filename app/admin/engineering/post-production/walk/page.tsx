export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { activeWalkFor, getWalkaround, recentJobs } from '@/lib/pp-data'
import { isTranscriptionConfigured } from '@/lib/transcribe'
import WalkClient from './WalkClient'

/* /admin/engineering/post-production/walk — the capture surface.
 *
 * This is the page somebody opens standing next to a unit, on a phone, with one
 * hand. Everything about it is shaped by that: big targets, one screen, no
 * modals to navigate, and every action saved the moment it happens rather than
 * at the end.
 *
 * ?walk=<id> resumes a specific walk; with no parameter the page picks up
 * whatever the signed-in person left open, so closing the browser at the far end
 * of the shop and reopening it does not lose anything.
 */
export default async function WalkPage({
  searchParams,
}: {
  searchParams: Promise<{ walk?: string; job?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { walk: walkParam, job } = await searchParams
  const myEmployeeId = await employeeIdForEmail(actor.user.email)

  const existing = walkParam
    ? await getWalkaround(walkParam)
    : await (async () => {
        const open = await activeWalkFor(myEmployeeId)
        return open ? await getWalkaround(open.id) : null
      })()

  // A walk that has already been handed over is not resumable — those findings
  // belong to engineering's queue now. Send the person to it rather than
  // silently starting a second walk on top of the first.
  if (existing?.walk.status === 'submitted') {
    redirect(`/admin/engineering/post-production?walk=${existing.walk.id}`)
  }

  return (
    <WalkClient
      initialWalk={existing?.walk ?? null}
      initialFindings={existing?.findings ?? []}
      jobs={await recentJobs()}
      prefillJob={job ?? ''}
      /* Checked on the SERVER so the page never offers a button that cannot
         work. Today this is false — the portal has one AI key (Anthropic) and
         Claude does not take audio — and the UI says so honestly instead of
         spinning. See lib/transcribe.ts. */
      transcriptionConfigured={isTranscriptionConfigured()}
    />
  )
}
