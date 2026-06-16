import { supabaseAdmin } from '@/lib/supabase-admin'
import type { USRotorsOrder } from '@/lib/supabase'
import USRotorsOrdersClient from './USRotorsOrdersClient'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<USRotorsOrder['status'], string> = {
  pending:    'Pending',
  processing: 'Processing',
  shipped:    'Shipped',
  complete:   'Complete',
}

const STATUS_COLORS: Record<USRotorsOrder['status'], string> = {
  pending:    'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  processing: 'bg-sky-100   dark:bg-sky-950/40   text-sky-700   dark:text-sky-400',
  shipped:    'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400',
  complete:   'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
}

export { STATUS_LABELS, STATUS_COLORS }

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
        <USRotorsOrdersClient
          orders={(orders ?? []) as USRotorsOrder[]}
          statusLabels={STATUS_LABELS}
          statusColors={STATUS_COLORS}
        />
      </div>
    </div>
  )
}
