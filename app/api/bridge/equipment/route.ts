import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { effectiveWarrantyEnd, warrantyState, daysUntilWarrantyEnd } from '@/lib/equipment'
import { milestoneProgress } from '@/lib/customer'
import type { EquipmentMilestone } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Bridge: this customer's units + milestones + warranty state.
 *
 * Mirrors the projection app/customer/page.tsx builds for UnitView, using the
 * SAME helpers (lib/equipment.ts, lib/customer.ts) so the split portal and the
 * internal one can never disagree about a warranty date. Warranty is computed
 * HERE rather than shipped as raw fields, so warranty_months / raw warranty_end
 * never leave the internal side.
 *
 * Columns are listed explicitly. The internal page can afford select('*')
 * because its view mapping runs before the RSC boundary; a JSON bridge has no
 * such backstop, so a bare '*' would put customer_phone/email, notes, and
 * pm_interval_months on the wire.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/equipment')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  const { data: equipment, error } = await supabaseAdmin
    .from('equipment')
    .select(
      'id, serial_number, model_number, voltage, location, ship_date, install_date, photo_urls, warranty_months, warranty_end'
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })

  const ids = (equipment ?? []).map((e) => e.id)
  const { data: milestones } = ids.length
    ? await supabaseAdmin
        .from('equipment_milestones')
        .select('id, equipment_id, stage, status, occurred_at, sort_order')
        .in('equipment_id', ids)
        .order('sort_order', { ascending: true })
    : { data: [] as EquipmentMilestone[] }

  const byEquipment = new Map<string, EquipmentMilestone[]>()
  for (const m of (milestones ?? []) as EquipmentMilestone[]) {
    const list = byEquipment.get(m.equipment_id) ?? []
    list.push(m)
    byEquipment.set(m.equipment_id, list)
  }

  const units = (equipment ?? []).map((e) => {
    const ms = byEquipment.get(e.id) ?? []
    return {
      id: e.id,
      serial_number: e.serial_number,
      model_number: e.model_number,
      voltage: e.voltage,
      location: e.location,
      ship_date: e.ship_date,
      install_date: e.install_date,
      photos: e.photo_urls || [],
      // 'in' | 'out' | 'unknown' — there is deliberately no 'expiring' state in
      // the data layer; the UI derives it as state === 'in' && daysLeft <= 90.
      warranty: {
        state: warrantyState(e),
        end: effectiveWarrantyEnd(e),
        daysLeft: daysUntilWarrantyEnd(e),
      },
      milestones: ms.map((m) => ({
        stage: m.stage,
        status: m.status,
        occurred_at: m.occurred_at,
        sort_order: m.sort_order,
      })),
      progress: milestoneProgress(ms),
    }
  })

  return NextResponse.json({ units })
}
