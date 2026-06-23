import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import LearnShell from '@/components/learn/LearnShell'
import { getLearnHeaderStats } from '@/lib/learn'

export const dynamic = 'force-dynamic'

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  // Shared auth: a user arriving from the employee portal already has a Supabase
  // session, so this is a no-friction pass-through. No second login.
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/learn')

  const [{ data: profile }, stats] = await Promise.all([
    supabaseAdmin.from('profiles').select('role, display_name').eq('id', user.id).single(),
    getLearnHeaderStats(user.id),
  ])

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Team Member'
  const portalHref = isAdmin ? '/admin' : '/employee/profile'

  return (
    <LearnShell displayName={displayName} isAdmin={isAdmin} portalHref={portalHref} stats={stats}>
      {children}
    </LearnShell>
  )
}
