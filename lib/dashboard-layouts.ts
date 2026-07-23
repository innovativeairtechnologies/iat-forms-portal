import { supabaseAdmin } from '@/lib/supabase-admin'
import type { LayoutItem } from '@/components/dashboards/dept-cards'

/* Per-user "build your own dashboard" layout persistence (migration 067,
   public.dashboard_layouts). Read/written with the service-role client from the
   server; RLS on the table is defense-in-depth for any user-scoped access. A
   missing/empty row means "use the code default layout" (see dept-cards). */

export async function getLayout(userId: string): Promise<LayoutItem[] | null> {
  const { data } = await supabaseAdmin
    .from('dashboard_layouts')
    .select('layout')
    .eq('user_id', userId)
    .maybeSingle()
  const layout = data?.layout
  if (!Array.isArray(layout) || layout.length === 0) return null
  return layout as LayoutItem[]
}

export async function saveLayout(userId: string, layout: LayoutItem[]): Promise<void> {
  await supabaseAdmin
    .from('dashboard_layouts')
    .upsert({ user_id: userId, layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

export async function resetLayout(userId: string): Promise<void> {
  await supabaseAdmin.from('dashboard_layouts').delete().eq('user_id', userId)
}
