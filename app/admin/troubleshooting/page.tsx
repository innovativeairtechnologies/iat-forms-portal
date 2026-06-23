import { supabaseAdmin } from '@/lib/supabase-admin'
import TroubleshootingQueueClient from './TroubleshootingQueueClient'

export const dynamic = 'force-dynamic'

export default async function AdminTroubleshootingPage() {
  const { data: intakes } = await supabaseAdmin
    .from('troubleshooting_intakes')
    .select('*')
    .order('created_at', { ascending: false })

  return <TroubleshootingQueueClient intakes={intakes || []} />
}
