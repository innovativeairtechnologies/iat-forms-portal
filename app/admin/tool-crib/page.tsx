import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CribTool } from '@/lib/supabase'
import ToolCribClient from './ToolCribClient'

export const dynamic = 'force-dynamic'

export type CribToolRow = CribTool & { holder_name: string | null }

export default async function ToolCribPage() {
  // The holder join is why custody is denormalized onto the row: "who has it"
  // is one FK hop here, not a window function over the whole event log.
  const { data } = await supabaseAdmin
    .from('crib_tools')
    .select('*, holder:employees!crib_tools_held_by_fkey(name)')
    .order('tag_code', { ascending: true })

  const tools: CribToolRow[] = (data ?? []).map(({ holder, ...t }: any) => ({
    ...t,
    // A checked-out tool CAN legally have a null holder — held_by is ON DELETE
    // SET NULL, so deleting an account leaves custody dangling by design (see
    // the constraint note in migration 050). Say so plainly instead of rendering
    // a blank cell that reads like a bug.
    holder_name: t.held_by ? (holder?.name ?? null) : null,
  }))

  return <ToolCribClient tools={tools} />
}
