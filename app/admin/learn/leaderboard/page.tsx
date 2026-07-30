import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getLeaderboard } from '@/lib/learn'
import LeaderboardClient from './LeaderboardClient'
import LearnPageShell from '../LearnPageShell'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/learn/leaderboard')

  const rows = await getLeaderboard()
  return (
    <LearnPageShell>
      <LeaderboardClient rows={rows} currentUserId={user.id} />
    </LearnPageShell>
  )
}
