import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  SUPPORT_REFERENCE_KEYS,
  isAllowedReferenceUrl,
  slotForKey,
  type SupportReferencePhotos,
} from '@/lib/support-reference'

/* Server-only read for the support form's reference photos. Split out of
   lib/support-reference.ts because this pulls in the service-role client and
   that file is imported by a 'use client' component — see the note there. */

/**
 * Current reference photos, keyed by UI slot.
 *
 * Never throws. Both callers render a customer-facing page, and a settings
 * hiccup must degrade to the "Photo coming soon" placeholder rather than take
 * the support form down. A stored value that no longer passes the allow-list is
 * dropped here too, so tightening the rule retroactively disables bad rows
 * instead of trusting whatever is already in the table.
 */
export async function getSupportReferencePhotos(): Promise<SupportReferencePhotos> {
  const out: SupportReferencePhotos = {}
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', SUPPORT_REFERENCE_KEYS as unknown as string[])

    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      const slot = slotForKey(row.key)
      if (slot && row.value && isAllowedReferenceUrl(row.value)) out[slot] = row.value
    }
  } catch {
    /* app_settings unreachable — fall through to placeholders */
  }
  return out
}
