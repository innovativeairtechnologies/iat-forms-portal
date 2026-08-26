import { NextRequest, NextResponse } from 'next/server'
import { buildLeadershipUpdate } from '@/lib/leadership-update'
import { renderLeadershipDocx } from '@/lib/leadership-docx'
import { sendLeadershipUpdate, leadershipRecipients } from '@/lib/resend-leadership'
import { getNyWallClock } from '@/lib/admin-digest'
import { interimPeriod, parseEdition } from '@/lib/edition'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* Leadership update — MONDAY, WEDNESDAY and FRIDAY at 8:30pm Eastern.
 *
 * ── Changed 2026-08-21, and what it replaced ────────────────────────────────
 * Was Mondays at 5pm covering the whole edition that closed the day before.
 * Now three times a week at 8:30pm, each run covering only the days since the
 * previous run (scheduledSpan below). ⚠️ EVERY SCHEDULED SEND IS NOW AN INTERIM;
 * there is no automatic weekly edition. Putting a Monday full-week edition back
 * alongside these would re-send Tuesday-to-Friday content that already went out
 * on Wednesday and Friday, which is the duplication the interim concept exists
 * to avoid. `?edition=8.17.26` still rebuilds any past week by hand.
 *
 * MOVED to 6:30pm then 8:30pm on 2026-08-25. The owner deploys to production most
 * days between 4:30 and 5:30pm ET; a deploy re-registers the project's crons and
 * any run that has not yet fired is at risk, so both scheduled mails were sitting
 * in the daily deploy window. The digest moved to 6:00pm and this to 8:30pm, which
 * also puts both in the inbox for a next-morning read.
 *
 * 🔴 WHY :30 AND NOT 8:00pm, WHICH IS WHAT WAS ASKED FOR. The digest's third entry
 * is 00:00 UTC, which in EDT is 8:00pm ET — the same instant. That is not harmless:
 * app/api/cron/admin-digest runs the RFQ reminder SWEEP before its window and claim
 * guards, so even an invocation that skips the digest still sends mail. Two mailing
 * jobs on the same UTC minute is the collision the owner asked to remove. 30 minutes
 * of separation costs nothing and is the whole reason for the offset — do not
 * 'tidy' it back to the hour.
 *
 * ⚠️ THE CRON DAYS ARE 2,4,6 — NOT 1,3,5 — AND THAT IS CORRECT. 8:30pm ET is past
 * midnight UTC, so a Monday-evening send is TUESDAY in UTC. Cron expressions are
 * UTC, the route's period logic reads getNyWallClock(), and scheduledSpan() derives
 * the weekday from that NY date — so the run still resolves to Monday and covers
 * the right span. Change the hour here and the day-of-week may have to move with it.
 *
 * THREE entries, because two left EST with no backstop at all:
 *
 *            00:30 UTC          01:30 UTC          02:30 UTC
 *   EDT      20:30 ET  SENDS    21:30 ET backstop  22:30 ET backstop
 *   EST      19:30 ET  skipped  20:30 ET  SENDS    21:30 ET backstop
 *
 * Dropping hour 19 is what makes the right entry claim in each season. Before this
 * the winter schedule had ONE eligible entry, so a single lost invocation between
 * November and March meant no report at all — and the claim release below had
 * nothing to release to.
 *
 * Exactly one send in both directions. The old build relied on only one entry
 * ever landing inside a one-hour check; that cannot survive a wide window, and a
 * wide window is required because the crons run up to 63 minutes late.
 *
 *
 * Reads one edition of CHANGELOG.md, has Claude rewrite it into a
 * non-technical leadership read AND a longer technical read, renders a Word
 * document and emails it to LEADERSHIP_UPDATE_EMAIL.
 *
 * Auth FAILS CLOSED, like every other cron route: no CRON_SECRET means nobody
 * may call this. Do not relax to `if (SECRET && ...)` — that form skips the
 * check entirely when the variable is unset, and this route sends mail.
 *
 * WHY 6PM: at noon the update covered a day that had barely happened, and
 * anything shipped that morning missed the report it belonged in. Late in the
 * day means the period it describes is actually over.
 *
 * ⚠️ VERCEL CRONS ON THIS PROJECT RUN 14-63 MINUTES LATE (measured: 22:00 -> 22:42,
 * 13:00 -> 13:41, 21:30 -> 22:03, and the digest at 20:30 -> 21:33). Any guard that
 * checks the clock must be at least an hour wide — see withinSendWindow().
 *
 * ── Parameters ──────────────────────────────────────────────────────────────
 * `?dry=1` builds everything and returns the summary WITHOUT sending, which is
 * how to check the wording before a Monday. `?force=1` sends outside the
 * window. `?edition=8.17.26` rebuilds a specific past week — 2026-08-17 is also
 * accepted, and any date inside the week resolves to that week's Monday.
 *
 * `?from=2026-08-18&to=2026-08-19` sends an INTERIM update over an inclusive run
 * of days instead of a week. It is titled, subject-lined and filed as an interim,
 * never as an edition, and it neither consumes nor suppresses the edition it sits
 * inside — see interimPeriod() in lib/edition.ts for why that separation is the
 * entire point. `from`/`to` and `edition` are mutually exclusive.
 *
 * None of these bypass the secret; only `dry` and `force` bypass the hour check.
 *
 * ── The 2026-08-19 one-off (SENT, entry since removed) ──────────────────────
 * A one-off ran as `?force=1&from=2026-08-18&to=2026-08-19` on `0 22 19 8 *`, and
 * its vercel.json entry was deleted afterwards. Kept here as the worked example,
 * because cron has no notion of a one-off and pinning day-of-month + month is the
 * trick — and because of what it measured:
 *
 * ⚠️ It measured the delay: scheduled 22:00 UTC, delivered 22:42. See
 * withinSendWindow() for why that dictates the width of the guard.
 *
 * It goes through Vercel Cron rather than a hand-rolled call precisely so nobody
 * has to handle CRON_SECRET: Vercel supplies the Authorization header itself. The
 * secret cannot be read back locally anyway — the platform returns env values
 * still envelope-encrypted, which is why `vercel env pull` writes them out empty.
 *
 * ⚠️ IT READS CHANGELOG.md FROM THE DEPLOYED BUNDLE (process.cwd()), not from git.
 * Anything written to the changelog after the last deploy is invisible to it, so a
 * change must be COMMITTED AND DEPLOYED before the cron fires to appear in the
 * email.
 */

export const maxDuration = 60   // the model call plus docx render exceeds the default

/**
 * The send window, America/New_York.
 *
 * ⚠️ WIDE ON PURPOSE, and the width is the point. Vercel fires crons on this
 * project up to about an hour late — the often-quoted "14 to 63 minutes" is not
 * supported at either end, see docs/notifications.md. An 8:30pm entry landing at 21:33 against
 * an `hour === 18` check would silently send nothing — which is exactly how the
 * daily digest managed never to send once from the day it was built.
 *
 * 20..22 absorbs the worst observed delay with an hour to spare. The day-claim
 * below is what keeps a wide window to one send instead of three.
 */
function withinSendWindow(hour: number): boolean {
  return hour >= 20 && hour <= 22
}

const SEND_MARKER = 'leadership_last_sent'
/** What claimDay() overwrote, so releaseDay() can restore it on a failed run. */
let claimedOver: string | null = null
const TRACE_MARKER = 'leadership_last_invocation'

/**
 * A breadcrumb written on EVERY authenticated invocation, before any early
 * return, recording what happened and why.
 *
 * 🔴 THIS EXISTS BECAUSE OF 2026-08-21. The 18:00 send did not arrive, and there
 * was NO WAY TO TELL WHY: the send marker is only written once a run gets past
 * the window check, so its absence is equally consistent with "the cron never
 * fired", "the secret was rejected", and "the period failed to build". Vercel's
 * runtime logs are empty on this project — twelve hours of them, with functions
 * demonstrably running — so they answer nothing either.
 *
 * That is the same shape as the daily digest, which quietly did nothing for
 * months. A scheduled job that leaves no trace when it declines to act is
 * indistinguishable from one that was never called, and the whole point of the
 * digest post-mortem was to stop shipping those.
 *
 * Best-effort and never allowed to block a send.
 */
async function trace(outcome: string, detail?: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('app_settings').upsert({
      key: TRACE_MARKER,
      value: JSON.stringify({ at: new Date().toISOString(), outcome, ...detail }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  } catch (err) {
    console.error('[leadership-update] trace write failed:', err)
  }
}

/**
 * Claim the day, so a wide window cannot mail several copies.
 *
 * Same shape as digest_runs, borrowed rather than rebuilt: the FIRST invocation
 * of the NY day writes the marker and every later one no-ops. It lives in
 * app_settings because that table already exists and this needed no migration —
 * the Supabase CLI was unauthorized on 2026-08-21 and DDL cannot go through
 * PostgREST.
 *
 * ⚠️ Read-then-write, not an atomic upsert against a UNIQUE index, so two
 * invocations landing in the same instant could both claim. The cron entries sit
 * an hour apart, so that race needs a 60-minute delay hitting the exact second of
 * another run. Accepted knowingly; a real `leadership_runs` table with a unique
 * index on the date is the correct fix once migrations are available.
 */
/**
 * Release a claim taken for a run that then sent NOTHING.
 *
 * 🔴 WITHOUT THIS A FAILED RUN BURNS THE DAY *AND* DISARMS THE BACKSTOP. The claim
 * is taken before the send; if the build, the docx render or every send then
 * fails, the marker still reads "today", the paired second entry an hour later
 * sees it and returns 'skipped-already-sent', and nobody is told. That is exactly
 * the 2026-08-24 shape: claimed 18:17 ET, second entry stood down at 19:13, and no
 * evidence either way survived.
 *
 * The admin digest has released its claim on a zero send since it was built; this
 * route did not. Restores the PREVIOUS value rather than deleting, so the marker
 * keeps meaning "the last date we actually sent".
 */
async function releaseDay(previous: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: SEND_MARKER, value: previous ?? '', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('[leadership-update] failed to release the day claim:', error.message)
}

async function claimDay(dateISO: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', SEND_MARKER)
    .maybeSingle()

  if (data?.value === dateISO) return false
  claimedOver = data?.value ?? null

  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: SEND_MARKER, value: dateISO, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    // Never block the send on bookkeeping. A missing marker risks a second copy;
    // a blocked send risks silence, and silence is the failure this job has
    // already suffered twice.
    console.error('[leadership-update] day claim failed, sending anyway:', error.message)
  }
  return true
}

/**
 * What a scheduled run covers: EVERY DAY SINCE THE PREVIOUS SCHEDULED RUN,
 * today included.
 *
 * Mon/Wed/Fri at 8:30pm, so working backwards from the weekday:
 *   Monday    -> Saturday, Sunday, Monday   (Friday's run ended at Friday)
 *   Wednesday -> Tuesday, Wednesday         (Monday's run ended at Monday)
 *   Friday    -> Thursday, Friday           (Wednesday's run ended at Wednesday)
 *
 * Complete coverage, no gaps, nothing said twice — the rule the 08-21 handoff
 * settled on when a one-off interim overlapped an edition.
 *
 * ⚠️ THIS REPLACES THE WEEKLY EDITION. Every scheduled send is now an interim.
 * Adding a Monday full-week edition back alongside these would re-send Tuesday
 * through Friday content that already went out on Wednesday and Friday.
 * `?edition=8.17.26` still rebuilds any past week by hand.
 */
function scheduledSpan(dateISO: string): { from: string; to: string } {
  const day = new Date(dateISO + 'T12:00:00Z').getUTCDay()   // 0 Sun .. 6 Sat
  const back = day === 1 ? 2 : 1                             // Monday reaches back over the weekend
  const first = new Date(dateISO + 'T12:00:00Z')
  first.setUTCDate(first.getUTCDate() - back)
  return { from: first.toISOString().slice(0, 10), to: dateISO }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clock = getNyWallClock()
  await trace('invoked', { nyHour: clock.hour, nyDate: clock.dateISO })

  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  const force = req.nextUrl.searchParams.get('force') === '1'

  // Any date inside the wanted week resolves to that week's Monday, so a caller
  // never has to work out which day the edition is named after.
  const editionParam = req.nextUrl.searchParams.get('edition')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  // Refused rather than reconciled. An edition and a date range disagree about
  // what the report IS, and quietly preferring one would send a document nobody
  // asked for under a name that looks right.
  if (editionParam && (from || to)) {
    return NextResponse.json({ error: 'Pass edition, or from+to — not both' }, { status: 400 })
  }
  if (Boolean(from) !== Boolean(to)) {
    return NextResponse.json({ error: 'from and to must be given together' }, { status: 400 })
  }

  // A scheduled run with no parameters covers the span since the previous
  // scheduled run — see scheduledSpan(). previousEdition() is no longer the
  // default: the job runs three times a week now, and a full week every Monday
  // on top of Wednesday and Friday interims would repeat most of itself.
  const scheduled = scheduledSpan(getNyWallClock().dateISO)
  const period = from && to
    ? interimPeriod(from, to)
    : editionParam
      ? parseEdition(editionParam)
      : interimPeriod(scheduled.from, scheduled.to)
  if (!period) {
    await trace('bad-period', { from: scheduled.from, to: scheduled.to })
    return NextResponse.json(
      { error: 'Bad edition or range — use 8.17.26 or 2026-08-17, and from must not be after to' },
      { status: 400 },
    )
  }

  // One of the two entries is an hour off for the season, and either can arrive
  // late — hence a window rather than an hour, and a day-claim rather than luck.
  // A dry run and an explicit force both bypass BOTH, so the preview command in
  // docs/ still works on a Wednesday afternoon and a missed day can be re-run.
  const nyDate = getNyWallClock().dateISO
  if (!dryRun && !force) {
    if (!withinSendWindow(clock.hour)) {
      await trace('skipped-window', { nyHour: clock.hour })
      return NextResponse.json({ skipped: true, reason: 'outside the 20:00-22:00 NY window' })
    }
    if (!(await claimDay(nyDate))) {
      await trace('skipped-already-sent', { nyDate })
      return NextResponse.json({ skipped: true, reason: `already sent on ${nyDate}` })
    }
  }

  try {
    const update = await buildLeadershipUpdate(period)
    const lineCount = update.sections.reduce((n, s) => n + s.items.length, 0)
    const technicalLines = update.technical.reduce((n, s) => n + s.items.length, 0)

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, period: period.id, kind: period.kind, lineCount, technicalLines,
        recipients: leadershipRecipients(),
        sourceEntries: update.sourceEntries,
        update,
      })
    }

    // A quiet week still sends — silence is indistinguishable from a broken job,
    // and this whole portal has now been bitten twice by exactly that.
    const docx = await renderLeadershipDocx(update)
    const { sent, failed } = await sendLeadershipUpdate(update, docx)

    // ⚠️ TRACE THE SEND PATH TOO. Every other outcome here was already stamped —
    // invoked, bad-period, skipped-window, skipped-already-sent — but the path that
    // actually sends was not, so "sent to 3", "sent to 0" and "threw after claiming"
    // were indistinguishable afterwards. Failures are recorded even on a PARTIAL
    // success: that is the case that hides, because the run still looks fine.
    await trace(failed.length ? 'sent-partial' : 'sent', {
      nyDate, period: period.id, recipients: sent.length, failed,
    })
    console.log(`[cron/leadership-update] ${period.label} (${period.range}, ${period.kind}): ${lineCount} summary + ${technicalLines} technical lines from ${update.sourceEntries.length} entries → ${sent.length} recipient(s), ${failed.length} failed`)
    return NextResponse.json({ ok: true, period: period.id, kind: period.kind, lineCount, technicalLines, sent, failed, sourceEntries: update.sourceEntries })
  } catch (err) {
    // Nothing went out — sendLeadershipUpdate only throws when EVERY send failed,
    // and a throw from the build or the render means we never reached the send.
    // Give the day back so the paired entry an hour later can genuinely retry.
    if (!dryRun && !force) await releaseDay(claimedOver)
    await trace('failed', { nyDate, period: period.id, error: String(err), claimReleased: !dryRun && !force })
    console.error('[cron/leadership-update] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
