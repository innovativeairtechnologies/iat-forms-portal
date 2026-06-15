import { supabaseAdmin } from './supabase-admin'

/**
 * Append-only admin accountability trail (table: audit_log, migration 020).
 *
 * Call after a consequential admin mutation succeeds — role changes, form
 * approvals / deletions, time-off decisions, etc. Writes are best-effort: a
 * logging failure is swallowed and logged to the console, never surfaced to the
 * caller, so audit can never break the action it describes.
 */

export type AuditActor = { id?: string | null; name?: string | null }

export type AuditEntry = {
  actor?: AuditActor
  /** machine-readable key, dot-namespaced — e.g. 'role.update', 'form.approve' */
  action: string
  /** the kind of thing acted on — 'employee' | 'form' | 'time_off_request' | … */
  entityType?: string
  /** id of the affected row (any type — coerced to text) */
  entityId?: string | number | null
  /** human-readable one-liner shown in the audit viewer */
  summary: string
  /** before/after values or any extra context */
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor_id: entry.actor?.id ?? null,
      actor_name: entry.actor?.name ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId != null ? String(entry.entityId) : null,
      summary: entry.summary,
      metadata: entry.metadata ?? {},
    })
  } catch (err) {
    console.error('[audit] failed to write audit entry:', err)
  }
}
