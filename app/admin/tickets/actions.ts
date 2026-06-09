'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Ticket } from '@/lib/supabase'

export async function updateTicket(
  ticketId: string,
  data: { status: Ticket['status']; priority: Ticket['priority']; owner_id: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin
    .from('tickets')
    .update(data)
    .eq('id', ticketId)
  if (!error) {
    revalidatePath('/admin/tickets')
    revalidatePath(`/admin/tickets/${ticketId}`)
  }
  return { error: error?.message ?? null }
}
