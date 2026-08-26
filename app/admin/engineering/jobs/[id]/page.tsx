export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getJob, getPlaybook, listAssignees, rollUpJob } from '@/lib/eng-data'
import JobDetailClient from './JobDetailClient'

/* /admin/engineering/jobs/[id] — one job, every bucket, every task.
 *
 * notFound() rather than a redirect for an unauthorized caller, so they cannot
 * tell "not allowed" from "not a page" — the same rule the reports take.
 */
export default async function EngineeringJobPage(props: { params: Promise<{ id: string }> }) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) notFound()

  const { id } = await props.params
  const found = await getJob(id)
  if (!found) notFound()

  const [assignees, playbook] = await Promise.all([listAssignees(), getPlaybook()])

  // On-demand steps for the "add a task" menu — revision rounds, support calls.
  // Read from the live playbook so a hand-added revision inherits the same
  // 1-hour / 3-day standard a generated task gets.
  const onDemand = playbook.streams.flatMap(s =>
    s.steps.filter(st => st.onDemand).map(st => ({ stream: s.stream, step: st.key, title: st.title })),
  )

  return (
    <JobDetailClient
      job={found.job}
      tasks={found.tasks}
      rollUp={rollUpJob(found.job, found.tasks)}
      assignees={assignees}
      onDemand={onDemand}
      canDelete={actor.role === 'admin'}
    />
  )
}
