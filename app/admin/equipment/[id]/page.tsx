import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import EquipmentDetailClient from './EquipmentDetailClient'

export const dynamic = 'force-dynamic'

export default async function EquipmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { data: equipment } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!equipment) notFound()

  // Full service history: every ticket that shares this unit's serial number.
  const { data: tickets } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, status, priority, problem_description, resolved_reason, created_at')
    .eq('serial_number', equipment.serial_number)
    .order('created_at', { ascending: false })

  return <EquipmentDetailClient equipment={equipment} tickets={tickets ?? []} />
}
