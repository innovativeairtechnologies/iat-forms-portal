import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth } from '@/lib/bridge-auth'

export const dynamic = 'force-dynamic'

/**
 * Bridge: published KB articles for the customer dashboard rail.
 *
 * The only bridge endpoint with no customer scope — these articles are already
 * public (kb_articles_public_read allows anon SELECT where is_published). Same
 * columns and ordering as app/customer/page.tsx; `body` and `tags` are
 * deliberately not included (the rail renders title/excerpt/category only).
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/kb')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabaseAdmin
    .from('kb_articles')
    .select('title, slug, excerpt, category')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(6)

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  return NextResponse.json({ articles: data ?? [] })
}
