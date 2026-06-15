import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FIELDS = [
  'serial_number', 'model_number', 'voltage',
  'customer_company', 'customer_name', 'customer_email', 'customer_phone',
  'location', 'ship_date', 'install_date', 'warranty_months', 'warranty_end',
  'pm_interval_months', 'status', 'notes', 'photo_urls',
] as const

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err
  const { data, error } = await supabaseAdmin.from('equipment').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err

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
