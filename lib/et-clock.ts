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

/**
 * Which Eastern hours the Monday PTO accrual may run in.
 *
 * Target is 4am ET year-round. Its two registered entries land at 4am and 5am in
 * summer, and 3am and 4am in winter, so this window admits the 4am one in both
 * seasons. Same three-hour width as the reminders, for the same reason: Vercel
 * fires crons on this project 14 to 42 minutes late.
 *
 * ⚠️ There is deliberately NO weekday check. The cron only fires on Mondays, and a
 * week that gets missed entirely (a deploy landing on the cron minute eats the
 * run) can then be recovered by triggering the route by hand inside this window on
 * any day. That is safe because accrual is now idempotent PER EMPLOYEE PER WEEK -
 * see alreadyAccruedThisWeek() in lib/accrual.ts. A weekday guard would block the
 * catch-up while adding no protection the ledger check does not already give.
 */
export function withinAccrualWindow(hour: number): boolean {
  return hour >= 4 && hour <= 6
}

/** True if this invocation may run the weekly PTO accrual. */
export function isAccrualTime(): boolean {
  return withinAccrualWindow(getNyWallClock().hour)
}

/** The Eastern calendar date (YYYY-MM-DD) an instant falls on. */
export function nyDateOf(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * The Monday (YYYY-MM-DD) that starts the Eastern week containing `dateISO`.
 *
 * Pure calendar arithmetic on a date string — the instant is anchored at noon UTC
 * purely so that adding or subtracting days can never cross a day boundary through
 * a DST transition. No offset maths, so nothing to get wrong twice a year.
 */
export function nyWeekStart(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7   // getUTCDay: 0=Sun … 6=Sat
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d.toISOString().slice(0, 10)
}

/** The Monday that starts the current Eastern week. */
export function currentNyWeekStart(): string {
  return nyWeekStart(getNyWallClock().dateISO)
}
