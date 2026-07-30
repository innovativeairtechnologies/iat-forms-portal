import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/* Learn authoring, inside the admin shell.

   Gated to full admins (profiles.role = 'admin') via the strict getAdminUser().
   Middleware gates this prefix too, on the `learn_admin` perm — that perm is
   NON_DELEGATABLE precisely so the two locks can never disagree (see
   lib/roles.ts). Non-admins are bounced back to the learner experience.

   Deliberately a SIBLING of /admin/learn, not a child: '/admin/learn' is in
   OPEN_ADMIN_PREFIXES, and requiredPermForPath short-circuits on an open prefix
   and returns null, so a gated leaf nested under it would never be enforced.
   Same non-collision idiom as /admin/tools vs /admin/tool-crib.

   This layout also supplies the scroll container both authoring pages need —
   /admin pages own their own scroller. */

export default async function LearnContentLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/admin/learn')
  return <div className="flex-1 overflow-y-auto">{children}</div>
}
