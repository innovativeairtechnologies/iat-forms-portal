import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Gate the entire /learn/admin area to admins (profiles.role = 'admin').
// Non-admins are bounced back to the learner experience.
export default async function LearnAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/learn')
  return <>{children}</>
}
