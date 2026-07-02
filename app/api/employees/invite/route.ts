import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { normalizeRole, isStaffRole, ROLE_LABELS } from '@/lib/roles'

// Account creation is a full-admin action (getAdminUser is strict).
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, job_title, department, role: rawRole, is_admin, temp_password } = await req.json()
  if (!email)         return NextResponse.json({ error: 'Email is required' },            { status: 400 })
  if (!temp_password) return NextResponse.json({ error: 'Temporary password is required' }, { status: 400 })

  // Resolve the requested staff role. Falls back to the legacy is_admin boolean,
  // then to the base `production` tier. Customers are never created here.
  const role = normalizeRole(rawRole) ?? (is_admin ? 'admin' : 'production')
  if (!isStaffRole(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Create the user directly — no email sent, no rate limits
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,          // mark email as verified immediately
    user_metadata: { name: name || email.split('@')[0] },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (data?.user?.id) {
    const displayName = name || email.split('@')[0]

    // Upsert the profiles row (trigger may have already created it as 'production')
    await supabaseAdmin
      .from('profiles')
      .upsert({ id: data.user.id, role, display_name: displayName })

    // Patch the employee row (created by the auth trigger). Keep the legacy
    // employees.is_admin flag in sync with the role for the detail UI.
    await supabaseAdmin
      .from('employees')
      .update({
        name:       displayName,
        job_title:  job_title  || null,
        department: department || null,
        is_admin:   role === 'admin',
      })
      .eq('id', data.user.id)

    await logAudit({
      actor: { id: admin.user.id, name: admin.displayName },
      action: 'employee.invite',
      entityType: 'employee',
      entityId: data.user.id,
      summary: `Created account for ${displayName} (${email}) as ${ROLE_LABELS[role]}`,
      metadata: { email, role, job_title: job_title || null, department: department || null },
    })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
