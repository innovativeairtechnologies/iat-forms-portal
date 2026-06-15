'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export async function markSubmissionRead(submissionId: string): Promise<void> {
  await supabaseAdmin.from('submissions').update({ is_read: true }).eq('id', submissionId)
  revalidatePath('/admin/submissions')
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<void> {
  // These actions run with the service-role key (bypasses RLS), so guard the
  // caller explicitly rather than relying only on middleware gating the path.
  const admin = await getAdminUser()
  if (!admin) throw new Error('Forbidden')

  // Snapshot prior status for the audit trail before overwriting.
  const { data: prior } = await supabaseAdmin
    .from('submissions')
    .select('status, form_title, data')
    .eq('id', submissionId)
    .single()

  await supabaseAdmin.from('submissions').update({ status }).eq('id', submissionId)
  revalidatePath('/admin/submissions')

  if (prior && prior.status !== status) {
    const data = prior.data as Record<string, unknown> | null
    const who = String(data?.['Employee Name'] || data?.['Full Name'] || data?.['Name'] || 'Anonymous')
    await logAudit({
      actor: { id: admin.user.id, name: admin.displayName },
      action: 'submission.status',
      entityType: 'submission',
      entityId: submissionId,
      summary: `Set ${who}'s "${prior.form_title || 'submission'}" to ${status.replace('_', ' ')}`,
      metadata: { from: prior.status, to: status },
    })
  }
}
