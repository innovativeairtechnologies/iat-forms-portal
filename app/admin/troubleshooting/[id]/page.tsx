import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import TroubleshootingDetailClient from './TroubleshootingDetailClient'

export const dynamic = 'force-dynamic'

export default async function TroubleshootingDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { data: intake } = await supabaseAdmin
    .from('troubleshooting_intakes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!intake) notFound()

  // Link to the equipment registry if we already know this serial.
  let equipmentId: string | null = null
  if (intake.serial_number) {
    const { data: eq } = await supabaseAdmin
      .from('equipment')
      .select('id')
      .eq('serial_number', intake.serial_number)
      .maybeSingle()
    equipmentId = eq?.id ?? null
  }

  return <TroubleshootingDetailClient intake={intake} equipmentId={equipmentId} />
}
