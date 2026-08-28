/* Eastern-time wall clock, shared by every scheduled job.
 *
 * Vercel Cron schedules are fixed UTC and do not shift for US daylight saving,
 * so a single entry drifts an hour twice a year. The pattern used throughout
 * this codebase is: register TWO entries an hour apart — one correct for EDT,
 * one for EST — and have the route no-op on whichever is wrong for the season
 * by checking the Eastern clock here. Zero seasonal maintenance.
 *
 * Lives in its own module so the reminder routes can check the clock without
 * importing lib/admin-digest, which pulls in supabase-admin and the whole
 * digest query layer. lib/admin-digest re-exports getNyWallClock so its
 * existing callers are unaffected.
 */

/** Current wall-clock time in America/New_York, plus the NY calendar date
 *  (YYYY-MM-DD). The date MUST be derived from the NY timezone, not
 *  `new Date().toISOString()` (UTC), or a run close to midnight UTC would be
 *  filed under the wrong calendar day. */
export function getNyWallClock(): { hour: number; minute: number; dateISO: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  // Intl can render midnight as "24" with hour12:false in some environments —
  // normalize to 0 so a window check that includes hour 0 is never skipped.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  const dateISO = `${get('year')}-${get('month')}-${get('day')}`

  return { hour, minute, dateISO }
}

/**
 * Which Eastern hours the overnight reminder sweeps may run in.
 *
 * Target is 3am ET year-round. The two registered entries land at 3am and 4am
 * in summer, and 2am and 3am in winter — so this window admits the 3am one in
 * both seasons and rejects the 2am winter run that used to slip through.
 *
 * ⚠️ THE WIDTH IS NOT ARBITRARY. Vercel fires crons on this project **14 to 42
 * minutes late** (measured from Resend send timestamps — see the note above
 * withinDigestWindow in lib/admin-digest.ts, where a ten-minute window meant
 * the digest never sent once in months). Any clock check here must be hours
 * wide, never minutes.
 *
 * Admitting 4am and 5am as well is deliberate and safe: the sweeps stamp each
 * record they touch, so a second pass the same night is a no-op. The window
 * exists to stop the *seasonal* hour drift, not to enforce a single firing.
 */
export function withinReminderWindow(hour: number): boolean {
  return hour >= 3 && hour <= 5
}

/** True if this invocation may run tonight's reminder sweeps. */
export function isReminderTime(): boolean {
  return withinReminderWindow(getNyWallClock().hour)
}
