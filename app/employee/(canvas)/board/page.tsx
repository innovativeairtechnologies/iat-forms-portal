import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserLearnStats } from '@/lib/learn'
import type { Employee } from '@/lib/supabase'
import { normalizeState, type BoardState } from './board-config'
import BoardClient, { type BoardCardData } from './BoardClient'

/* Employee "My Board" — the full-screen whiteboard view of the employee portal.
   No shell, no hero: the greeting is written on the board itself in marker. Same
   live data as /employee/profile, re-skinned as sticky notes. Real data only.

   NOTE (future flip): when the whiteboard becomes the employee landing page,
   point the login/role-router redirect at /employee/board — this page is already
   self-sufficient (auth, data, nav via the dock). */

export const dynamic = 'force-dynamic'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function BoardPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: employee }, { data: reqRows }, learn] = await Promise.all([
    supabaseAdmin.from('employees').select('*').eq('id', user.id).single(),
    supabaseAdmin.from('time_off_requests').select('status').eq('employee_id', user.id),
    getUserLearnStats(user.id).catch(() => null),
  ])
  if (!employee) redirect('/login')
  const emp = employee as Employee & { board_layout?: unknown }

  const pendingCount = (reqRows ?? []).filter((r: { status: string }) => r.status === 'pending').length
  const hasLearn = !!learn && learn.totalLessons > 0

  // Only the live, serializable values the cards need — passed to the client board.
  const cards: BoardCardData = {
    timeoff: {
      pto: emp.pto_balance,
      sick: emp.sick_balance,
      pending: pendingCount,
    },
    learning: hasLearn
      ? {
          level: learn!.level.level,
          title: learn!.level.title,
          progressPct: learn!.level.progressPct,
          totalXp: learn!.totalXp,
          lessonsCompleted: learn!.lessonsCompleted,
          totalLessons: learn!.totalLessons,
          streak: learn!.currentStreak,
        }
      : null,
  }

  const initialState: BoardState = normalizeState(emp.board_layout)

  // Greeting + date anchored to Eastern time (matches /employee/profile and /admin).
  const hourET = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10,
  )
  const dateET = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })
  const firstName = emp.name?.trim().split(' ')[0] || ''

  return (
    <BoardClient
      cards={cards}
      initialState={initialState}
      firstName={firstName}
      greetingText={greeting(hourET)}
      dateText={dateET}
    />
  )
}
