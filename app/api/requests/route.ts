import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendRequestNotificationToAdmins } from '@/lib/resend-pto'

export async function GET() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requests } = await supabaseAdmin
    .from('time_off_requests')
    .select('*')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ requests: requests || [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, hours_requested, start_date, end_date, notes } = body

  if (!type || !hours_requested || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!['pto', 'sick'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (hours_requested <= 0) {
    return NextResponse.json({ error: 'Hours must be greater than 0' }, { status: 400 })
  }

  // Fetch employee
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Insert request
  const { data: request, error } = await supabaseAdmin
    .from('time_off_requests')
    .insert({ employee_id: user.id, type, hours_requested, start_date, end_date, notes: notes || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admins — awaited so Vercel doesn't kill the function before Resend fires
  const { data: admins } = await supabaseAdmin
    .from('employees')
    .select('email')
    .eq('is_admin', true)

  const adminEmails = admins?.map(a => a.email) ?? []
  const fallback = process.env.ADMIN_NOTIFICATION_EMAIL
  if (fallback && !adminEmails.includes(fallback)) adminEmails.push(fallback)
  if (adminEmails.length) {
    await sendRequestNotificationToAdmins(adminEmails, employee, request).catch(console.error)
  }

  return NextResponse.json({ request }, { status: 201 })
}
