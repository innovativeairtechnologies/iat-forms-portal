export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { repPipelineByName, pipelineCandidates, repNameKey, type RepPipeline } from '@/lib/rep-pipeline'
import { periodOf, recentPeriods, isPeriod, type RepScorecard } from '@/lib/rep-scorecard'
import type { Company, Contact } from '@/lib/supabase'
import RepScorecardClient from './RepScorecardClient'

/* The rep scorecard (migration 075) — Sales' rep-health review, ported from the
   IAT_Rep_Scorecard workbook. Page authz is middleware's job
   (canAccessAdminPath → 'deals'), so there's no guard call here; that's the
   house pattern (territories/page.tsx). getAdminSurfaceUser is read only for
   the ROLE: "admin and sales only" scoring is enforced server-side by
   requireRepScorecardAuth({ write: true }) — canEdit just keeps the UI honest.

   Reps are `contacts` at a kind='rep_firm' company (the CRM layer, 062), the
   same roster the territory map uses. EVERY period's scorecards are loaded, not
   just the selected one: the drawer shows a rep's trend across quarters, and at
   this scale (tens of reps × a handful of periods) one query beats a round trip
   per period switch. */

export default async function RepScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = isPeriod(periodParam) ? periodParam : periodOf(new Date())

  const [surfaceUser, firmsQ, repsQ, cardsQ, pipeline] = await Promise.all([
    getAdminSurfaceUser(),
    supabaseAdmin.from('companies').select('*').eq('kind', 'rep_firm').order('name'),
    supabaseAdmin.from('contacts').select('*').order('name'),
    supabaseAdmin.from('rep_scorecards').select('*'),
    repPipelineByName(),
  ])

  const firms = (firmsQ.data ?? []) as Company[]
  const firmIds = new Set(firms.map((f) => f.id))
  // Filter to rep-firm people — prospect/customer contacts are CRM rows and
  // never belong on this board.
  const reps = ((repsQ.data ?? []) as Contact[]).filter((c) => firmIds.has(c.company_id))
  const repIds = new Set(reps.map((r) => r.id))
  const cards = ((cardsQ.data ?? []) as RepScorecard[]).filter((c) => repIds.has(c.contact_id))

  // Only the DryWare figures for reps actually on the roster — the full map
  // includes end-customer contacts, which are none of this page's business.
  const pipelineByRep: Record<string, RepPipeline> = {}
  for (const rep of reps) {
    const hit = pipeline.get(repNameKey(rep.name))
    if (hit) pipelineByRep[rep.id] = hit
  }

  const candidates = pipelineCandidates(pipeline, reps.map((r) => r.name))

  // Offer the last 8 quarters plus any period already scored (so an older
  // backfilled review never becomes unreachable), newest first.
  const periods = [...new Set([...recentPeriods(new Date()), ...cards.map((c) => c.period), period])]
    .sort((a, b) => b.localeCompare(a))

  const canEdit = surfaceUser?.role === 'admin' || surfaceUser?.role === 'sales'

  return (
    <RepScorecardClient
      firms={firms.map((f) => ({ id: f.id, name: f.name }))}
      initialReps={reps}
      initialCards={cards}
      pipelineByRep={pipelineByRep}
      candidates={candidates}
      period={period}
      periods={periods}
      canEdit={canEdit}
    />
  )
}
