export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { buildSummary, listAssignees, listFindings } from '@/lib/pp-data'
import QueueClient from './QueueClient'

/* /admin/engineering/post-production — the findings queue.
 *
 * The screen that makes this different from the spreadsheet it replaces. Every
 * row has an owner, a date and a standing, and the tabs are the four questions
 * anybody actually asks: what is mine, what is late, what does nobody own, and
 * what is waiting on me to accept.
 *
 * Gated twice. Middleware maps /admin/engineering → `engineering_jobs` in
 * ADMIN_PATH_PERMS and this page checks the same perm again. The second check is
 * what makes a future matcher edit fail closed: an unmapped /admin/* path falls
 * back to `dashboard`, which every scoped role holds, so dropping the prefix
 * would put photographs of customers' units in front of HR and marketing rather
 * than 302ing them.
 */
export default async function PostProductionQueue({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; walk?: string }>
}) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { tab, walk } = await searchParams
  const myEmployeeId = await employeeIdForEmail(actor.user.email)

  const [findings, summary, assignees] = await Promise.all([
    listFindings(),
    buildSummary(),
    listAssignees(),
  ])

  return (
    <QueueClient
      findings={findings}
      summary={summary}
      assignees={assignees}
      myEmployeeId={myEmployeeId}
      initialTab={tab ?? 'open'}
      highlightWalk={walk ?? null}
      /* /api/admin/bulk-delete is FULL-ADMIN only, but this page is gated on
         `engineering_jobs` — which engineering and production_manager also
         hold. Resolved here because the client cannot know it, and rendering
         Delete for a scoped role would offer a button that 403s. Same shape as
         /admin/rfq. */
      canDelete={actor.role === 'admin'}
    />
  )
}
