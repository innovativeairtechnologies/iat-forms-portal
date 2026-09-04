import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSuppressed } from './mail-suppression'

/* Who hears about activity on a ticket.

   Every desk alert goes to the shared support mailbox, always. That mailbox is
   the safety net: it is monitored, it survives someone being on vacation, and it
   is the reason an unassigned ticket still gets seen.

   But the shared mailbox alone is how a reply goes unanswered — everyone can see
   it and nobody owns it. So once a ticket HAS an owner, that person gets their
   own copy in their own inbox. Both, not either: the desk keeps the record, the
   owner gets the nudge. */

/** The shared support desk. Comma-separated env var, falling back to the real
    monitored mailbox so a missing variable can never silence alerts entirely. */
export function deskRecipients(): string[] {
  return (process.env.SUPPORT_NOTIFICATION_EMAIL || 'iatsupport@dehumidifiers.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/** Desk + the assigned owner, de-duplicated.

    The owner is looked up rather than trusted from the caller because these
    alerts carry the customer's own words — sending one to the wrong inbox is a
    disclosure, not just noise. Two guards:

      - `is_active` — a deactivated person must stop receiving customer content
        the moment they are deactivated, regardless of tickets they still own.
      - a non-empty email — the employees table is NOT staff-only (every customer
        invite adds a row), so a blank or missing address is treated as "no owner
        to notify" rather than something to guess at.

    Any failure degrades to the desk alone. A lookup problem must never cost the
    desk its alert, because that is the failure this whole path exists to prevent. */
export async function ticketAlertRecipients(ownerId: string | null | undefined): Promise<string[]> {
  const desk = deskRecipients()
  if (!ownerId) return desk

  let ownerEmail: string | null = null
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('email, is_active')
      .eq('id', ownerId)
      .maybeSingle()

    if (error) {
      console.error('[ticket-recipients] owner lookup failed:', error.message)
    } else if (data?.is_active && typeof data.email === 'string' && data.email.trim()) {
      const addr = data.email.trim()
      // A suppressed owner is treated exactly like an inactive one: the desk still
      // gets it, so the ticket is never left with nobody told.
      ownerEmail = isSuppressed(addr) ? null : addr
      if (!ownerEmail) console.log('[ticket-recipients] owner ' + ownerId + ' is suppressed — desk only')
    }
  } catch (err) {
    console.error('[ticket-recipients] owner lookup threw:', err)
  }

  if (!ownerEmail) return desk

  // Case-insensitive: the desk address and an owner's address can differ only by
  // capitalization and would otherwise send the same person two copies.
  const seen = new Set(desk.map(a => a.toLowerCase()))
  return seen.has(ownerEmail.toLowerCase()) ? desk : [...desk, ownerEmail]
}
