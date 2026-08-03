/* Reference photos shown on the "Wheel & Seals" step of the PUBLIC equipment
   support form. Staff upload them at /admin/support-content; they're stored as
   public Storage URLs in the app_settings key/value store (migration 069), so
   swapping an image is a staff action rather than a deploy.

   An unset slot makes the form render its "Photo coming soon" placeholder —
   exactly what shipped before this, so the form is correct with zero rows here.

   ⚠️ Deliberately DB-free so `components/support/EquipmentTicketForm.tsx` (a
   client component) can import the types. The read lives in the sibling
   `support-reference-server.ts`, which pulls in the service-role client —
   `lib/supabase-admin.ts` has no `server-only` guard, so nothing would error if
   that import crossed into the browser bundle. Keep the split. */

export const SUPPORT_REFERENCE_SLOTS = [
  {
    slot: 'wheel',
    key: 'support_reference_wheel',
    caption: 'Desiccant wheel',
    help: 'Shown above "Is the desiccant wheel rotating?" — the customer should be able to tell which part of the unit to look at.',
  },
  {
    slot: 'seals',
    key: 'support_reference_seals',
    caption: 'Wheel seals',
    help: 'Shown above "Any visible light leakage at the seals?" — a shot of the seal edges is what helps most here.',
  },
] as const

export type SupportReferenceSlot = (typeof SUPPORT_REFERENCE_SLOTS)[number]['slot']
export type SupportReferenceKey = (typeof SUPPORT_REFERENCE_SLOTS)[number]['key']

/** Resolved photos, keyed by UI slot rather than by storage key, so components
 *  read `photos.wheel` and never care what the app_settings row is called. */
export type SupportReferencePhotos = Partial<Record<SupportReferenceSlot, string>>

export const SUPPORT_REFERENCE_KEYS: readonly SupportReferenceKey[] =
  SUPPORT_REFERENCE_SLOTS.map((s) => s.key)

export function slotForKey(key: string): SupportReferenceSlot | null {
  return SUPPORT_REFERENCE_SLOTS.find((s) => s.key === key)?.slot ?? null
}

export function isSupportReferenceKey(v: unknown): v is SupportReferenceKey {
  return typeof v === 'string' && SUPPORT_REFERENCE_KEYS.includes(v as SupportReferenceKey)
}

/* Only https URLs inside our own public bucket are storable. The value is
   rendered straight into an <img src> on a page anonymous customers can reach,
   so an off-site or javascript: URL must never survive a write — the same rule
   `validPhotoUrls` enforces on customer ticket photos in app/api/tickets/route.ts.
   Note this also keeps us off `images.remotePatterns` wildcards. */
const PUBLIC_STORAGE_PREFIX =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/ticket-photos/`

export function isAllowedReferenceUrl(url: string): boolean {
  // Fail closed on a missing/misconfigured env rather than accepting everything.
  if (!PUBLIC_STORAGE_PREFIX.startsWith('https://')) return false
  try {
    return new URL(url).protocol === 'https:' && url.startsWith(PUBLIC_STORAGE_PREFIX)
  } catch {
    return false
  }
}
