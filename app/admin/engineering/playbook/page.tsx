export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getPlaybook } from '@/lib/eng-data'
import PlaybookClient from './PlaybookClient'

/* /admin/engineering/playbook — the scheduling rules.
 *
 * The meeting's own follow-up list: "specific formulas, dependencies, and
 * timelines for each task were not defined. A follow-up session is needed to map
 * these business rules precisely." This page is where that session lands —
 * seeded with everything the workbook and the boards DO say, and with every gap
 * marked rather than filled with a plausible guess.
 *
 * ── Read-only for anyone who is not admin or engineering ──────────────────
 * `engineering_jobs` gets you the page; saving needs the engineering role or a
 * full admin (requireEngineeringAuth({ playbook: true })). Production managers
 * work this board every day and should be able to SEE the standard their work is
 * measured against — but changing it is a department-lead decision. The page
 * renders without the controls rather than offering a Save that 403s.
 */
export default async function EngineeringPlaybookPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const playbook = await getPlaybook()
  const canEdit = actor.role === 'admin' || actor.role === 'engineering'

  return <PlaybookClient initial={playbook} canEdit={canEdit} />
}
