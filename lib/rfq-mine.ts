import { supabaseAdmin } from './supabase-admin'
import { OPEN_STATUSES, type RfqStatus } from './rfq-status'

// "What quote requests are waiting on me?" — the one query behind both dashboard
// surfaces (the department card and the Sales header pill).
//
// `unclaimed` is deliberately part of the same answer. A dashboard that only
// showed your own assignments would go quiet exactly when nobody has picked
// something up, which is the failure this whole feature exists to stop.

export type MyRfq = {
  id: string
  reference: string
  company: string
  project_name: string
  status: RfqStatus
  created_at: string
}

export type MyRfqSummary = {
  mine: MyRfq[]
  /** Assigned to me and still sitting at "new" — the ones being chased. */
  notStarted: number
  /** Nobody owns these yet. Everyone with the perm sees the same number. */
  unclaimed: number
}

const SELECT = 'id, reference, company, project_name, status, created_at'

export async function getMyRfqs(userId: string, limit = 5): Promise<MyRfqSummary> {
  const [mineRes, unclaimedRes] = await Promise.all([
    supabaseAdmin
      .from('rfq_requests')
      .select(SELECT)
      .eq('assignee_id', userId)
      .in('status', OPEN_STATUSES as unknown as string[])
      .order('created_at', { ascending: true }),   // oldest first — that is the one to do
    supabaseAdmin
      .from('rfq_requests')
      .select('*', { count: 'exact', head: true })
      .is('assignee_id', null)
      .eq('status', 'new'),
  ])

  if (mineRes.error) console.error('[rfq-mine] could not load assignments:', mineRes.error)
  if (unclaimedRes.error) console.error('[rfq-mine] could not count unclaimed:', unclaimedRes.error)

  const mine = (mineRes.data ?? []) as MyRfq[]
  return {
    mine: mine.slice(0, limit),
    notStarted: mine.filter(r => r.status === 'new').length,
    unclaimed: unclaimedRes.count ?? 0,
  }
}
