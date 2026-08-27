export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'

/* The root layout's title ("IAT Self-Service") is wrong here — this page is
 * reached by scanning a sticker, so the browser tab and any share preview should
 * say what it is. `noindex` because the URL contains the credential: a crawler
 * that reached one must never put it in a search result. */
export const metadata: Metadata = {
  title: 'Post-production walkaround · IAT',
  robots: { index: false, follow: false },
}

import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isTranscriptionConfigured } from '@/lib/transcribe'
import type { PpFinding, PpTag, PpWalkaround } from '@/lib/post-production'
import ScanWalkClient from './ScanWalkClient'

/* /walk/<token> — the shop-floor walkaround. NO LOGIN.
 *
 * The meeting this feature came from was about four perspectives on a built
 * unit: the engineer, the person who built it, the electrician who wired it,
 * the person who tested it. Three of those four have no portal account and are
 * not getting one, so the unit gets a QR sticker instead.
 *
 * ⚠️ THIS PAGE IS OUTSIDE THE AUTH GATE, and that is deliberate rather than an
 * oversight. middleware.ts's matcher is an ALLOWLIST — '/admin', '/employee',
 * '/customer', '/tools', '/tool-crib', '/t', '/login', '/home' — and '/walk' is
 * deliberately absent, exactly like '/board'. Adding it would gate this page and
 * silently break every printed sticker in the shop.
 *
 * ⚠️ Everything on this page is visible to anyone holding the link. Keep it to
 * shop work: the tag label, the unit number, the floor roster, and what the
 * person standing there types. Nothing here shows pricing, contacts, or any
 * other unit's findings.
 */
export default async function ScanWalkPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Resolved server-side with the service role. The token is never handed to a
  // client query, and a bad token is a plain 404 — never a message that confirms
  // which tokens are real.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound()

  const { data: tag } = await supabaseAdmin
    .from('pp_tags')
    .select('id, token, label, job_number, is_active, notes, created_at, updated_at')
    .eq('token', token)
    .maybeSingle()

  if (!tag || !tag.is_active) notFound()

  // The unit's details, when the sticker names a job we know about. Customer
  // name is shown because the scanner is standing in our shop holding our
  // sticker — the same trust boundary the production board already accepts.
  const { data: job } = tag.job_number
    ? await supabaseAdmin
        .from('eng_jobs')
        .select('customer_name, model_number, project_name')
        .eq('job_number', tag.job_number)
        .maybeSingle()
    : { data: null }

  /* The "who are you?" roster.
   *
   * ⚠️ production_people, NOT employees. Migration 055 created that table for
   * exactly this reason and says so at length: `employees` is portal accounts,
   * and per lib/staff.ts every CUSTOMER INVITE adds a row to it. Listing it on
   * an unauthenticated page would put customer names on a sticker-gated screen.
   * These are names on a list, they prove nothing, and they are not an auth
   * boundary — the picker exists so nobody has to type on a phone in a loud room.
   *
   * Names only. No emails, no departments beyond the grouping label, nothing
   * that would be worth harvesting. An empty roster is fine: the page falls back
   * to a plain text field. */
  const { data: roster } = await supabaseAdmin
    .from('production_people')
    .select('name, department:production_departments(name)')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const people = [...new Set(
    (roster ?? [])
      .map(r => String(r.name ?? '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b))

  /* Walks left open on this tag, with their drafts.
   *
   * ⚠️ SEVERAL, not one, and the client picks — because a standing tag on the
   * test bay wall is scanned by different people all week. Auto-resuming "the
   * most recent open walk" would drop the electrician into the tester's
   * half-finished walk and file his observations under her name. The device
   * remembers which one is its own; anything else is offered as an explicit
   * "somebody has one open" choice.
   *
   * Capped at five: more than that on one sticker means walks are being
   * abandoned rather than handed over, which is worth seeing rather than
   * scrolling. */
  const { data: open } = await supabaseAdmin
    .from('pp_walkarounds')
    .select('*')
    .eq('tag_id', tag.id)
    .eq('status', 'walking')
    .order('started_at', { ascending: false })
    .limit(5)

  const walks = (open ?? []) as PpWalkaround[]
  const ids = walks.map(w => w.id)

  const { data: drafts } = ids.length
    ? await supabaseAdmin
        .from('pp_findings')
        .select('*')
        .in('walkaround_id', ids)
        .eq('status', 'draft')
        .order('seq', { ascending: true })
    : { data: [] }

  const byWalk = new Map<string, PpFinding[]>()
  for (const f of (drafts ?? []) as PpFinding[]) {
    const clean = { ...f, media: Array.isArray(f.media) ? f.media : [] }
    byWalk.set(f.walkaround_id, [...(byWalk.get(f.walkaround_id) ?? []), clean])
  }

  return (
    <ScanWalkClient
      tag={tag as PpTag}
      job={job ?? null}
      people={people}
      openWalks={walks.map(w => ({ walk: w, findings: byWalk.get(w.id) ?? [] }))}
      transcriptionConfigured={isTranscriptionConfigured()}
    />
  )
}
