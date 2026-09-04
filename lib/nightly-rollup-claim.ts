import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { logAudit } from './audit'

/* ─── "Has tonight's roll-up already gone out?" ───────────────────────────────
 *
 * ⚠️ WITHOUT THIS, A ROLL-UP SENDS TWICE EVERY NIGHT — not occasionally, not on
 * a boundary, every night. /api/cron/eng-reminders is registered for 3:00am and
 * 4:00am ET and BOTH pass isReminderTime() in summer. The
 * per-row nudges in those sweeps are held down by their own `nudged_at` stamps,
 * so the second pass finds nobody left to nudge. The lead roll-up has no
 * per-row state at all — it is a whole-board summary that sends whenever
 * anything is outstanding — so nothing stopped the second pass repeating it.
 * Confirmed against Resend: "Post-production: what is still open" was delivered
 * at 3:16am and again at 4:31am ET on 2 September, 3 September and 4 September
 * 2026. The engineering roll-up shares the failure and had simply had an empty
 * board on those nights.
 *
 * ── Why audit_log and not a claim table ────────────────────────────────────
 * Same call as lib/ticket-waiting.ts made: it needs no DDL, and "leadership was
 * sent the board summary at T" belongs in the accountability trail on its own
 * merits. A `digest_runs`-style unique index would be stronger, but it buys
 * strictness this does not need — see the fail-open note below.
 *
 * ── The claim is per NIGHT, not per calendar day ───────────────────────────
 * Keyed on nightlySweepAnchor(), so both passes of one night ask about the same
 * instant. A UTC-date key would be nearly right and would break twice a year,
 * because the fixed-UTC cron entries slide an hour against the Eastern clock at
 * each changeover — the anchor is Eastern, so it does not.
 *
 * ── FAIL OPEN, deliberately ────────────────────────────────────────────────
 * An unreadable trail returns "not sent yet" and the roll-up goes out. Sending a
 * board summary twice is a nuisance; a board nobody is told about is the failure
 * the whole sweep exists to prevent, and it must not hinge on a SELECT. Same
 * direction as the "failure never stamps" rule in both callers. logAudit is
 * best-effort by design and swallows its own errors, so a failed write costs one
 * duplicate on that night only — which is exactly today's behaviour, every night.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Audit actions the two board sweeps claim their nightly roll-up under. */
export const ENG_ROLLUP_ACTION = 'eng.rollup_sent'
export const PP_ROLLUP_ACTION = 'pp.rollup_sent'

/**
 * True if a roll-up under `action` has already been recorded at or after
 * `anchor` — i.e. earlier in tonight's sweep. Fails open (returns false).
 */
export async function rollUpSentTonight(action: string, anchor: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id')
    .eq('action', action)
    .gte('created_at', new Date(anchor).toISOString())
    .limit(1)

  if (error) {
    console.error(`[nightly-rollup] could not read the trail for ${action} — sending anyway:`, error.message)
    return false
  }
  return (data ?? []).length > 0
}

/**
 * Record that tonight's roll-up went out. Call ONLY after a send that actually
 * reached somebody — an unsent or wholly-failed roll-up must stay unclaimed so
 * the second pass of the night still tries.
 */
export async function markRollUpSent(action: string, label: string, recipients: string[]): Promise<void> {
  await logAudit({
    actor: { id: null, name: 'Automatic' },
    action,
    entityType: 'rollup',
    entityId: null,
    summary: `${label} roll-up sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`,
    metadata: { recipients },
  })
}
