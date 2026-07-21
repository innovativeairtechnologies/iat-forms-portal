import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { normalizeCompany, clusterNames } from '@/lib/crm-normalize'

export const runtime = 'nodejs'

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/admin/deals/companies/backfill — free-text → relational, with a
   human in the loop. Two phases, mirroring the xlsx importer's shape:

   { commit: false }
     Cluster every UNLINKED deal's customer string (lib/crm-normalize —
     exact-normalized grouping only) and return the proposed clusters plus
     conservative merge suggestions. Nothing is written.

   { commit: true, clusters: [{ name, members: string[] }] }
     Write the HUMAN-EDITED cluster list: find-or-create each company by
     normalized name, link every unlinked deal whose raw customer string is in
     `members` (customer becomes the company's display name; a trailing
     parenthetical hint like "(MBI Battery)" moves into an empty job_name so
     nothing is lost), seed contacts from rep_contact, and set
     primary_contact_id where it matched. Idempotent: re-committing finds the
     companies, skips already-linked deals, and dedupes contacts by name.

   This doubles as the ONGOING "link these" tool: after the initial backfill,
   deals imported from a legacy xlsx (or created by raw API callers) with no
   company simply show up in the next dry run.
   ──────────────────────────────────────────────────────────────────────────── */

type UnlinkedDeal = {
  id: string
  customer: string
  rep: string | null
  rep_contact: string | null
  job_name: string | null
  total_cost: number
  primary_contact_id: string | null
}

export async function POST(req: NextRequest) {
  const err = await requireCrmAuth(); if (err) return err
  const body = await req.json().catch(() => ({}))
  const commit = body.commit === true

  const { data: unlinkedRaw, error: dErr } = await supabaseAdmin
    .from('deals')
    .select('id, customer, rep, rep_contact, job_name, total_cost, primary_contact_id')
    .is('company_id', null)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  const unlinked = (unlinkedRaw ?? []) as UnlinkedDeal[]

  const { data: companiesRaw, error: cErr } = await supabaseAdmin
    .from('companies').select('id, name, normalized_name')
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  const companyByNorm = new Map((companiesRaw ?? []).map((c) => [c.normalized_name as string, c]))

  // ── Dry run ──────────────────────────────────────────────────────────────
  if (!commit) {
    const { clusters, suggestions } = clusterNames(unlinked.map((d) => d.customer))
    const enriched = clusters.map((c) => {
      const memberSet = new Set(c.members)
      const deals = unlinked.filter((d) => memberSet.has(d.customer.trim()))
      const existing = companyByNorm.get(c.normalized)
      return {
        canonical: c.canonical,
        normalized: c.normalized,
        members: c.members,
        dealCount: deals.length,
        totalCost: deals.reduce((a, d) => a + d.total_cost, 0),
        repContacts: [...new Set(deals.map((d) => d.rep_contact).filter(Boolean))] as string[],
        existingCompanyId: existing?.id ?? null,
        existingName: existing?.name ?? null,
      }
    })
    return NextResponse.json({ ok: true, dryRun: true, clusters: enriched, suggestions, unlinkedDeals: unlinked.length })
  }

  // ── Commit ───────────────────────────────────────────────────────────────
  const submitted = Array.isArray(body.clusters) ? body.clusters : null
  if (!submitted) return NextResponse.json({ error: 'commit needs a clusters array.' }, { status: 400 })
  for (const c of submitted) {
    if (typeof c?.name !== 'string' || !c.name.trim() || !Array.isArray(c.members) || c.members.some((m: unknown) => typeof m !== 'string')) {
      return NextResponse.json({ error: 'Each cluster needs a non-empty name and a members string array.' }, { status: 400 })
    }
  }

  const stats = { companiesCreated: 0, companiesReused: 0, dealsLinked: 0, contactsCreated: 0, primariesSet: 0 }

  for (const cluster of submitted as { name: string; members: string[] }[]) {
    const name = cluster.name.trim()
    const { normalized } = normalizeCompany(name)

    // Find-or-create the company (race-tolerant via the unique index).
    let company = companyByNorm.get(normalized) as { id: string; name: string } | undefined
    if (!company) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from('companies').insert({ name, normalized_name: normalized }).select('id, name, normalized_name').single()
      if (insErr) {
        const { data: raced } = await supabaseAdmin
          .from('companies').select('id, name, normalized_name').eq('normalized_name', normalized).maybeSingle()
        if (!raced) return NextResponse.json({ error: `Could not create "${name}": ${insErr.message}` }, { status: 500 })
        company = raced
        companyByNorm.set(normalized, raced)
        stats.companiesReused++
      } else {
        company = created
        companyByNorm.set(normalized, created)
        stats.companiesCreated++
      }
    } else {
      stats.companiesReused++
    }

    const memberSet = new Set(cluster.members.map((m) => m.trim()))
    const deals = unlinked.filter((d) => memberSet.has(d.customer.trim()))
    if (deals.length === 0) continue

    // Group deals by identical update payload so most of a cluster links in
    // one UPDATE ... IN (ids) instead of a round trip per deal.
    const byPayload = new Map<string, { patch: Record<string, unknown>; ids: string[] }>()
    for (const d of deals) {
      const { hint } = normalizeCompany(d.customer)
      const patch: Record<string, unknown> = { company_id: company.id, customer: company.name }
      if (hint && !d.job_name) patch.job_name = hint
      const key = JSON.stringify(patch)
      const g = byPayload.get(key) ?? { patch, ids: [] }
      g.ids.push(d.id)
      byPayload.set(key, g)
    }
    for (const { patch, ids } of byPayload.values()) {
      const { error } = await supabaseAdmin.from('deals').update(patch).in('id', ids)
      if (!error) stats.dealsLinked += ids.length
    }

    // Seed contacts from rep_contact (deduped by name per company), then set
    // primary_contact_id on the deals that named them.
    const wanted = new Map<string, { name: string; rep: string | null }>()
    for (const d of deals) {
      const rc = d.rep_contact?.trim()
      if (rc && !wanted.has(rc.toLowerCase())) wanted.set(rc.toLowerCase(), { name: rc, rep: d.rep })
    }
    if (wanted.size > 0) {
      const { data: existingContacts } = await supabaseAdmin
        .from('contacts').select('id, name').eq('company_id', company.id)
      const contactByName = new Map((existingContacts ?? []).map((k) => [String(k.name).trim().toLowerCase(), k.id as string]))
      for (const [key, w] of wanted) {
        if (contactByName.has(key)) continue
        const { data: created } = await supabaseAdmin
          .from('contacts')
          .insert({ company_id: company.id, name: w.name, notes: w.rep ? `Rep contact (via ${w.rep}) — from deals backfill` : 'From deals backfill' })
          .select('id')
          .single()
        if (created) { contactByName.set(key, created.id); stats.contactsCreated++ }
      }
      for (const d of deals) {
        const rc = d.rep_contact?.trim().toLowerCase()
        if (!rc || d.primary_contact_id) continue
        const contactId = contactByName.get(rc)
        if (!contactId) continue
        const { error } = await supabaseAdmin.from('deals').update({ primary_contact_id: contactId }).eq('id', d.id)
        if (!error) stats.primariesSet++
      }
    }
  }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'company.backfill',
    entityType: 'company',
    summary:
      `Linked ${stats.dealsLinked} deals into ${stats.companiesCreated} new + ${stats.companiesReused} existing companies` +
      ` (${stats.contactsCreated} contacts seeded, ${stats.primariesSet} primaries set)`,
    metadata: stats,
  })

  // Hand back the whole fresh graph so the client swaps state without refetching.
  const [{ data: companies }, { data: contacts }, { data: deals }] = await Promise.all([
    supabaseAdmin.from('companies').select('*').order('name'),
    supabaseAdmin.from('contacts').select('*').order('name'),
    supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false }),
  ])
  return NextResponse.json({ ok: true, stats, companies: companies ?? [], contacts: contacts ?? [], deals: deals ?? [] })
}
