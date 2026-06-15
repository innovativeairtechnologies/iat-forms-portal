import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FIELDS = [
  'serial_number', 'model_number', 'voltage',
  'customer_company', 'customer_name', 'customer_email', 'customer_phone',
  'location', 'ship_date', 'install_date', 'warranty_months', 'warranty_end',
  'status', 'notes',
] as const

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to load equipment' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const body = await req.json().catch(() => ({}))
  const serial = (body.serial_number || '').trim()
  if (!serial) return NextResponse.json({ error: 'Serial number is required' }, { status: 400 })

  const row: Record<string, unknown> = {}
  for (const f of FIELDS) if (f in body) row[f] = body[f]
  row.serial_number = serial

  const { data, error } = await supabaseAdmin.from('equipment').insert(row).select().single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A unit with that serial number already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
  return NextResponse.json(data)
}
