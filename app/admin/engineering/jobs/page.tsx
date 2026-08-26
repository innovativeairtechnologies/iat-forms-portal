export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getPlaybook, listJobs, listTasks, rollUpJob } from '@/lib/eng-data'
import JobsClient from './JobsClient'

/* /admin/engineering/jobs — every job, with its plan rolled up.
 *
 * The roll-up (progress, open, at-risk, next due) is computed here from ONE read
 * of the task table rather than per-job. A jobs list that fires a query per row
 * is the shape that works fine at twenty jobs and falls over at four hundred.
 */
export default async function EngineeringJobsPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const [jobs, tasks, playbook] = await Promise.all([listJobs(), listTasks(), getPlaybook()])

  // What the New Job dialog promises will happen, read from the LIVE playbook so
  // the promise cannot drift from what generation actually does. Three steps
  // whose dates a reader can check against a PO in their head; the rest of the
  // plan is on the job page a second later.
  const previewKeys: [string, string][] = [
    ['long_lead:identify', 'Long-lead list'],
    ['submittal:package_creation', 'Submittal package'],
    ['submittal:send_to_customer', 'Out to the customer'],
  ]
  const cycles = new Map<string, number | null>()
  for (const s of playbook.streams) for (const st of s.steps) cycles.set(`${s.stream}:${st.key}`, st.cycleDays)
  const preview = previewKeys
    .filter(([key]) => cycles.has(key))
    .map(([key, label]) => ({ label, cycleDays: cycles.get(key) ?? null }))

  const byJob = new Map<string, typeof tasks>()
  for (const t of tasks) {
    if (!t.job_id) continue
    const list = byJob.get(t.job_id) ?? []
    list.push(t)
    byJob.set(t.job_id, list)
  }

  const rows = jobs.map(j => {
    const r = rollUpJob(j, byJob.get(j.id) ?? [])
    // Owners are the DISTINCT people with open work on the job, not "the
    // assignee" — a job runs across five buckets and routinely has three.
    const owners = [...new Set((byJob.get(j.id) ?? [])
      .filter(t => t.assignee_name && t.status !== 'done' && t.status !== 'skipped')
      .map(t => t.assignee_name as string))]
    return { ...r, owners, taskCount: (byJob.get(j.id) ?? []).length }
  })

  return <JobsClient rows={rows} preview={preview} />
}
