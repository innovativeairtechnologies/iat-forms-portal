import { NextRequest, NextResponse } from 'next/server'
import { runEngineeringReminders } from '@/lib/eng-reminders'
import { runPostProductionReminders } from '@/lib/pp-reminders'

/* The morning sweep over the engineering board — see lib/eng-reminders.ts.
 *
 * Registered in vercel.json at 07:00 AND 08:00 UTC. That pair is 3am Eastern on
 * both sides of the DST line (3am EDT / 3am EST), so the sweep lands well before
 * the working day and clear of the 9am and 4:30–5:30pm deploy windows. Cron
 * entries are fixed UTC, so their Eastern meaning shifts twice a year — the pair
 * is what makes that not matter. The second run of the day is a no-op: the
 * nudged_at stamps make it one.
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
