import { NextRequest, NextResponse } from 'next/server'
import { runTicketReminders } from '@/lib/ticket-reminders'
import { runWaitingSweep } from '@/lib/ticket-waiting'
import { isReminderTime, getNyWallClock, isPushWindow, pushWindowReason } from '@/lib/et-clock'

/* Chases support tickets that have gone quiet, and escalates the unassigned ones
 * to leadership along with any unassigned quote requests — see
 * lib/ticket-reminders.ts.
 *
 * Runs at 3am Eastern, the same slot as the quote-request sweep. Registered
 * twice in vercel.json, an hour apart, because Vercel Cron is fixed-UTC and does
 * not shift for daylight saving: one entry is correct for EDT and the other for
 * EST, and isReminderTime() no-ops whichever is wrong for the season. Before that
 * guard existed the sweep silently moved to 2am every winter. The two sweeps are
 * separate entries rather than one combined route because either can fail on its
 * own without taking the other down, and their queries are unrelated.
 *
 * Auth FAILS CLOSED: no CRON_SECRET configured means nobody may call this, the
 * same rule as every other cron here. A route whose only job is to send email
 * must never be reachable by default — the `if (SECRET && ...)` form is
 * fail-OPEN and has already sent real mail from an anonymous GET once.
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
    const result = await runTicketReminders()
    console.log('[cron/ticket-reminders]', JSON.stringify(result))

    // The waiting-on-customer ladder rides the same daily slot — see
    // lib/ticket-waiting.ts. Run SEPARATELY and after, so a failure in either
    // sweep cannot take the other down: the chase above is about tickets nobody
    // has picked up, this one about tickets nobody outside has answered.
    let waiting: unknown = null
    try {
      waiting = await runWaitingSweep()
      console.log('[cron/ticket-reminders] waiting sweep', JSON.stringify(waiting))
    } catch (err) {
      console.error('[cron/ticket-reminders] waiting sweep failed:', err)
      waiting = { error: String(err) }
    }

    return NextResponse.json({ ok: true, ...result, waiting })
  } catch (err) {
    console.error('[cron/ticket-reminders] failed:', err)
    return NextResponse.json({ error: 'Reminder sweep failed' }, { status: 500 })
  }
}
