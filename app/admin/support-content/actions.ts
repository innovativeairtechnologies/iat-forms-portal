'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import {
  isAllowedReferenceUrl,
  isSupportReferenceKey,
  type SupportReferenceKey,
} from '@/lib/support-reference'

/* Writes behind /admin/support-content. Service-role writes, so the caller is
   re-checked against the 'tickets' permission here rather than trusting
   middleware alone — same model as the home-content / org-chart actions. */

async function requireSupportContent() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('tickets')) throw new Error('Forbidden')
  return admin
}

/**
 * Point a reference slot at an uploaded image, or pass null to clear it (the
 * support form falls back to its "Photo coming soon" placeholder).
 *
 * The URL is re-validated server-side even though the browser only ever submits
 * a URL it just got back from Storage: this is a server action, so the argument
 * is attacker-controlled, and the value ends up in an <img src> on a public page.
 */
export async function setSupportReferencePhoto(
  key: SupportReferenceKey,
  url: string | null,
): Promise<void> {
  const admin = await requireSupportContent()
  if (!isSupportReferenceKey(key)) throw new Error('Unknown photo slot.')

  const value = typeof url === 'string' && url.trim() ? url.trim() : null
  if (value && !isAllowedReferenceUrl(value)) {
    throw new Error('Images must be uploaded here — external links are not allowed.')
  }

  const { error } = await supabaseAdmin.from('app_settings').upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: (admin as { id?: string }).id ?? null,
    },
    { onConflict: 'key' },
  )
  if (error) throw new Error(error.message)

  revalidatePath('/admin/support-content')
  revalidatePath('/support/equipment-support')
}
