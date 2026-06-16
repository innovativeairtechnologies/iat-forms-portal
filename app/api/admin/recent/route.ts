import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/* Recent admin activity for the ⌘K palette's empty state. Returns the latest
   audit-log entries so an admin who just opens the palette sees "what just
   happened" and can jump straight to the affected record. Mirrors the dashboard
   Admin Activity feed but adds the entity coordinates the palette needs to link. */

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_name, action, entity_type, entity_id, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(7)

  return NextResponse.json({ recent: data || [] })
}
