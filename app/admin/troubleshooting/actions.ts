'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import type { TroubleshootingIntake } from '@/lib/supabase'

// Admin-only: move a troubleshooting case through new → reviewed → closed.
export async function updateTroubleshootingStatus(
  intakeId: string,
  status: TroubleshootingIntake['status'],
): Promise<{ error: string | null }> {
  const admin = await getAdminUser()
  if (!admin) return { error: 'Forbidden' }

  const { data: prior } = await supabaseAdmin
    .from('troubleshooting_intakes')
    .select('status, reference_number, customer_name')
    .eq('id', intakeId)
    .single()

  const { error } = await supabaseAdmin
    .from('troubleshooting_intakes')
    .update({ status })
    .eq('id', intakeId)

  if (!error && prior) {
    revalidatePath('/admin/troubleshooting')
    revalidatePath(`/admin/troubleshooting/${intakeId}`)
    if (prior.status !== status) {
      await logAudit({
        actor: { id: admin.user.id, name: admin.displayName },
        action: 'troubleshooting.status',
        entityType: 'troubleshooting_intake',
        entityId: intakeId,
        summary: `Set troubleshooting case ${prior.reference_number} (${prior.customer_name || 'Unknown'}) to ${status}`,
        metadata: { from: prior.status, to: status },
      })
    }
  }

  return { error: error?.message ?? null }
}
