import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, email, job_title, department, phone, bio, avatar_url, hire_date')
    .eq('is_active', true)
    .order('name')

  return NextResponse.json({ employees: employees || [] })
}
