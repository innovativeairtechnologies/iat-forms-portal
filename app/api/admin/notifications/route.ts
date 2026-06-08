import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('submissions')
    .select('id, form_title, submitted_at, data, is_read')
    .order('submitted_at', { ascending: false })
    .limit(4)

  return NextResponse.json({ notifications: data || [] })
}
