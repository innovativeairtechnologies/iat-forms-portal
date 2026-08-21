import { NextRequest, NextResponse } from 'next/server'
import { buildLeadershipUpdate } from '@/lib/leadership-update'
import { renderLeadershipDocx } from '@/lib/leadership-docx'
import { sendLeadershipUpdate, leadershipRecipients } from '@/lib/resend-leadership'
import { getNyWallClock } from '@/lib/admin-digest'
import { interimPeriod, parseEdition } from '@/lib/edition'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* Leadership update — MONDAY, WEDNESDAY and FRIDAY at 6pm Eastern.
 *
 * ── Changed 2026-08-21, and what it replaced ────────────────────────────────
 * Was Mondays at 5pm covering the whole edition that closed the day before.
 * Now three times a week at 6pm, each run covering only the days since the
 * previous run (scheduledSpan below). ⚠️ EVERY SCHEDULED SEND IS NOW AN INTERIM;
 * there is no automatic weekly edition. Putting a Monday full-week edition back
 * alongside these would re-send Tuesday-to-Friday content that already went out
 * on Wednesday and Friday, which is the duplication the interim concept exists
 * to avoid. `?edition=8.17.26` still rebuilds any past week by hand.
 *
 * DST is handled by registering 22:00 AND 23:00 UTC and letting the window plus
 * the day-claim sort it out, rather than by one entry being wrong for a season:
 *
 *            22:00 UTC          23:00 UTC
 *   EDT      18:00 ET  SENDS    19:00 ET  in window, day already claimed -> no-op
 *   EST      17:00 ET  skipped  18:00 ET  SENDS
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
 * WHY 5PM AND NOT NOON (changed 2026-08-17): at noon the update went out
 * covering a Monday that had barely happened, and anything shipped that morning
 * missed the report it belonged in. Sending at the end of the day means the week
 * it describes is actually over.
 *
 * DST: Vercel Cron is UTC and does not shift, so vercel.json registers BOTH
 * 21:00 and 22:00 UTC on Mondays and is5pmEastern() below discards whichever one
 * is wrong for the season. Exactly one survives, in both directions:
 *
 *            21:00 UTC        22:00 UTC
 *   EDT      17:00 ET  SEND   18:00 ET  skip
 *   EST      16:00 ET  skip   17:00 ET  SEND
 *
 * The window is the whole 17:00 hour, not a narrow band around the minute,
 * because the two entries sit a full hour apart — so it can absorb a late
 * invocation without ever letting both through.
 *
 * WHAT IT COVERS: the edition that closed yesterday — one Monday-to-Sunday week,
 * named after its Monday in M.D.YY form, e.g. 8.17.26 (lib/edition.ts). Monday's
 * own work belongs to the edition just starting and is reported next week, so
 * nothing is counted twice.
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
 * ⚠️ VERCEL CRONS ON THIS PROJECT RUN 14–42 MINUTES LATE. That send was scheduled
 * 22:00 UTC and delivered 22:42. Others: 13:00 -> 13:41, 21:30 -> 22:03. Any guard
 * that checks the clock must therefore be at least an hour wide, which is exactly
 * why is5pmEastern() below tests the hour and not the minute. A ten-minute window
 * cannot survive this — see isDigestTime() in lib/admin-digest.ts, which has never
 * once let the daily digest through.
 *
 * Monday 24 August still sends edition 8.17.26 in FULL, including 18 and 19 August.
 * That repetition is deliberate. The weekly edition stays the complete record, and
 * the fifteen entries dated 17 August — which this interim deliberately excludes —
 * have never been mailed to anyone; narrowing Monday to avoid the overlap would
 * drop them permanently.
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
 * project 14 to 63 MINUTES LATE (measured). A 6pm entry landing at 19:03 against
 * an `hour === 18` check would silently send nothing — which is exactly how the
 * daily digest managed never to send once from the day it was built.
 *
 * 18..20 absorbs the worst observed delay with an hour to spare. The day-claim
 * below is what keeps a wide window to one send instead of three.
 */
function withinSendWindow(hour: number): boolean {
  return hour >= 18 && hour <= 20
}

const SEND_MARKER = 'leadership_last_sent'

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
async function claimDay(dateISO: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', SEND_MARKER)
    .maybeSingle()

  if (data?.value === dateISO) return false

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
 * Mon/Wed/Fri at 6pm, so working backwards from the weekday:
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
    if (!withinSendWindow(getNyWallClock().hour)) {
      return NextResponse.json({ skipped: true, reason: 'outside the 18:00-20:00 NY window' })
    }
    if (!(await claimDay(nyDate))) {
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
    const sent = await sendLeadershipUpdate(update, docx)

    console.log(`[cron/leadership-update] ${period.label} (${period.range}, ${period.kind}): ${lineCount} summary + ${technicalLines} technical lines from ${update.sourceEntries.length} entries → ${sent.length} recipient(s)`)
    return NextResponse.json({ ok: true, period: period.id, kind: period.kind, lineCount, technicalLines, sent, sourceEntries: update.sourceEntries })
  } catch (err) {
    console.error('[cron/leadership-update] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
