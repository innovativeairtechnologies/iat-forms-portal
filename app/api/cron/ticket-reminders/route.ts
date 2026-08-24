import { NextRequest, NextResponse } from 'next/server'
import { runTicketReminders } from '@/lib/ticket-reminders'
import { runWaitingSweep } from '@/lib/ticket-waiting'

/* Chases support tickets that have gone quiet, and escalates the unassigned ones
 * to leadership along with any unassigned quote requests — see
 * lib/ticket-reminders.ts.
 *
 * Registered in vercel.json at 13:00 UTC, the same slot as the quote-request
 * sweep: start of business either side of the DST line (9am EDT / 8am EST), so a
 * stalled ticket is chased at the top of the day rather than at the end of it.
 * The two are separate entries rather than one combined route because either can
 * fail on its own without taking the other down, and their queries are unrelated.
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
