import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, job_title, department, is_admin, temp_password } = await req.json()
  if (!email)         return NextResponse.json({ error: 'Email is required' },            { status: 400 })
  if (!temp_password) return NextResponse.json({ error: 'Temporary password is required' }, { status: 400 })

  // Create the user directly — no email sent, no rate limits
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,          // mark email as verified immediately
    user_metadata: { name: name || email.split('@')[0] },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // The trigger creates the employee row; patch in the extra fields
  if (data?.user?.id) {
    await supabaseAdmin
      .from('employees')
      .update({
        name:       name       || email.split('@')[0],
        job_title:  job_title  || null,
        department: department || null,
        is_admin:   is_admin   || false,
      })
      .eq('id', data.user.id)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
