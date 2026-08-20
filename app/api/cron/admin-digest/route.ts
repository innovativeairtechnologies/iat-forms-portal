import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getNyWallClock, isDigestTime, getDigestRecipients, getAdminTicketDigest, getSharedBriefing } from '@/lib/admin-digest'
import { sendAdminDigestEmail } from '@/lib/resend-digest'
import { runRfqReminders } from '@/lib/rfq-reminders'

/* Daily admin email digest — one email per active admin at ~4:30pm
   America/New_York, containing the shared AI briefing paragraph plus their
   newly-assigned/aging/overdue tickets.

   Vercel Cron is UTC-only and doesn't shift for US daylight saving, so
   vercel.json registers TWO fixed-UTC schedules — 20:30 and 21:30 UTC, one
   correct for EDT and the other for EST — and isDigestTime() below no-ops on
   whichever one is "wrong" for the season. Zero seasonal maintenance.

   This registered only the 20:30 entry until 2026-08-17, on the belief that
   the account tier capped vercel.json at two cron jobs. That belief was wrong:
   a third entry deployed fine, and Vercel documents multiple schedules for a
   single path as the supported pattern. What the belief actually cost was a
   manual one-line flip every Nov/Mar changeover — one nobody had yet had to
   make, since no cron had ever run before CRON_SECRET was set.

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

  // ── Quote-request reminders also run here ──
  // The sweep has its own slot now (/api/cron/rfq-reminders at 13:00 UTC). This
  // call is KEPT rather than removed: the reminder stamps from migration 088
  // make a repeat run a no-op, so redundancy costs two queries and buys chasing
  // that survives either entry failing. It began as a workaround for a cron
  // limit that turned out not to exist; it stays because it is free.
  // See lib/rfq-reminders.ts.
  //
  // Placed BEFORE the digest-time and already-ran guards on purpose: those exist
  // to stop the digest going out twice, while the sweep has its own idempotency
  // (the reminder stamps from migration 088). Gating it behind them would mean a
  // day the digest skipped was also a day nobody got chased.
  //
  // Never fails the digest — a reminder that could not send is logged and
  // retried tomorrow, because its rows are only stamped on success.
  try {
    const reminders = await runRfqReminders()
    if (reminders.nudged.length || reminders.unclaimed.length || reminders.skipped) {
      console.log('[cron/admin-digest] rfq reminders:', JSON.stringify(reminders))
    }
  } catch (err) {
    console.error('[cron/admin-digest] rfq reminder sweep failed:', err)
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

  // Hoisted out of the try so the failure path can tell "nothing went out" from
  // "some already did" — the two need opposite handling.
  let sent = 0
  try {
    const { briefing, generatedAt } = await getSharedBriefing()
    const admins = await getDigestRecipients()

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

    // Release today's claim, but ONLY if nothing was mailed.
    //
    // The claim is taken before the first send so two invocations cannot double
    // up — but that also means a failure while fetching the briefing or the
    // recipient list burns the day: the row stays, the second cron entry no-ops
    // against it, and nobody gets a digest until tomorrow. Releasing lets the
    // later entry actually retry, which is the whole reason two are registered.
    //
    // Guarded on sent === 0 because retrying after a partial send would mail
    // those admins twice. Per-admin failures are caught inside the loop, so
    // reaching here with sent > 0 means real mail already went out.
    if (sent === 0) {
      await supabaseAdmin.from('digest_runs').delete().eq('id', runId)
      console.error(`[cron/admin-digest] released the claim for ${dateISO} so a later run can retry`)
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
