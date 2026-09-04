/* ─── Addresses that must never receive mail from the portal ──────────────────
 *
 * jacob.younker@dehumidifiers.com is a DEPARTED EMPLOYEE whose account has to
 * stay active: the portal was built under it and a great deal is set up against
 * that id — the super-admin form approval, historic commit and approval
 * attribution, audit rows. Deactivating the account or dropping the admin role
 * would break those. Lee Childers operates it, and Lee has his own address on
 * every list already, so the account needs to keep working while its MAILBOX
 * goes quiet.
 *
 * ⚠️ SUPPRESSION, NOT REDIRECTION, AND THAT IS DELIBERATE. Rewriting the address
 * to Lee's would make a digest greet "Hi Jacob" over Lee's inbox, and would give
 * Lee two copies of anything sent to both. Every list this filter touches
 * already contains lee.childers@ in its own right, so dropping the row loses
 * nothing and duplicates nothing. If that ever stops being true — a list Lee is
 * not on — add Lee to that list rather than turning this into a redirect.
 *
 * ── Where it is applied ─────────────────────────────────────────────────────
 * At the points that turn an IDENTITY (a role, an owner id) into a delivery
 * address, not at the send sites:
 *
 *   lib/staff.ts            getAdminRecipients()     — every admin fan-out
 *   lib/ticket-recipients.ts ticketAlertRecipients() — owner-derived alerts
 *   lib/ticket-reminders.ts  owner nudge lookup      — a ticket assigned to him
 *   lib/rfq-reminders.ts     assignee nudge lookup
 *   lib/eng-reminders.ts     task owner lookup
 *   lib/pp-reminders.ts      finding owner lookup
 *
 * The four sweeps already have a "no reachable address — log it and leave the
 * row to the oversight escalation" branch, and a suppressed address takes
 * exactly that path. Nothing is silently dropped: the row still surfaces to
 * leadership, which is the same treatment an owner who has left already got.
 *
 * ⚠️ Verified 2026-09-04: the account owns NO tickets, quote requests,
 * engineering tasks or post-production findings, so the sweep guards are
 * defence in depth rather than fixes. The one live leak was portal access
 * requests (app/api/requests/route.ts), which fan out to every admin with no
 * filter at all.
 *
 * Override with SUPPRESSED_EMAILS (comma-separated) to change the list without
 * a deploy. Setting it to an empty string suppresses nobody. */

const DEFAULT_SUPPRESSED = 'jacob.younker@dehumidifiers.com'

function suppressedSet(): Set<string> {
  const raw = process.env.SUPPRESSED_EMAILS ?? DEFAULT_SUPPRESSED
  return new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
}

/** True if this address must not be mailed. Case-insensitive. */
export function isSuppressed(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase()
  return e ? suppressedSet().has(e) : false
}

/**
 * Remove every suppressed address from a recipient list, logging what was
 * dropped. Logged rather than silent so a list that empties out is traceable to
 * this filter and not mistaken for a configuration failure.
 */
export function dropSuppressed(list: string[], context: string): string[] {
  const kept = list.filter(a => !isSuppressed(a))
  if (kept.length !== list.length) {
    const dropped = list.filter(a => isSuppressed(a))
    console.log(`[mail-suppression] ${context}: dropped ${dropped.join(', ')}`)
  }
  return kept
}
