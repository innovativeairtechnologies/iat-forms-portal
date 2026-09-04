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

/** Wall-clock time in America/New_York, plus the Eastern calendar date
 *  (YYYY-MM-DD). The date MUST be derived from the Eastern timezone, not
 *  `toISOString()`, or a run in the evening would be filed under tomorrow.
 *
 *  Takes an instant so a caller with an injected clock (the board sweeps pass
 *  their own `now`) reads the same Eastern time the rest of its run does. */
export function getNyWallClock(at: Date = new Date()): { hour: number; minute: number; dateISO: string } {
  const now = at
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

/* ⛔ THE PRODUCTION PUSH WINDOW — 8:00am to 5:30pm Eastern.
 *
 * NOTHING SCHEDULED MAY DO WORK IN THIS WINDOW. Production pushes go out through
 * it, a deploy re-registers the project's crons, and a run that has not fired yet
 * when the new deployment goes live is lost — ten deploys across one Friday
 * evening killed four runs. The owner has stated this rule twice; it is enforced
 * here rather than left to whoever writes the next vercel.json entry.
 *
 * ⚠️ IT IS A GUARD, NOT A SCHEDULE. Every job is already scheduled well clear of
 * this window. What the guard buys is the case nobody checks: Vercel Cron is
 * fixed-UTC, so an entry that clears the window in summer can slide an hour into
 * it in winter. That is not hypothetical — /api/cron/admin-digest's earliest
 * entry is 6:00pm ET in summer and 5:00pm in winter, and it ran the quote sweep
 * there every winter day until 2026-09-04.
 *
 * The boundary is inclusive at 8:00am: commits start going live AT eight, so a
 * job must be finished by then, not starting.
 */
export const PUSH_WINDOW_START_MIN = 8 * 60        // 8:00am ET
export const PUSH_WINDOW_END_MIN = 17 * 60 + 30    // 5:30pm ET

export function withinPushWindow(hour: number, minute: number): boolean {
  const m = hour * 60 + minute
  return m >= PUSH_WINDOW_START_MIN && m <= PUSH_WINDOW_END_MIN
}

/** True if right now is inside the window where nothing scheduled may run. */
export function isPushWindow(): boolean {
  const { hour, minute } = getNyWallClock()
  return withinPushWindow(hour, minute)
}

/** The reason string a cron route returns when the guard stops it. */
export function pushWindowReason(): string {
  const { hour, minute } = getNyWallClock()
  const h12 = ((hour + 11) % 12) + 1
  const ampm = hour < 12 ? 'am' : 'pm'
  return `inside the 8:00am-5:30pm ET production push window (${h12}:${String(minute).padStart(2, '0')}${ampm} ET)`
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
 *
 * ⚠️ "A second pass is a no-op" is only true for a sweep whose cutoffs come from
 * nightlySweepAnchor() below. A sweep measuring from `Date.now()` asks a slightly
 * different question on each pass and mails twice — see that function.
 */
export function withinReminderWindow(hour: number): boolean {
  return hour >= 3 && hour <= 5
}

/** True if this invocation may run tonight's reminder sweeps. */
export function isReminderTime(): boolean {
  return withinReminderWindow(getNyWallClock().hour)
}

/**
 * The instant a nightly sweep should measure its cutoffs FROM, instead of
 * `Date.now()`. It is **midnight Eastern of the current Eastern day**, so every
 * invocation belonging to one Eastern day computes the identical value.
 *
 * ⚠️ THIS EXISTS BECAUSE `Date.now()` SPLIT THE ESCALATION INTO TWO EMAILS.
 * Both registered entries pass withinReminderWindow() in summer (3am and 4am ET)
 * and Vercel fires them late by a different amount each — 3:51am and 4:31am ET in
 * practice, forty minutes apart. Every cutoff derived from `Date.now()` therefore
 * moved forty minutes between the two passes, and a row whose last stamp sat
 * inside that gap was invisible to the first pass and eligible on the second. It
 * then got its own email. Observed on 2026-09-04: IAT-2706-9005 escalated at
 * 3:51:19am ET, IAT-2026-2942 at 4:31:30am ET, second by 0.7 seconds of drift on
 * a 48-hour window — three admins each received two "Needs attention: 1 stalled"
 * emails instead of one listing both.
 *
 * Anchoring removes the drift: both passes ask the same question, the first one
 * to run answers it and stamps the rows, and the second finds nothing left —
 * which is what the comment above withinReminderWindow always claimed happened.
 *
 * ── Why midnight Eastern, and not a fixed UTC hour ─────────────────────────
 * This was 07:00 UTC for half a day on 2026-09-04 and that was wrong twice over:
 *
 *   • 07:00 UTC IS 3:00am ET in summer and 2:00am ET in winter, so the anchor
 *     the docs called "3am" quietly moved an hour every November. Midnight
 *     Eastern means midnight Eastern in both seasons — no offset arithmetic
 *     anywhere in this file's callers, and nothing to re-derive twice a year.
 *
 *   • It had ZERO MARGIN. The earlier cron entry is registered for exactly that
 *     minute, so a fire even a second early would put the anchor in the future,
 *     the guard would step back a whole day, every cutoff would move 24 hours,
 *     and the sweep would re-send everything it sent last night. Vercel has only
 *     ever fired these LATE (14-42 min), but "has only ever" is exactly the
 *     reasoning that produced the 0.7-second bug above. Midnight ET sits a clear
 *     three hours before the earliest possible run.
 *
 * The Eastern day is also the honest unit for the quote sweep, which is invoked
 * five times a day: twice in the 3am window and three more times by the daily
 * digest at 6pm, 7pm and 8pm ET. All five fall on one Eastern day, so all five
 * share one anchor — and the special case for the last of them disappears, since
 * 8pm Monday is obviously the same Eastern day as 3am Monday. Under the old UTC
 * floor that call had already rolled onto the next UTC day and anchored SEVEN
 * HOURS INTO THE FUTURE.
 *
 * A cutoff of `anchor - 24h` therefore guarantees anything chased has been quiet
 * for more than 24 hours — 27 normally, since the earliest run is 3am, and 26 on
 * the fall-back changeover day — never less.
 *
 * ⚠️ A repeat window measured from here must NOT be a whole multiple of 24h. The
 * stamps it is compared against are real send times, which land AFTER the anchor,
 * so `anchor - 48h` excludes everything stamped two nights ago and silently turns
 * an every-other-night cadence into every third night. Callers use 36h for
 * every-other-night and 12h for daily.
 */
export function nightlySweepAnchor(now: Date | number = Date.now()): number {
  const at = typeof now === 'number' ? new Date(now) : now
  const { hour, minute } = getNyWallClock(at)
  // Eastern minutes tick with UTC minutes — every US offset is a whole number of
  // hours — so subtracting the Eastern hour and minute, plus the milliseconds
  // elapsed inside the current minute, lands on midnight Eastern. No offset
  // table, nothing to maintain twice a year.
  //
  // ⚠️ On the two changeover days this is off by an hour, because it subtracts
  // WALL-CLOCK hours from an ELAPSED-time instant and those days are 23 and 25
  // hours long: spring-forward anchors to 11pm the night before, fall-back to
  // 1am. Both are harmless and were checked rather than assumed. What matters is
  // that every invocation of the night still computes the SAME value — verified
  // for both passes on 2026-03-08 and 2026-11-01 — so nothing can split. The
  // repeat windows carry 8-15 hours of margin, and the quiet cutoff moves to a
  // worst case of 26 hours, still comfortably over its 24-hour promise. Fixing
  // the hour would mean real timezone arithmetic for no behavioural gain.
  const t = at.getTime()
  return t - (hour * 60 + minute) * 60_000 - (t % 60_000)
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
