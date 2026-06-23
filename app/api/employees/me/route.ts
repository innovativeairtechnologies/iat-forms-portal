import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data: employee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  // If the trigger missed creating the row, create it now
  if (!employee) {
    const { data: created } = await supabaseAdmin
      .from('employees')
      .insert({
        id:    user.id,
        email: user.email!,
        name:  user.user_metadata?.name || user.email!.split('@')[0],
      })
      .select()
      .single()
    employee = created
  }

  if (!employee) return NextResponse.json({ error: 'Could not load employee record' }, { status: 500 })

  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Only allow employees to update their own editable fields
  const allowed = ['name', 'job_title', 'department', 'phone', 'bio']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await supabaseAdmin
    .from('employees')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
