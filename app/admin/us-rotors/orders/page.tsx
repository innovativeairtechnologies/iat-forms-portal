import { supabaseAdmin } from '@/lib/supabase-admin'
import type { USRotorsOrder } from '@/lib/supabase'
import USRotorsOrdersClient from './USRotorsOrdersClient'

export const dynamic = 'force-dynamic'

export default async function USRotorsOrdersPage() {
  const { data: orders } = await supabaseAdmin
    .from('us_rotors_orders')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">US Rotors</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Orders</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">C-Series order submissions from the employee portal</p>
      </div>

      <div className="p-8">
        <USRotorsOrdersClient orders={(orders ?? []) as USRotorsOrder[]} />
      </div>
    </div>
  )
}
