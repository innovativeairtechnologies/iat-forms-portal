import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperAdmin } from '@/lib/api-auth'

// Super-admin-only: approve a pending form and publish it. Approval is a
// one-time gate — once approved, regular admins can pause/unpause freely.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth

  const { error } = await supabaseAdmin
    .from('forms')
    .update({
      approval_status: 'approved',
      approved_by: auth.userId,
      approved_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
