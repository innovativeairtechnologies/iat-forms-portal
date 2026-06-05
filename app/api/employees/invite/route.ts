import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, job_title, department, is_admin } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name: name || email.split('@')[0] },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/employee/profile`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update the auto-created employee row with extra fields
  if (data?.user?.id) {
    await supabaseAdmin
      .from('employees')
      .update({
        name:       name || email.split('@')[0],
        job_title:  job_title  || null,
        department: department || null,
        is_admin:   is_admin   || false,
      })
      .eq('id', data.user.id)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
