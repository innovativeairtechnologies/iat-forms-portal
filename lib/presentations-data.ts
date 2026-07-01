import { supabaseAdmin } from './supabase-admin'
import type { PresentationBlock, Presentation, PresentationItem, DeckSummary } from './presentations'

/* ────────────────────────────────────────────────────────────────────────────
   Presentations — server-side data access. Everything runs through the
   service-role client (the tables are RLS-on/no-policies, admin-only). Import
   ONLY from server components / server actions — never a client component
   (it pulls in supabaseAdmin, which must never reach the browser bundle).
   ──────────────────────────────────────────────────────────────────────────── */

/** All library blocks (active by default), newest first. */
export async function getLibraryBlocks(opts?: { includeArchived?: boolean }): Promise<PresentationBlock[]> {
  let q = supabaseAdmin.from('presentation_blocks').select('*').order('created_at', { ascending: false })
  if (!opts?.includeArchived) q = q.is('archived_at', null)
  const { data } = await q
  return (data as PresentationBlock[] | null) ?? []
}

/** Every deck with its block count + clip runtime, newest-edited first. */
export async function getDeckSummaries(): Promise<DeckSummary[]> {
  const [{ data: decks }, { data: items }] = await Promise.all([
    supabaseAdmin.from('presentations').select('*').order('updated_at', { ascending: false }),
    supabaseAdmin.from('presentation_items').select('presentation_id, block:presentation_blocks(duration_seconds)'),
  ])

  const agg = new Map<string, { count: number; runtime: number }>()
  for (const it of (items as { presentation_id: string; block: { duration_seconds: number | null } | null }[] | null) ?? []) {
    const cur = agg.get(it.presentation_id) ?? { count: 0, runtime: 0 }
    cur.count += 1
    cur.runtime += it.block?.duration_seconds || 0
    agg.set(it.presentation_id, cur)
  }

  return ((decks as Presentation[] | null) ?? []).map((d) => ({
    ...d,
    block_count: agg.get(d.id)?.count ?? 0,
    runtime_seconds: agg.get(d.id)?.runtime ?? 0,
  }))
}

/** A single deck, or null if it doesn't exist. */
export async function getPresentation(id: string): Promise<Presentation | null> {
  const { data } = await supabaseAdmin.from('presentations').select('*').eq('id', id).single()
  return (data as Presentation | null) ?? null
}

/** A deck's items joined to their full blocks, in order. */
export async function getPresentationItems(id: string): Promise<PresentationItem[]> {
  const { data } = await supabaseAdmin
    .from('presentation_items')
    .select('*, block:presentation_blocks(*)')
    .eq('presentation_id', id)
    .order('position', { ascending: true })
  return (data as PresentationItem[] | null) ?? []
}
