import { NextRequest, NextResponse } from 'next/server'
import { runRfqReminders } from '@/lib/rfq-reminders'
import { isReminderTime, getNyWallClock, isPushWindow, pushWindowReason } from '@/lib/et-clock'

/* Chases quote requests that have stalled at "new" — see lib/rfq-reminders.ts.
 *
 * Runs at 3am Eastern. Registered twice in vercel.json, an hour apart, because
 * Vercel Cron is fixed-UTC and does not shift for daylight saving: one entry is
 * correct for EDT and the other for EST, and isReminderTime() no-ops whichever
 * is wrong for the season. Before that guard existed the sweep silently moved to
 * 2am every winter. The digest run also calls the same sweep; that is deliberate
 * redundancy, not a leftover. The reminder stamps make any second run of the day
 * a no-op.
 *
 * It was unregistered until 2026-08-17 because the account tier was believed to
 * cap vercel.json at two cron entries. It does not.
 *
 * Auth FAILS CLOSED: no CRON_SECRET configured means nobody may call this, the
 * same rule as /api/cron/admin-digest. The first version of this guard read
 * `if (SECRET && auth !== ...)`, which skipped the check entirely when the
 * variable was unset — an anonymous GET then ran the sweep and sent real mail.
 * A route whose only job is to send email must never be reachable by default.
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
    const result = await runRfqReminders()
    console.log('[cron/rfq-reminders]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/rfq-reminders] failed:', err)
    return NextResponse.json({ error: 'Reminder sweep failed' }, { status: 500 })
  }
}
