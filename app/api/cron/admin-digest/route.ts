import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getNyWallClock, isDigestTime, getDigestRecipients, getAdminTicketDigest, getSharedBriefing } from '@/lib/admin-digest'
import { sendAdminDigestEmail } from '@/lib/resend-digest'

/* Daily admin email digest — one email per active admin at ~4:30pm
   America/New_York, containing the shared AI briefing paragraph plus their
   newly-assigned/aging/overdue tickets.

   Vercel Cron is UTC-only and doesn't shift for US daylight saving. The
   ideal setup registers TWO fixed-UTC schedules (20:30 and 21:30 UTC — one
   correct for EDT, the other for EST) and lets this route's NY-wall-clock
   check no-op on whichever one is "wrong" for the season — fully automatic,
   no manual maintenance. vercel.json currently registers only the EDT entry
   (20:30 UTC) to stay within a 2-cron-job account tier limit (alongside
   accrue-pto); this route's isDigestTime() check works identically either
   way. TWO CONSEQUENCES of running single-entry: (1) around the Nov/Mar DST
   changeover, vercel.json's schedule needs a manual one-line flip between
   "30 20 * * *" and "30 21 * * *" to keep firing at 4:30pm local, and (2) if
   the account is ever upgraded to a tier with more cron jobs, just add the
   second entry back to vercel.json for zero-maintenance DST handling.

   Idempotency: the digest_runs table (migration 038) guards against sending
   twice in one NY calendar day — e.g. if both cron entries somehow land in
   the digest-time window, or a retry re-invokes this route. An in-memory
   flag would not survive separate serverless invocations, so we rely on a
   unique index + insert-and-check instead. */

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dateISO } = getNyWallClock()

  if (!isDigestTime()) {
    return NextResponse.json({ skipped: true, reason: 'not digest time (NY)' })
  }

  // Claim today's run. ignoreDuplicates means a second concurrent/duplicate
  // call gets back an empty array instead of a 23505 error — treat that as
  // "already sent today" and no-op.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('digest_runs')
    .upsert({ run_date: dateISO }, { onConflict: 'run_date', ignoreDuplicates: true })
    .select('id')

  if (claimErr) {
    console.error('[cron/admin-digest] failed to claim run:', claimErr)
    return NextResponse.json({ error: String(claimErr) }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'already sent today' })
  }
  const runId = claimed[0].id

  try {
    const { briefing, generatedAt } = await getSharedBriefing()
    const admins = await getDigestRecipients()

    let sent = 0
    for (const admin of admins) {
      if (!admin.email) continue
      try {
        const { assigned, aging, overdue } = await getAdminTicketDigest(admin.id)
        await sendAdminDigestEmail({
          to: admin.email,
          adminName: admin.name || admin.email.split('@')[0],
          briefing,
          assignedTickets: assigned,
          agingTickets: aging,
          overdueTickets: overdue,
        })
        sent++
      } catch (perAdminErr) {
        console.error(`[cron/admin-digest] failed for admin ${admin.email}:`, perAdminErr)
      }
    }

    await supabaseAdmin.from('digest_runs').update({ recipient_count: sent }).eq('id', runId)

    console.log(`[cron/admin-digest] sent ${sent}/${admins.length} digests for ${dateISO}`)
    return NextResponse.json({ sent, briefing_generated_at: generatedAt })
  } catch (err) {
    console.error('[cron/admin-digest] run failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
