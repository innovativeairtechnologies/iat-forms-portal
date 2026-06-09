'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function markSubmissionRead(submissionId: string): Promise<void> {
  await supabaseAdmin.from('submissions').update({ is_read: true }).eq('id', submissionId)
  revalidatePath('/admin/submissions')
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<void> {
  await supabaseAdmin.from('submissions').update({ status }).eq('id', submissionId)
  revalidatePath('/admin/submissions')
}
