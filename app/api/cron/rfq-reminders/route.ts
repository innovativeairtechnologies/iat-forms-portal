import { NextRequest, NextResponse } from 'next/server'
import { runRfqReminders } from '@/lib/rfq-reminders'

/* Chases quote requests that have stalled at "new" — see lib/rfq-reminders.ts.
 *
 * Registered in vercel.json at 13:00 UTC — start of business either side of the
 * DST line (9am EDT / 8am EST), so a stalled quote is chased at the top of the
 * day rather than at the end of it. The digest run also calls the same sweep;
 * that is deliberate redundancy, not a leftover. The reminder stamps make the
 * second run of the day a no-op.
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

  try {
    const result = await runRfqReminders()
    console.log('[cron/rfq-reminders]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/rfq-reminders] failed:', err)
    return NextResponse.json({ error: 'Reminder sweep failed' }, { status: 500 })
  }
}
