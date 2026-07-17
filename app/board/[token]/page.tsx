import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ProductionDepartment, ProductionPerson, ProductionTask } from '@/lib/supabase'
import { shopDate } from '@/lib/production'
import BoardClient from './BoardClient'

// ─────────────────────────────────────────────────────────────────────────────
// /board/<token> — the PUBLIC production checklist. No login, by design: the
// floor has no portal accounts, and the board is meant to be scanned off a
// printed QR code and used in ten seconds with gloves on.
//
// It is public because middleware.ts's matcher is an allowlist that does not
// list /board — the same way /support is public. Do NOT add it there.
//
// The token in the URL is the ONLY thing gating this page, so everything below
// is scoped to the department that token resolves to, and the token itself
// never reaches the client (see the explicit column list — no `select('*')`).
// ─────────────────────────────────────────────────────────────────────────────

// Belt-and-braces with the X-Robots-Tag header on /board/:path* in
// next.config.js. Unguessable is not unindexed — a token leaks via a Referer
// header or a pasted link, and this app has no robots.txt at all.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

// Per-request: a board that served a cached snapshot would show work as
// outstanding after it was checked off — the one thing it must never do.
export const dynamic = 'force-dynamic'

export default async function BoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // .eq(), never .ilike() — a wildcard on a token would both match loosely and
  // throw away the entropy the whole design rests on.
  const { data: dept } = await supabaseAdmin
    .from('production_departments')
    // Explicit columns: `token` must never be serialised into the page payload.
    // The client already knows it (it's in the URL) but echoing secrets into
    // HTML is how they end up in caches and screenshots.
    .select('id, name, blurb, is_active, sort_order, created_at, updated_at')
    .eq('token', token)
    .maybeSingle()

  // A wrong/rotated token and a deactivated department are the same 404 on
  // purpose — distinguishing them would confirm which tokens are real.
  if (!dept || !dept.is_active) notFound()

  const [{ data: tasks }, { data: people }] = await Promise.all([
    supabaseAdmin
      .from('production_tasks')
      .select('*')
      .eq('department_id', dept.id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('production_people')
      .select('*')
      .eq('department_id', dept.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <BoardClient
      token={token}
      department={dept as Omit<ProductionDepartment, 'token'>}
      tasks={(tasks ?? []) as ProductionTask[]}
      people={(people ?? []) as ProductionPerson[]}
      // Computed on the server so every device agrees on "today" regardless of
      // the tablet's own clock or timezone — a phone left on the wrong date
      // would otherwise show a daily task as already done.
      today={shopDate()}
    />
  )
}
