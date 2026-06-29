'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeState, type BoardState } from './board-config'

/* Save the signed-in employee's personal board arrangement. Mirrors the org-chart
   actions: the service-role client performs the write, but the caller is resolved
   from the authenticated session (never trusted from the client), so a user can
   only ever write their own employees row. State is normalised before persisting
   so a malformed payload can't corrupt the column. */
export async function saveBoardState(state: BoardState): Promise<void> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const clean = normalizeState(state)

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ board_layout: clean })
    .eq('id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/employee/board')
}
