import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Customers hold an employees row too (see lib/staff.ts) — filter them out, or
  // this staff roster hands their name, email and phone to any signed-in caller.
  const [{ data: employees }, customers] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, email, job_title, department, phone, bio, avatar_url, hire_date')
      .eq('is_active', true)
      .order('name'),
    getCustomerIds(),
  ])

  return NextResponse.json({ employees: (employees || []).filter(e => !customers.has(e.id)) })
}
