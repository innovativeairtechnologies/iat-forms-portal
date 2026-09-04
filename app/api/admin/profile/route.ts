import { NextRequest, NextResponse } from 'next/server'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/* Uses the LOOSE getAdminSurfaceUser(), not the strict getAdminUser().
   /admin/profile is in OPEN_ADMIN_PREFIXES — every admin-surface role can reach
   the page — but this route was full-admin only, so a scoped role (HR, sales,
   engineering…) loaded their own profile and got a 401: blank name, blank email,
   and a Save that silently did nothing. Both handlers only ever read and write
   the CALLER'S OWN row (`.eq('id', …user.id)`), so widening the gate to match the
   page grants nobody reach over anybody else. Fixed 2026-09-04. */

export async function GET() {
  const admin = await getAdminSurfaceUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    display_name: admin.displayName,
    email: admin.user.email,
    role: admin.role,
  })
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSurfaceUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name } = await req.json()
  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ display_name: display_name.trim() })
    .eq('id', admin.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
