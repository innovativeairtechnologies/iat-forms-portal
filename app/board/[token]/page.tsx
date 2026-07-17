import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  ProductionDepartment,
  ProductionPerson,
  ProductionProject,
  ProductionTask,
} from '@/lib/supabase'
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
//
// ?project=<id> optionally focuses ONE project (the per-project link the admin
// can copy/print). It only ever narrows what's already on this token's board, so
// a wrong/foreign id is harmless — it just shows nothing and we fall back to the
// full board.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

// Per-request: a board that served a cached snapshot would show work as
// outstanding after it was checked off — the one thing it must never do.
export const dynamic = 'force-dynamic'

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ project?: string }>
}) {
  const { token } = await params
  const { project: focusProject } = await searchParams

  // .eq(), never .ilike() — a wildcard on a token would both match loosely and
  // throw away the entropy the whole design rests on.
  const { data: dept } = await supabaseAdmin
    .from('production_departments')
    // Explicit columns: `token` must never be serialised into the page payload.
    .select('id, name, blurb, is_active, sort_order, created_at, updated_at')
    .eq('token', token)
    .maybeSingle()

  if (!dept || !dept.is_active) notFound()

  const [{ data: projects }, { data: tasks }, { data: people }] = await Promise.all([
    supabaseAdmin
      .from('production_projects')
      .select('*')
      .eq('department_id', dept.id)
      .is('archived_at', null)
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
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

  // A focus id that doesn't match a live project on this board falls back to the
  // full board rather than showing an empty page.
  const projectList = (projects ?? []) as ProductionProject[]
  const focus =
    focusProject && projectList.some((p) => p.id === focusProject) ? focusProject : null

  return (
    <BoardClient
      token={token}
      department={dept as Omit<ProductionDepartment, 'token'>}
      projects={projectList}
      tasks={(tasks ?? []) as ProductionTask[]}
      people={(people ?? []) as ProductionPerson[]}
      focusProjectId={focus}
      // Computed on the server so every device agrees on "today" regardless of
      // the tablet's own clock or timezone.
      today={shopDate()}
    />
  )
}
