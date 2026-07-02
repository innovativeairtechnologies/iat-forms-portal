// Datasets the admin Data Reset panel (/admin/reset) can wipe. Kept in its own
// module because a Next.js route handler file may only export HTTP methods +
// specific config keys — it cannot export shared constants/types.

export const RESET_TARGETS = [
  'submissions',
  'tickets',
  'equipment',
  'customers',
  'pto',
  'sick',
  'employees',
] as const

export type ResetTarget = (typeof RESET_TARGETS)[number]
