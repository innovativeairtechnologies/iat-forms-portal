import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'us_rotors_orders', max: 20, windowSeconds: 600 })
  if (limited) return limited

  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    const ts = Date.now().toString().slice(-6)
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const order_ref = `COF-${ts}-${rand}`

    const { error } = await supabaseAdmin
      .from('us_rotors_orders')
      .insert({
        order_ref,
        company:       body.company,
        po_number:     body.po_number || null,
        contact_name:  body.contact_name,
        contact_email: body.contact_email,
        model:         body.model,
        quantity:      body.quantity || 1,
        rph:           body.rph || null,
        hz:            body.hz || null,
        sprocket:      body.sprocket || null,
        motor_voltage: body.motor_voltage || '120/1/60',
        config:        body.config || 'A',
        notes:         body.notes || null,
        status:        'pending',
        submitted_by:  user.id,
      })

    if (error) {
      console.error('[us-rotors/orders] insert error:', error)
      return NextResponse.json({ error: 'Failed to save order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order_ref })
  } catch (err) {
    console.error('[us-rotors/orders] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const query = supabaseAdmin
    .from('us_rotors_orders')
    .select('*')
    .order('created_at', { ascending: false })

  // Non-admins only see their own orders
  if (!employee?.is_admin) {
    query.eq('submitted_by', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  return NextResponse.json({ orders: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!employee?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id, status } = await req.json()
    const valid = ['pending', 'processing', 'shipped', 'complete']
    if (!id || !valid.includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('us_rotors_orders')
      .update({ status })
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[us-rotors/orders PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
