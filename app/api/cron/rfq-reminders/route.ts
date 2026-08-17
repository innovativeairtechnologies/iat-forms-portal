import { NextRequest, NextResponse } from 'next/server'
import { runRfqReminders } from '@/lib/rfq-reminders'

/* Chases quote requests that have stalled at "new" — see lib/rfq-reminders.ts.
 *
 * NOT registered in vercel.json. The account tier caps cron entries at two
 * (accrue-pto + admin-digest, per the note in app/api/cron/admin-digest), so
 * the daily sweep piggybacks on the digest run instead. This route exists to
 * trigger it by hand, and is safe to register on its own schedule the day more
 * slots are available: the reminder stamps make a double-run a no-op.
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

  try {
    const result = await runRfqReminders()
    console.log('[cron/rfq-reminders]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/rfq-reminders] failed:', err)
    return NextResponse.json({ error: 'Reminder sweep failed' }, { status: 500 })
  }
}
