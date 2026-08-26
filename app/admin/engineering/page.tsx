export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildStatusBoard, listTasks, rollUpByPerson } from '@/lib/eng-data'
import StatusBoardClient from './StatusBoardClient'

/* /admin/engineering — the Status Box.
 *
 * The screen drawn on the whiteboard on 2026-08-25: one tile per bucket, each
 * carrying a count, a trend and the rows underneath it — job number, who owns
 * it, when it is due, and ahead or behind with a number of days.
 *
 * Gated twice. The middleware maps /admin/engineering → `engineering_jobs` in
 * ADMIN_PATH_PERMS, and this page checks the same perm again. Four lines of
 * belt-and-braces is worth it here: an unmapped /admin/* path falls back to
 * `dashboard`, which every scoped role holds, so an edit to the matcher that
 * dropped this prefix would put the whole department's per-person workload in
 * front of HR and marketing rather than failing closed.
 */
export default async function EngineeringStatusBoard({
  searchParams,
}: {
  searchParams: Promise<{ tv?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { tv } = await searchParams

  const [board, openTasks, { count: activeJobs }] = await Promise.all([
    buildStatusBoard(),
    listTasks({ openOnly: true }),
    supabaseAdmin.from('eng_jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return (
    <StatusBoardClient
      board={board}
      people={rollUpByPerson(openTasks)}
      activeJobs={activeJobs ?? 0}
      // `?tv=1` is the wall display in the engineering department — the meeting's
      // "displayed on a screen for live updates". Same data, no chrome, bigger
      // type, and it refreshes itself.
      wall={tv === '1'}
    />
  )
}
