import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { getAdminTicketDigest, getSharedBriefing } from '@/lib/admin-digest'
import { sendAdminDigestEmail } from '@/lib/resend-digest'

/* On-demand test-send of the admin digest email — lets a logged-in admin
   validate the content (briefing + ticket lists) without waiting for the
   scheduled ~4:30pm America/New_York cron run.

   Gated by normal admin session auth (getAdminUser), NOT the cron Bearer
   secret — a leaked CRON_SECRET must never be usable to spam every admin.
   This route intentionally bypasses both the NY-wall-clock check and the
   digest_runs idempotency guard, and never writes to digest_runs, so it
   can't interfere with (or fake) the real daily send. */

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let to = admin.user.email || ''
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.to === 'string' && body.to.trim()) {
      to = body.to.trim()
    }
  } catch {
    // no body / invalid JSON — fall back to the admin's own email
  }

  if (!to) {
    return NextResponse.json({ error: 'No recipient email available' }, { status: 400 })
  }

  try {
    const { briefing } = await getSharedBriefing()
    // Test-send always uses the calling admin's own ticket ownership, even if
    // sending to a different "to" address for review purposes.
    const { assigned, aging, overdue } = await getAdminTicketDigest(admin.user.id)

    await sendAdminDigestEmail({
      to,
      adminName: admin.displayName,
      briefing,
      assignedTickets: assigned,
      agingTickets: aging,
      overdueTickets: overdue,
    })

    return NextResponse.json({ ok: true, sent_to: to })
  } catch (err) {
    console.error('[admin/digest/test-send] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
