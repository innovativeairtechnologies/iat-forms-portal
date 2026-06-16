import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getLeaderboard } from '@/lib/learn'
import LeaderboardClient from './LeaderboardClient'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/learn/leaderboard')

  const rows = await getLeaderboard()
  return <LeaderboardClient rows={rows} currentUserId={user.id} />
}
