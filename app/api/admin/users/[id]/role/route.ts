import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const err = await requireAdminAuth()
  if (err) return err

  const { role } = await req.json()
  if (role !== 'admin' && role !== 'employee') {
    return NextResponse.json({ error: 'role must be admin or employee' }, { status: 400 })
  }

  // Update profiles table (source of truth for auth)
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: params.id, role })

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  // Keep employees.is_admin in sync for the existing employee detail UI
  await supabaseAdmin
    .from('employees')
    .update({ is_admin: role === 'admin' })
    .eq('id', params.id)

  return NextResponse.json({ ok: true, role })
}
