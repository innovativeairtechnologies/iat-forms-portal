import { NextRequest, NextResponse } from 'next/server'
import { runEngineeringReminders } from '@/lib/eng-reminders'
import { runPostProductionReminders } from '@/lib/pp-reminders'
import { isReminderTime, getNyWallClock, isPushWindow, pushWindowReason } from '@/lib/et-clock'

/* The overnight sweep over the engineering board — see lib/eng-reminders.ts.
 *
 * Runs at 3am Eastern, clear of the 9am and 4:30–5:30pm deploy windows.
 *
 * ⚠️ THE REGISTERED PAIR ALONE DOES NOT PIN THE HOUR. This comment used to claim
 * the two entries were "3am EDT / 3am EST". They are not: they land at 3am and
 * 4am in summer, and 2am and 3am in winter. Both fire, and whichever runs FIRST
 * does the work — so every winter the sweep quietly moved to 2am. The pair gives
 * a candidate in each season; isReminderTime() is what actually selects 3am and
 * rejects the 2am winter run. The nudged_at stamps still make any later run of
 * the same night a no-op.
 *
 * ⚠️ AUTH FAILS CLOSED. No CRON_SECRET configured means nobody may call this.
 * The first version of this guard elsewhere in the app read
 * `if (SECRET && auth !== ...)`, which skipped the check entirely when the
 * variable was unset — an anonymous GET then ran the sweep and sent real mail.
 * A route whose only job is to send email must never be reachable by default.
 *
 * ⚠️ A deploy that lands ON a cron minute eats that run. Ten deploys across one
 * Friday evening killed four runs; a weekend with no deploys ran all three jobs
 * both days. If a morning sweep is missing, check the deploy timeline before
 * anything else, and trigger it by hand with `vercel crons run <path>`.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ⛔ Nothing scheduled may do work between 8:00am and 5:30pm Eastern — that is
  // the window production pushes go out in, and a deploy landing on a running
  // job loses the run. Placed immediately after auth and before ANY work, so it
  // holds no matter what a future vercel.json entry says. See lib/et-clock.ts.
  if (isPushWindow()) {
    return NextResponse.json({ skipped: true, reason: pushWindowReason() })
  }

  // Season guard runs AFTER auth: an unauthenticated caller must not be able to
  // tell the difference between "wrong hour" and "wrong secret".
  if (!isReminderTime()) {
    const { hour } = getNyWallClock()
    return NextResponse.json({ skipped: true, reason: `outside reminder window (${hour}:00 ET)` })
  }

  try {
    const result = await runEngineeringReminders()
    console.log('[cron/eng-reminders]', JSON.stringify(result))

    /* Post-production rides this entry rather than registering its own (098).
       A deploy landing on a cron minute EATS that run — ten deploys across one
       Friday evening killed four — so every extra entry is another minute a
       routine push can silently swallow. Both sweeps want the same 3am Eastern
       window, and the sweeps are independent: run separately and caught
       separately, so a failure in one still lets the other send. */
    let pp = null
    try {
      pp = await runPostProductionReminders()
      console.log('[cron/eng-reminders] post-production', JSON.stringify(pp))
    } catch (err) {
      console.error('[cron/eng-reminders] post-production sweep failed:', err)
    }

    return NextResponse.json({ ok: true, ...result, postProduction: pp })
  } catch (err) {
    console.error('[cron/eng-reminders] failed:', err)
    return NextResponse.json({ error: 'Engineering reminder sweep failed' }, { status: 500 })
  }
}
