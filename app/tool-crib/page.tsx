import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CribTool } from '@/lib/supabase'
import MyToolsClient from './MyToolsClient'

export const dynamic = 'force-dynamic'

export default async function ToolCribHome({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>
}) {
  const { bad } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = user
    ? await supabaseAdmin
        .from('crib_tools')
        .select('*')
        .eq('held_by', user.id)
        .eq('status', 'checked_out')
        .order('held_since', { ascending: true })
    : { data: [] }

  return <MyToolsClient mine={(data ?? []) as CribTool[]} badCode={bad === '1'} />
}
