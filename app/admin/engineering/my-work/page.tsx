export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { listAssignees, listTasks } from '@/lib/eng-data'
import { ListCardPage, ListCard, CardHead } from '@/components/admin/list-card'
import TaskQueueClient from '../TaskQueueClient'
import { Nothing } from '../ui'

/* /admin/engineering/my-work — one person's whole list.
 *
 * The meeting's clearest single ask: "the dashboard will help team members see
 * all pending tasks in one place, preventing last-minute surprises." One person
 * had not seen new submittals and long-lead items land; the fix is not another
 * notification, it is a page where none of it can be out of sight.
 *
 * ⚠️ An account with no `employees` row gets an explanation, not an empty list.
 * eng_tasks.assignee_id points at employees.id, and EMAIL IS THE ONLY JOIN
 * between an auth user and that row (see lib/my-employee.ts) — so "no row" means
 * "we cannot tell what is yours", which must never be rendered as "nothing is".
 */
export default async function MyEngineeringWorkPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const employeeId = await employeeIdForEmail(actor.user.email)

  if (!employeeId) {
    return (
      <ListCardPage>
        <ListCard>
          <CardHead overline="Engineering" title="My Work" />
          <Nothing>
            Your sign-in isn&apos;t linked to a person record, so we can&apos;t tell which tasks are yours.
            Ask an admin to check that your portal account and your employee record use the same email address.
          </Nothing>
        </ListCard>
      </ListCardPage>
    )
  }

  const [tasks, assignees] = await Promise.all([
    listTasks({ assigneeId: employeeId }),
    listAssignees(),
  ])

  return (
    <TaskQueueClient
      rows={tasks}
      assignees={assignees}
      scope="mine"
      overline="Engineering"
      title="My Work"
      blurb={`Everything assigned to ${actor.displayName} — every bucket, every job`}
    />
  )
}
