import { NextRequest, NextResponse } from 'next/server'
import { buildLeadershipUpdate } from '@/lib/leadership-update'
import { renderLeadershipDocx } from '@/lib/leadership-docx'
import { sendLeadershipUpdate, leadershipRecipients } from '@/lib/resend-leadership'
import { getNyWallClock } from '@/lib/admin-digest'

/* Weekly leadership update — Mondays at 5pm Eastern.
 *
 * Reads the last seven days of CHANGELOG.md, has Claude rewrite it into a
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
 * `?dry=1` builds everything and returns the summary WITHOUT sending, which is
 * how to check the wording before a Monday. `?force=1` sends outside the
 * window. Neither is subject to the hour check; both still require the secret.
 */

export const maxDuration = 60   // the model call plus docx render exceeds the default

/** True anywhere inside the 5pm hour, America/New_York. */
function is5pmEastern(): boolean {
  return getNyWallClock().hour === 17
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  const force = req.nextUrl.searchParams.get('force') === '1'

  // One of the two Monday entries is an hour off for the season — drop it here.
  // A dry run and an explicit force both bypass this, so the preview command in
  // docs/ still works on a Wednesday afternoon.
  if (!dryRun && !force && !is5pmEastern()) {
    return NextResponse.json({ skipped: true, reason: 'not 5pm (NY)' })
  }

  try {
    const update = await buildLeadershipUpdate()
    const lineCount = update.sections.reduce((n, s) => n + s.items.length, 0)

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, lineCount,
        recipients: leadershipRecipients(),
        sourceEntries: update.sourceEntries,
        update,
      })
    }

    // A quiet week still sends — silence is indistinguishable from a broken job,
    // and this whole portal has now been bitten twice by exactly that.
    const docx = await renderLeadershipDocx(update)
    const sent = await sendLeadershipUpdate(update, docx)

    console.log(`[cron/leadership-update] ${lineCount} lines from ${update.sourceEntries.length} entries → ${sent.length} recipient(s)`)
    return NextResponse.json({ ok: true, lineCount, sent, sourceEntries: update.sourceEntries })
  } catch (err) {
    console.error('[cron/leadership-update] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
