import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import type { CribTool } from '@/lib/supabase'
import ToolCribClient from './ToolCribClient'

export const dynamic = 'force-dynamic'

export type CribToolRow = CribTool & { holder_name: string | null }
export type EmployeeOption = { id: string; name: string }

export default async function ToolCribPage() {
  // The holder join is why custody is denormalized onto the row: "who has it"
  // is one FK hop here, not a window function over the whole event log.
  const [{ data }, { data: employees }, customers] = await Promise.all([
    supabaseAdmin
      .from('crib_tools')
      .select('*, holder:employees!crib_tools_held_by_fkey(name)')
      .order('tag_code', { ascending: true }),
    // Assign targets — active, non-customer (customers hold an employees row but
    // never touch the floor; the assign routes re-check this server-side).
    supabaseAdmin.from('employees').select('id, name').eq('is_active', true).order('name'),
    getCustomerIds(),
  ])

  const tools: CribToolRow[] = (data ?? []).map(({ holder, ...t }: any) => ({
    ...t,
    // A checked-out tool CAN legally have a null holder — held_by is ON DELETE
    // SET NULL, so deleting an account leaves custody dangling by design (see
    // the constraint note in migration 050). Say so plainly instead of rendering
    // a blank cell that reads like a bug.
    holder_name: t.held_by ? (holder?.name ?? null) : null,
  }))

  const assignable = ((employees ?? []) as EmployeeOption[]).filter(e => !customers.has(e.id))

  return <ToolCribClient tools={tools} employees={assignable} />
}
