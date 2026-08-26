export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { listAssignees, listTasks } from '@/lib/eng-data'
import TaskQueueClient from '../TaskQueueClient'

/* /admin/engineering/tasks — every unit of engineering work, filterable.
 *
 * The list is loaded WHOLE (jobs and standing work, open and finished) and
 * filtered in the browser. That is a deliberate choice at this size: the
 * department runs tens of jobs, not tens of thousands, and every filter being
 * instant is what makes "show me what nobody owns" a thing people actually
 * click. Revisit if this ever passes a few thousand rows.
 */
export default async function EngineeringTasksPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const [tasks, assignees] = await Promise.all([listTasks(), listAssignees()])

  return (
    <TaskQueueClient
      rows={tasks}
      assignees={assignees}
      overline="Engineering"
      title="Task Queue"
      blurb="Every task across every bucket — job work and everything else"
    />
  )
}
