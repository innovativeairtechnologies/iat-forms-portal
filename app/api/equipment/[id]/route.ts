import { NextRequest, NextResponse } from 'next/server'
import { requireEquipmentAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

const FIELDS = [
  'serial_number', 'model_number', 'voltage',
  'customer_company', 'customer_name', 'customer_email', 'customer_phone',
  'location', 'ship_date', 'install_date', 'warranty_months', 'warranty_end',
  'pm_interval_months', 'status', 'notes', 'photo_urls',
] as const

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireEquipmentAuth();if (err) return err
  const { data, error } = await supabaseAdmin.from('equipment').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireEquipmentAuth();if (err) return err

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  for (const f of FIELDS) if (f in body) update[f] = body[f]

  if ('serial_number' in update) {
    const serial = String(update.serial_number || '').trim()
    if (!serial) return NextResponse.json({ error: 'Serial number cannot be empty' }, { status: 400 })
    update.serial_number = serial
  }

  const { data, error } = await supabaseAdmin
    .from('equipment')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A unit with that serial number already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// Permanently delete an equipment unit (build/ship milestones cascade via FK).
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireEquipmentAuth();if (err) return err

  const { data: unit } = await supabaseAdmin
    .from('equipment')
    .select('serial_number, model_number')
    .eq('id', params.id)
    .single()

  const { error } = await supabaseAdmin.from('equipment').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: admin?.user.id, name: admin?.displayName },
    action: 'equipment.delete',
    entityType: 'equipment',
    entityId: params.id,
    summary: `Deleted equipment ${unit?.serial_number || unit?.model_number || params.id}`,
  })

  return NextResponse.json({ success: true })
}
