'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Search, Building2, X, Link2, Trash2, Plus, Star, Sparkles,
  ChevronRight, CircleCheck, CircleAlert,
} from 'lucide-react'
import type { Deal, Company, Contact } from '@/lib/supabase'
import { computeWeighted, stageInfo } from '@/lib/deals'
import { formatCurrency } from '@/lib/utils'
import { HEADER_BOX, BODY_BOX, rowCx, Th, TableScroll, StatusPill, type Tone } from '@/components/admin/list'
import { inp, lbl } from './form'

/* ────────────────────────────────────────────────────────────────────────────
   Companies — the account lens on the CRM (migration 062). Replaces the old
   CRM tab: one row per company with deal/contact rollups, a slide-over drawer
   for editing (fields, contacts, merge, delete), and the "Review & link"
   panel that drives the two-phase free-text → relational backfill (a human
   confirms every cluster before anything is written).

   Data flows: this view calls the companies/contacts API directly, then syncs
   the parent's lifted state through the ops callbacks — the parent stays the
   single source of truth the other five tabs read.
   ──────────────────────────────────────────────────────────────────────────── */

const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[2fr_80px_80px_110px_110px_90px]'

export const KIND_TONE: Record<Company['kind'], Tone> = {
  prospect: 'sky', customer: 'emerald', rep_firm: 'violet', other: 'slate',
}
export const KIND_LABEL: Record<Company['kind'], string> = {
  prospect: 'Prospect', customer: 'Customer', rep_firm: 'Rep firm', other: 'Other',
}

export type CompanyOps = {
  /** Wholesale swap after a backfill commit (deals included). */
  onGraph: (companies: Company[], contacts: Contact[], deals: Deal[]) => void
  onCompanyUpsert: (c: Company) => void
  /** Rename landed server-side — cascade the display cache locally too. */
  onCompanyRenamed: (id: string, name: string) => void
  onCompanyRemoved: (id: string) => void
  onMerged: (sourceId: string, targetId: string, targetName: string) => void
  onContactUpsert: (k: Contact) => void
  onContactRemoved: (id: string) => void
}

type BackfillCluster = {
  canonical: string
  normalized: string
  members: string[]
  dealCount: number
  totalCost: number
  repContacts: string[]
  existingCompanyId: string | null
  existingName: string | null
}
type BackfillSuggestion = { a: number; b: number; reason: 'typo' | 'subset' }

export default function CompaniesView({
  deals, companies, contacts, ops, onView,
}: {
  deals: Deal[]
  companies: Company[]
  contacts: Contact[]
  ops: CompanyOps
  onView: (id: string, orderedIds: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)

  const rollups = useMemo(() => {
    const map = new Map<string, { deals: Deal[]; open: number; weighted: number; won: number }>()
    for (const c of companies) map.set(c.id, { deals: [], open: 0, weighted: 0, won: 0 })
    for (const d of deals) {
      if (!d.company_id) continue
      const r = map.get(d.company_id)
      if (!r) continue
      r.deals.push(d)
      if (d.status === null) { r.open += d.total_cost; r.weighted += computeWeighted(d) }
      else if (d.status === 'Won') r.won += d.total_cost
    }
    return map
  }, [companies, deals])

  const contactsByCompany = useMemo(() => {
    const map = new Map<string, Contact[]>()
    for (const k of contacts) {
      const list = map.get(k.company_id) ?? []
      list.push(k)
      map.set(k.company_id, list)
    }
    return map
  }, [contacts])

  const unlinkedCount = useMemo(() => deals.filter((d) => !d.company_id).length, [deals])

  const q = search.trim().toLowerCase()
  const shown = useMemo(() => {
    const base = q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies
    return [...base].sort((a, b) => (rollups.get(b.id)?.weighted ?? 0) - (rollups.get(a.id)?.weighted ?? 0) || a.name.localeCompare(b.name))
  }, [companies, q, rollups])

  const drawer = drawerId ? companies.find((c) => c.id === drawerId) ?? null : null

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <Tile label="Companies" value={String(companies.length)} />
        <Tile label="Linked deals" value={String(deals.length - unlinkedCount)} />
        <Tile label="Unlinked deals" value={String(unlinkedCount)} warn={unlinkedCount > 0} />
        <Tile label="Contacts" value={String(contacts.length)} />
      </div>

      {err && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
          {err}
          <button onClick={() => setErr(null)} className="text-rose-400 hover:text-rose-600 flex-shrink-0"><X size={13} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className={`${inp} pl-8 w-[220px]`}
          />
        </div>
        <button
          onClick={() => setShowReview(true)}
          className="ml-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12.5px] font-medium border border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-soft transition-colors"
        >
          <Sparkles size={13} />
          Review &amp; link
          {unlinkedCount > 0 && (
            <span className="text-[10.5px] font-semibold tabular-nums px-1.5 py-[1px] rounded bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              {unlinkedCount}
            </span>
          )}
        </button>
      </div>

      {/* Table */}
      <TableScroll minWidth={760}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <Th>Company</Th>
          <Th align="right">Contacts</Th>
          <Th align="right">Deals</Th>
          <Th align="right">Open</Th>
          <Th align="right">Weighted</Th>
          <Th align="right">Won</Th>
        </div>
        <div className={BODY_BOX}>
          {shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12.5px] text-ink-faint">
              {companies.length === 0
                ? 'No companies yet — run "Review & link" to build them from the existing deals.'
                : 'No companies match that search.'}
            </p>
          ) : (
            shown.map((c, i) => {
              const r = rollups.get(c.id)
              const ks = contactsByCompany.get(c.id) ?? []
              return (
                <div key={c.id} className={`${rowCx(COLS, { i })} cursor-pointer`} onClick={() => setDrawerId(c.id)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-surface-strong flex items-center justify-center flex-shrink-0 text-ink-muted">
                      <Building2 size={13} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">
                        {c.name}
                        {c.customer_id && <Link2 size={11} className="inline ml-1.5 -mt-0.5 text-emerald-500" aria-label="Linked to portal customer" />}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <StatusPill tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</StatusPill>
                        {c.location && <span className="text-[10.5px] text-ink-faint truncate">{c.location}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right tabular-nums text-ink-muted">{ks.length || '—'}</div>
                  <div className="text-right tabular-nums text-ink-secondary">{r?.deals.length ?? 0}</div>
                  <div className="text-right tabular-nums text-ink-secondary">{r?.open ? formatCurrency(r.open) : '—'}</div>
                  <div className="hidden sm:block text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{r?.weighted ? formatCurrency(r.weighted) : '—'}</div>
                  <div className="hidden sm:block text-right tabular-nums text-ink-muted">{r?.won ? formatCurrency(r.won) : '—'}</div>
                </div>
              )
            })
          )}
        </div>
      </TableScroll>

      {drawer && (
        <CompanyDrawer
          key={drawer.id}
          company={drawer}
          companies={companies}
          contacts={contactsByCompany.get(drawer.id) ?? []}
          deals={rollups.get(drawer.id)?.deals ?? []}
          ops={ops}
          onView={onView}
          onError={setErr}
          onClose={() => setDrawerId(null)}
        />
      )}

      {showReview && (
        <ReviewPanel
          unlinkedCount={unlinkedCount}
          ops={ops}
          onError={setErr}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  )
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3.5 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1">{label}</p>
      <p className={`text-[17px] font-semibold tabular-nums leading-none ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

/* ── Drawer ─────────────────────────────────────────────────────────────────── */

function CompanyDrawer({
  company, companies, contacts, deals, ops, onView, onError, onClose,
}: {
  company: Company
  companies: Company[]
  contacts: Contact[]
  deals: Deal[]
  ops: CompanyOps
  onView: (id: string, orderedIds: string[]) => void
  onError: (msg: string) => void
  onClose: () => void
}) {
  const [mergeTarget, setMergeTarget] = useState('')
  const [newContact, setNewContact] = useState({ name: '', title: '', email: '', phone: '' })
  const [addingContact, setAddingContact] = useState(false)

  const patchCompany = async (patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/deals/companies/${company.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { onError(j.error || 'Could not save that change.'); return }
      ops.onCompanyUpsert(j.company as Company)
      if (patch.name !== undefined) ops.onCompanyRenamed(company.id, (j.company as Company).name)
    } catch { onError('Network error — that change was not saved.') }
  }

  const saveField = (field: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value.trim()
    const cur = (company as unknown as Record<string, unknown>)[field] ?? ''
    if (v === cur || (v === '' && cur === null)) return
    if (field === 'name' && !v) return // never blank the name
    patchCompany({ [field]: v || null })
  }

  const addContact = async () => {
    if (!newContact.name.trim() || addingContact) return
    setAddingContact(true)
    try {
      const res = await fetch('/api/admin/deals/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, ...newContact }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { onError(j.error || 'Could not add that contact.'); return }
      ops.onContactUpsert(j.contact as Contact)
      setNewContact({ name: '', title: '', email: '', phone: '' })
    } catch { onError('Network error — the contact was not saved.') }
    finally { setAddingContact(false) }
  }

  const removeContact = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/deals/contacts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      ops.onContactRemoved(id)
    } catch { onError('Could not delete that contact.') }
  }

  const togglePrimary = async (k: Contact) => {
    try {
      const res = await fetch(`/api/admin/deals/contacts/${k.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: !k.is_primary }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error()
      ops.onContactUpsert(j.contact as Contact)
    } catch { onError('Could not update that contact.') }
  }

  const merge = async () => {
    if (!mergeTarget) return
    const target = companies.find((c) => c.id === mergeTarget)
    if (!target) return
    if (!confirm(`Merge "${company.name}" into "${target.name}"? Its ${deals.length} deal${deals.length === 1 ? '' : 's'} and ${contacts.length} contact${contacts.length === 1 ? '' : 's'} move over, then "${company.name}" is deleted.`)) return
    try {
      const res = await fetch(`/api/admin/deals/companies/${company.id}/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ into: target.id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { onError(j.error || 'Merge failed.'); return }
      ops.onMerged(company.id, target.id, target.name)
      onClose()
    } catch { onError('Network error — merge not applied.') }
  }

  const remove = async () => {
    if (!confirm(`Delete "${company.name}"? Deals keep their text name but lose the link; contacts are removed.`)) return
    try {
      const res = await fetch(`/api/admin/deals/companies/${company.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      ops.onCompanyRemoved(company.id)
      onClose()
    } catch { onError('Could not delete that company.') }
  }

  const dealIds = deals.map((d) => d.id)

  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-hairline overflow-y-auto animate-fade-up"
        style={{ boxShadow: '-8px 0 24px rgba(31,30,27,.08)' }}
      >
        {/* Head */}
        <div className="sticky top-0 z-10 bg-surface border-b border-hairline-soft px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-ink-muted flex-shrink-0" />
              <input
                defaultValue={company.name}
                onBlur={saveField('name')}
                className="text-[15px] font-semibold text-ink bg-transparent outline-none border-b border-transparent focus:border-hairline-strong min-w-0 w-full"
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={company.kind}
                onChange={(e) => patchCompany({ kind: e.target.value })}
                className="text-[10.5px] font-semibold uppercase tracking-wider rounded-md px-1.5 py-[3px] bg-surface-strong text-ink-muted border-0 outline-none cursor-pointer"
              >
                {(Object.keys(KIND_LABEL) as Company['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              {company.customer_id && (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400">
                  <Link2 size={10} /> Portal customer
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Location</label><input className={inp} defaultValue={company.location ?? ''} onBlur={saveField('location')} /></div>
            <div><label className={lbl}>Phone</label><input className={inp} defaultValue={company.phone ?? ''} onBlur={saveField('phone')} /></div>
            <div className="col-span-2"><label className={lbl}>Website</label><input className={inp} defaultValue={company.website ?? ''} onBlur={saveField('website')} /></div>
            <div className="col-span-2"><label className={lbl}>Notes</label><textarea className={inp} rows={2} defaultValue={company.notes ?? ''} onBlur={saveField('notes')} /></div>
          </div>

          {/* Contacts */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-2">Contacts ({contacts.length})</p>
            <div className="rounded-xl border border-hairline overflow-hidden">
              {contacts.map((k) => (
                <div key={k.id} className="flex items-center gap-2.5 px-3 py-2 border-t border-hairline-soft first:border-t-0">
                  <button onClick={() => togglePrimary(k)} title={k.is_primary ? 'Primary contact' : 'Make primary'} className="flex-shrink-0">
                    <Star size={12} className={k.is_primary ? 'fill-amber-400 text-amber-400' : 'text-ink-faint hover:text-amber-400 transition-colors'} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-ink truncate">{k.name}{k.title ? <span className="text-ink-faint"> · {k.title}</span> : null}</p>
                    {(k.email || k.phone) && <p className="text-[10.5px] text-ink-faint truncate tabular-nums">{[k.email, k.phone].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <button onClick={() => removeContact(k.id)} title="Delete contact" className="w-6 h-6 rounded-md flex items-center justify-center text-ink-faint hover:text-rose-500 hover:bg-surface-soft transition-colors flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-hairline-soft first:border-t-0 bg-surface-soft">
                <input className={`${inp} flex-1`} placeholder="Name" value={newContact.name} onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addContact() }} />
                <input className={`${inp} w-[104px]`} placeholder="Email" value={newContact.email} onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addContact() }} />
                <button onClick={addContact} disabled={!newContact.name.trim() || addingContact} title="Add contact" className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-colors flex-shrink-0" style={{ backgroundColor: 'var(--brand)' }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Deals */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-2">Deals ({deals.length})</p>
            {deals.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-surface-soft px-3 py-3 text-[12px] text-ink-faint">No deals linked yet.</p>
            ) : (
              <div className="rounded-xl border border-hairline overflow-hidden">
                {[...deals].sort((a, b) => b.total_cost - a.total_cost).map((d) => {
                  const st = stageInfo(d.stage)
                  return (
                    <button
                      key={d.id}
                      onClick={() => onView(d.id, dealIds)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-t border-hairline-soft first:border-t-0 hover:bg-surface-soft transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-ink truncate">{d.job_name || d.unit_model || d.customer}</p>
                        <p className="text-[10.5px] text-ink-faint tabular-nums">{d.group_name}{d.assigned_to ? ` · ${d.assigned_to}` : ''}</p>
                      </div>
                      <span className="text-[12px] tabular-nums text-ink-secondary flex-shrink-0">{formatCurrency(d.total_cost)}</span>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      <ChevronRight size={13} className="text-ink-faint flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-hairline bg-surface-soft p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className={`${inp} flex-1`}>
                <option value="">Merge into…</option>
                {companies.filter((c) => c.id !== company.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={merge} disabled={!mergeTarget} className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft disabled:opacity-40 transition-colors">
                Merge
              </button>
            </div>
            <button onClick={remove} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-faint hover:text-rose-500 transition-colors">
              <Trash2 size={12} /> Delete company
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Review & link panel (two-phase backfill) ──────────────────────────────── */

type EditableCluster = BackfillCluster & { include: boolean; name: string; absorbedInto: number | null }

function ReviewPanel({
  unlinkedCount, ops, onError, onClose,
}: {
  unlinkedCount: number
  ops: CompanyOps
  onError: (msg: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'committing' | 'done'>('loading')
  const [clusters, setClusters] = useState<EditableCluster[]>([])
  const [suggestions, setSuggestions] = useState<BackfillSuggestion[]>([])
  const [stats, setStats] = useState<{ companiesCreated: number; companiesReused: number; dealsLinked: number; contactsCreated: number; primariesSet: number } | null>(null)
  const [loadError, setLoadError] = useState('')

  // Dry-run on mount.
  useEffect(() => {
    let alive = true
    fetch('/api/admin/deals/companies/backfill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commit: false }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j.error) { setLoadError(j.error); return }
        setClusters((j.clusters as BackfillCluster[]).map((c) => ({ ...c, include: true, name: c.existingName ?? c.canonical, absorbedInto: null })))
        setSuggestions(j.suggestions as BackfillSuggestion[])
        setPhase('review')
      })
      .catch(() => { if (alive) setLoadError('Could not load the proposal — check your connection and retry.') })
    return () => { alive = false }
  }, [])

  const combine = (a: number, b: number) => {
    setClusters((prev) => {
      const next = [...prev]
      // Fold b into a (a keeps its name); anything already absorbed into b follows.
      next[a] = {
        ...next[a],
        members: [...next[a].members, ...next[b].members],
        dealCount: next[a].dealCount + next[b].dealCount,
        totalCost: next[a].totalCost + next[b].totalCost,
        repContacts: [...new Set([...next[a].repContacts, ...next[b].repContacts])],
      }
      next[b] = { ...next[b], absorbedInto: a, include: false }
      return next
    })
    setSuggestions((prev) => prev.filter((s) => s.a !== b && s.b !== b))
  }

  const commit = async () => {
    setPhase('committing')
    const payload = clusters
      .filter((c) => c.include && c.absorbedInto === null && c.name.trim())
      .map((c) => ({ name: c.name.trim(), members: c.members }))
    try {
      const res = await fetch('/api/admin/deals/companies/backfill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit: true, clusters: payload }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { onError(j.error || 'Backfill failed.'); setPhase('review'); return }
      ops.onGraph(j.companies, j.contacts, j.deals)
      setStats(j.stats)
      setPhase('done')
    } catch {
      onError('Network error — nothing was written.')
      setPhase('review')
    }
  }

  const active = clusters.filter((c) => c.include && c.absorbedInto === null)
  const activeDeals = active.reduce((a, c) => a + c.dealCount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={phase === 'committing' ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl border border-hairline bg-surface max-h-[88vh] overflow-y-auto animate-fade-up"
        style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-hairline-soft px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Review &amp; link companies</h2>
            <p className="text-[11.5px] text-ink-muted mt-0.5">
              {phase === 'done'
                ? 'Done — the graph is linked.'
                : `${unlinkedCount} unlinked deal${unlinkedCount === 1 ? '' : 's'} → grouped below. Nothing is written until you commit.`}
            </p>
          </div>
          <button onClick={onClose} disabled={phase === 'committing'} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {phase === 'loading' && !loadError && <p className="py-8 text-center text-[12.5px] text-ink-faint">Clustering deal names…</p>}
          {loadError && <p className="py-6 text-center text-[12.5px] text-rose-500">{loadError}</p>}

          {phase === 'done' && stats && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-[12.5px] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
              <CircleCheck size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                Linked <b>{stats.dealsLinked}</b> deals into <b>{stats.companiesCreated}</b> new + <b>{stats.companiesReused}</b> existing companies,
                seeded <b>{stats.contactsCreated}</b> contacts, set <b>{stats.primariesSet}</b> primary contacts.
              </span>
            </div>
          )}

          {(phase === 'review' || phase === 'committing') && (
            <>
              {/* Possible duplicates */}
              {suggestions.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-400 mb-2">
                    <CircleAlert size={12} /> Possible duplicates — combine only if they're truly the same account
                  </p>
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => {
                      const a = clusters[s.a]; const b = clusters[s.b]
                      if (!a || !b || a.absorbedInto !== null || b.absorbedInto !== null) return null
                      return (
                        <div key={i} className="flex items-center gap-2 text-[12px] text-ink-secondary">
                          <span className="truncate">"{a.name}" ({a.dealCount})</span>
                          <span className="text-ink-faint">~</span>
                          <span className="truncate">"{b.name}" ({b.dealCount})</span>
                          <span className="text-[10px] text-ink-faint uppercase">{s.reason}</span>
                          <button
                            onClick={() => combine(s.a, s.b)}
                            className="ml-auto h-6 px-2 rounded-md text-[11px] font-medium border border-hairline text-ink-secondary hover:bg-surface-soft transition-colors flex-shrink-0"
                          >
                            Combine
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Clusters */}
              <div className="rounded-xl border border-hairline overflow-hidden">
                {clusters.map((c, i) => {
                  if (c.absorbedInto !== null) return null
                  return (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 border-t border-hairline-soft first:border-t-0 ${c.include ? '' : 'opacity-45'}`}>
                      <input
                        type="checkbox"
                        checked={c.include}
                        onChange={(e) => setClusters((prev) => prev.map((x, xi) => (xi === i ? { ...x, include: e.target.checked } : x)))}
                        className="accent-emerald-600 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <input
                          value={c.name}
                          onChange={(e) => setClusters((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))}
                          className="w-full text-[12.5px] font-medium text-ink bg-transparent outline-none border-b border-transparent focus:border-hairline-strong"
                        />
                        {(c.members.length > 1 || c.existingCompanyId) && (
                          <p className="text-[10.5px] text-ink-faint truncate">
                            {c.existingCompanyId ? 'links to existing company · ' : ''}
                            {c.members.length > 1 ? c.members.join(' | ') : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] tabular-nums text-ink-muted flex-shrink-0">{c.dealCount} deal{c.dealCount === 1 ? '' : 's'}</span>
                      <span className="text-[11px] tabular-nums text-ink-secondary flex-shrink-0 w-[76px] text-right">{formatCurrency(c.totalCost)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {(phase === 'review' || phase === 'committing') && (
          <div className="sticky bottom-0 bg-surface border-t border-hairline-soft px-5 py-3.5 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-ink-muted tabular-nums">
              {active.length} companies · {activeDeals} deals will link
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={phase === 'committing'} className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors">
                Cancel
              </button>
              <button
                onClick={commit}
                disabled={phase === 'committing' || active.length === 0}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {phase === 'committing' ? 'Linking…' : `Link ${activeDeals} deals`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
