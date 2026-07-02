// Entities the generic bulk-delete endpoint (/api/admin/bulk-delete) accepts.
// Kept in its own module because a Next.js route handler file may only export
// HTTP methods — it cannot export shared constants/types.

export const BULK_ENTITIES = [
  'submissions',
  'tickets',
  'equipment',
  'customers',
  'employees',
  'time_off',
] as const

export type BulkEntity = (typeof BULK_ENTITIES)[number]

export const BULK_ENTITY_LABEL: Record<BulkEntity, string> = {
  submissions: 'submission',
  tickets: 'ticket',
  equipment: 'equipment unit',
  customers: 'customer',
  employees: 'employee',
  time_off: 'request',
}
