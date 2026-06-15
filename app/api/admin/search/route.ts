import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/* Live search backing the ⌘K command palette. Returns a few matches across the
   things an admin jumps to most: forms, employees, and tickets. Kept small &
   fast (5 each) — the palette also has static nav/actions baked in client-side. */

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = (req.nextUrl.searchParams.get('q') || '').trim()
  // Strip characters that have meaning inside a PostgREST .or() filter
  // (comma = separator, parens = grouping) plus our own wildcards, so user
  // input can't break the query string.
  const q = raw.replace(/[,()%*\\]/g, '')
  if (q.length < 2) {
    return NextResponse.json({ forms: [], employees: [], tickets: [] })
  }

  const like = `%${q}%`
  const [{ data: forms }, { data: employees }, { data: tickets }] = await Promise.all([
    supabaseAdmin
      .from('forms')
      .select('id, title, slug, is_active')
      .ilike('title', like)
      .limit(5),
    supabaseAdmin
      .from('employees')
      .select('id, name, email, job_title')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .eq('is_active', true)
      .limit(5),
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, customer_name, status')
      .or(`ticket_number.ilike.${like},customer_name.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    forms: forms || [],
    employees: employees || [],
    tickets: tickets || [],
  })
}
