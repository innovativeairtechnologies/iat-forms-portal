import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAccrual } from '@/lib/accrual'
import { isAccrualTime, getNyWallClock } from '@/lib/et-clock'

/* Weekly PTO and sick accrual — see lib/accrual.ts.
 *
 * Runs at 4am Eastern on Mondays. Registered TWICE in vercel.json, an hour apart,
 * because Vercel Cron is fixed-UTC and does not shift for daylight saving: one
 * entry is correct for EDT and the other for EST, and isAccrualTime() no-ops
 * whichever is wrong for the season. Before 2026-09-02 it had a single entry and
 * drifted to 3am every winter.
 *
 * ⛔ THE PAIR IS ONLY SAFE BECAUSE THE JOB IS NOW IDEMPOTENT. This route adds hours
 * to real balances and writes real ledger rows; a second run used to do it all
 * again. accrual.ts now skips anyone a scheduled run already credited this Eastern
 * week, reading `accrual_log` rather than trusting a "last run" marker. Do not add
 * a third entry, and do not remove that check.
 *
 * Auth FAILS CLOSED, like every cron here: no CRON_SECRET means nobody may call it.
 */

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Season guard runs AFTER auth: an unauthenticated caller must not be able to
  // tell the difference between "wrong hour" and "wrong secret".
  if (!isAccrualTime()) {
    const { hour } = getNyWallClock()
    return NextResponse.json({ skipped: true, reason: `outside accrual window (${hour}:00 ET)` })
  }

  try {
    const result = await runWeeklyAccrual()
    console.log(`[cron/accrue-pto] week ${result.week_start}: processed ${result.processed}, at-cap ${result.skipped}, already accrued ${result.already_accrued}`)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/accrue-pto] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
