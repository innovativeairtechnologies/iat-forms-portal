import { supabaseAdmin } from '@/lib/supabase-admin'
import EquipmentClient from './EquipmentClient'

export const dynamic = 'force-dynamic'

export default async function EquipmentPage() {
  const { data: equipment } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .order('created_at', { ascending: false })

  return <EquipmentClient equipment={equipment || []} />
}
