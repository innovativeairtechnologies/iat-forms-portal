'use client'

// RepPanel — the 380px side panel on /admin/territories: Firms roster (+ firm
// detail with contacts, locations, territory chips, color swatch) and the flat
// Reps directory. Pure presentation + local form state; every mutation goes
// through the callbacks TerritoriesClient owns, so optimistic map updates and
// API writes stay in one place.

import { useMemo, useState } from 'react'
import {
  Plus, X, MapPin, Trash2, ChevronLeft, ChevronRight, Check, Building2, Crosshair, Loader2, Pencil,
  PanelRightClose,
} from 'lucide-react'
import type { Company, Contact, CompanyLocation, CompanyTerritory } from '@/lib/supabase'
import { ListSearch } from '@/components/admin/list-card'
import { MAP_PALETTE, SHARED_FILL, territoryLabel } from '@/lib/territories'
import { tabCx } from '@/components/admin/list'
import RepDetail from './RepDetail'
import type { MapMode } from './MapCanvas'

const INPUT_CX =
  'w-full h-8 px-2.5 text-[12.5px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors'
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover transition-colors disabled:opacity-50'
const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'
const SECTION_CX = 'text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint'

type Props = {
  companies: Company[]
  contacts: Contact[]
  locations: CompanyLocation[]
  territories: CompanyTerritory[]
  selectedId: string | null
  canEdit: boolean
  mode: MapMode
  placingId: string | null
  error: string | null
  onSelect: (id: string | null) => void
  onAddFirm: (fields: { name: string; phone?: string; website?: string; location?: string }) => Promise<string | null>
  onUpdateFirm: (id: string, patch: Partial<Pick<Company, 'name' | 'phone' | 'website' | 'location'>>) => Promise<string | null>
  onDeleteFirm: (id: string) => void
  onSetColor: (id: string, color: string) => void
  onAddContact: (companyId: string, fields: { name: string; title?: string; email?: string; phone?: string }) => Promise<string | null>
  onUpdateContact: (id: string, patch: Partial<Pick<Contact, 'name' | 'title' | 'email' | 'phone' | 'notes'>>) => Promise<string | null>
  onDeleteContact: (id: string) => void
  onAddLocation: (companyId: string, fields: { label?: string; city?: string; region?: string; country: 'US' | 'CA' }) => Promise<string | null>
  onDeleteLocation: (id: string) => void
  onStartPlace: (id: string) => void
  onStartPaint: () => void
  /** Frame this firm's whole footprint — map clicks no longer do this
   *  implicitly, so the detail view offers it explicitly. */
  onFitFirm: (id: string) => void
  onRemoveTerritory: (t: CompanyTerritory) => void
  onEditExclusivity: (t: CompanyTerritory, value: string) => void
  /** Collapse the floating panel. Lives in this header because the map's own
   *  toggle button sits in the corner the panel now covers. */
  onCollapse: () => void
}

export default function RepPanel(props: Props) {
  const { companies, contacts, locations, territories, selectedId, canEdit } = props
  const [tab, setTab] = useState<'firms' | 'reps'>('firms')
  const [search, setSearch] = useState('')
  const [addingFirm, setAddingFirm] = useState(false)
  // Which rep's floating record is open. Reps used to be dead text; clicking
  // one now opens the same Drawer pattern the deals board uses.
  const [repId, setRepId] = useState<string | null>(null)

  const selected = companies.find((c) => c.id === selectedId) ?? null
  // Resolved from the live list, so a rep deleted elsewhere closes the drawer
  // instead of stranding it on a stale copy.
  const openRep = repId ? contacts.find((k) => k.id === repId) ?? null : null

  const byCompany = useMemo(() => {
    const t = new Map<string, CompanyTerritory[]>()
    for (const row of territories) {
      const list = t.get(row.company_id) ?? []
      list.push(row)
      t.set(row.company_id, list)
    }
    const k = new Map<string, Contact[]>()
    for (const row of contacts) {
      const list = k.get(row.company_id) ?? []
      list.push(row)
      k.set(row.company_id, list)
    }
    const l = new Map<string, CompanyLocation[]>()
    for (const row of locations) {
      const list = l.get(row.company_id) ?? []
      list.push(row)
      l.set(row.company_id, list)
    }
    return { territories: t, contacts: k, locations: l }
  }, [territories, contacts, locations])

  const filteredFirms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (byCompany.contacts.get(c.id) ?? []).some((k) => k.name.toLowerCase().includes(q)) ||
        (byCompany.territories.get(c.id) ?? []).some((t) => territoryLabel(t.level, t.code).toLowerCase().includes(q)),
    )
  }, [companies, search, byCompany])

  const filteredReps = useMemo(() => {
    const q = search.trim().toLowerCase()
    const firmName = (id: string) => companies.find((c) => c.id === id)?.name ?? ''
    const all = contacts
      .map((k) => ({ contact: k, firm: firmName(k.company_id) }))
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name))
    if (!q) return all
    return all.filter(
      (r) => r.contact.name.toLowerCase().includes(q) || r.firm.toLowerCase().includes(q),
    )
  }, [contacts, companies, search])

  return (
    // absolute inset-0 (parent <aside> is positioned): keeps the tall list out
    // of page flow so it scrolls internally instead of growing the whole page.
    <div className="absolute inset-0 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-0 border-b border-hairline">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-ink-faint">Sales</p>
            <h1 className="text-[17px] font-semibold text-ink tracking-tight">Territories</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEdit && !selected && !openRep && (
              <button className={BTN_PRIMARY} onClick={() => setAddingFirm(true)}>
                <Plus size={14} /> Rep firm
              </button>
            )}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-soft transition-colors"
              title="Hide the list"
              onClick={props.onCollapse}
            >
              <PanelRightClose size={15} />
            </button>
          </div>
        </div>
        {!selected && !openRep && (
          <div className="flex items-center -mb-px">
            <button className={tabCx(tab === 'firms')} onClick={() => setTab('firms')}>
              Firms <span className="text-[11px] text-ink-faint tabular-nums">{companies.length}</span>
            </button>
            <button className={tabCx(tab === 'reps')} onClick={() => setTab('reps')}>
              Reps <span className="text-[11px] text-ink-faint tabular-nums">{contacts.length}</span>
            </button>
          </div>
        )}
      </div>

      {props.error && (
        <p className="flex-shrink-0 mx-4 mt-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">
          {props.error}
        </p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {openRep ? (
          <RepDetail
            key={openRep.id}
            rep={openRep}
            firm={companies.find((c) => c.id === openRep.company_id) ?? null}
            territories={byCompany.territories.get(openRep.company_id) ?? []}
            locations={byCompany.locations.get(openRep.company_id) ?? []}
            firmRepCount={(byCompany.contacts.get(openRep.company_id) ?? []).length}
            canEdit={canEdit}
            /* Drilling in from a firm returns to that firm, not the roster —
               `selected` survives underneath, so name where back actually goes. */
            backLabel={selected ? selected.name : 'All reps'}
            onBack={() => setRepId(null)}
            onUpdateContact={props.onUpdateContact}
            onDeleteContact={props.onDeleteContact}
            onFitFirm={props.onFitFirm}
            onSelectFirm={(id) => { setRepId(null); props.onSelect(id) }}
          />
        ) : selected ? (
          <FirmDetail
            key={selected.id}
            {...props}
            firm={selected}
            contacts={byCompany.contacts.get(selected.id) ?? []}
            locations={byCompany.locations.get(selected.id) ?? []}
            territories={byCompany.territories.get(selected.id) ?? []}
            onOpenRep={setRepId}
          />
        ) : addingFirm ? (
          <AddFirmForm
            onCancel={() => setAddingFirm(false)}
            onSubmit={async (fields) => {
              const err = await props.onAddFirm(fields)
              if (!err) setAddingFirm(false)
              return err
            }}
          />
        ) : (
          <>
            <div className="px-4 py-3">
              {/* width is px (ListSearch styles a fixed box) — 348 = panel 380 minus px-4 */}
              <ListSearch value={search} onChange={setSearch} placeholder={tab === 'firms' ? 'Search firms…' : 'Search reps…'} width={348} />
            </div>
            {tab === 'firms' ? (
              <ul>
                {filteredFirms.length === 0 && (
                  <li className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
                    {companies.length === 0 ? 'No rep firms yet — add the first one.' : 'No matches.'}
                  </li>
                )}
                {filteredFirms.map((c) => {
                  const terr = byCompany.territories.get(c.id) ?? []
                  const reps = byCompany.contacts.get(c.id) ?? []
                  const pins = (byCompany.locations.get(c.id) ?? []).filter((l) => l.lat != null && l.lng != null)
                  return (
                    <li key={c.id}>
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-t border-hairline-soft hover:bg-surface-soft transition-colors"
                        onClick={() => props.onSelect(c.id)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.map_color ?? SHARED_FILL }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink truncate">{c.name}</span>
                          <span className="block text-[11px] text-ink-faint truncate">
                            {terr.length} territor{terr.length === 1 ? 'y' : 'ies'} · {reps.length} rep{reps.length === 1 ? '' : 's'}
                            {pins.length > 0 && ` · ${pins.length} pin${pins.length === 1 ? '' : 's'}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul>
                {filteredReps.length === 0 && (
                  <li className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
                    {contacts.length === 0 ? 'No reps yet — add them from a firm.' : 'No matches.'}
                  </li>
                )}
                {filteredReps.map(({ contact: k, firm }) => (
                  <li key={k.id}>
                    <button
                      onClick={() => setRepId(k.id)}
                      className={`group w-full flex items-center gap-2 px-4 py-2.5 text-left border-t border-hairline-soft transition-colors ${
                        repId === k.id ? 'bg-brand-soft' : 'hover:bg-surface-soft'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink truncate">
                          {k.name}
                          {k.title && <span className="font-normal text-ink-faint"> · {k.title}</span>}
                        </span>
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                          <Building2 size={11} className="flex-shrink-0" />
                          <span className="truncate">{firm}</span>
                        </span>
                        <span className="block text-[11.5px] text-ink-faint truncate tabular-nums">
                          {k.email ?? '—'} · {k.phone ?? '—'}
                        </span>
                      </span>
                      <ChevronRight size={15} className="flex-shrink-0 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

    </div>
  )
}

// ── Add firm ──────────────────────────────────────────────────────────────────

function AddFirmForm({
  onSubmit, onCancel,
}: {
  onSubmit: (fields: { name: string; phone?: string; website?: string; location?: string }) => Promise<string | null>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="px-4 py-4 space-y-2.5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || busy) return
        setBusy(true)
        const err = await onSubmit({
          name: name.trim(),
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          location: location.trim() || undefined,
        })
        setBusy(false)
        setError(err)
      }}
    >
      <p className={SECTION_CX}>New rep firm</p>
      <input className={INPUT_CX} placeholder="Firm name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className={INPUT_CX} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className={INPUT_CX} placeholder="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <input className={INPUT_CX} placeholder="Location, e.g. Baton Rouge, LA (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
      {error && <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className={BTN_PRIMARY} disabled={!name.trim() || busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add firm
        </button>
        <button type="button" className={BTN_QUIET} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// ── Firm detail ───────────────────────────────────────────────────────────────

function FirmDetail({
  firm, contacts, locations, territories: firmTerritories,
  canEdit, mode, placingId,
  onSelect, onUpdateFirm, onDeleteFirm, onSetColor, onAddContact, onDeleteContact,
  onAddLocation, onDeleteLocation, onStartPlace, onStartPaint, onFitFirm,
  onRemoveTerritory, onEditExclusivity, onOpenRep,
}: Props & {
  firm: Company; contacts: Contact[]; locations: CompanyLocation[]; territories: CompanyTerritory[]
  onOpenRep: (id: string) => void
}) {
  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState({ name: firm.name, phone: firm.phone ?? '', website: firm.website ?? '', location: firm.location ?? '' })
  const [metaBusy, setMetaBusy] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [addingLocation, setAddingLocation] = useState(false)
  const [editingExcl, setEditingExcl] = useState<string | null>(null) // territory id
  const [exclDraft, setExclDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedTerritories = [...firmTerritories].sort((a, b) =>
    a.level === b.level ? a.code.localeCompare(b.code) : a.level.localeCompare(b.level))

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Back + identity */}
      <div>
        <button
          className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink transition-colors"
          onClick={() => onSelect(null)}
        >
          <ChevronLeft size={13} /> All firms
        </button>
        <div className="mt-1.5 flex items-start justify-between gap-2">
          {editingMeta ? (
            <input className={INPUT_CX} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
          ) : (
            <h2 className="text-[16px] font-semibold text-ink tracking-tight flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: firm.map_color ?? SHARED_FILL }} />
              <span className="truncate">{firm.name}</span>
            </h2>
          )}
          {canEdit && !editingMeta && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-soft transition-colors"
                title="Edit firm details"
                onClick={() => { setMeta({ name: firm.name, phone: firm.phone ?? '', website: firm.website ?? '', location: firm.location ?? '' }); setEditingMeta(true) }}
              >
                <Pencil size={13} />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors ${confirmDelete ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' : 'text-ink-faint hover:text-rose-500 hover:bg-surface-soft'}`}
                title={confirmDelete ? 'Click again to permanently delete this firm, its reps, pins and territories' : 'Delete firm'}
                onClick={() => (confirmDelete ? onDeleteFirm(firm.id) : setConfirmDelete(true))}
                onBlur={() => setConfirmDelete(false)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {editingMeta ? (
          <div className="mt-2 space-y-2">
            <input className={INPUT_CX} placeholder="Phone" value={meta.phone} onChange={(e) => setMeta({ ...meta, phone: e.target.value })} />
            <input className={INPUT_CX} placeholder="Website" value={meta.website} onChange={(e) => setMeta({ ...meta, website: e.target.value })} />
            <input className={INPUT_CX} placeholder="Location" value={meta.location} onChange={(e) => setMeta({ ...meta, location: e.target.value })} />
            {metaError && <p className="text-[12px] text-rose-600 dark:text-rose-400">{metaError}</p>}
            <div className="flex items-center gap-2">
              <button
                className={BTN_PRIMARY}
                disabled={metaBusy || !meta.name.trim()}
                onClick={async () => {
                  setMetaBusy(true)
                  const err = await onUpdateFirm(firm.id, {
                    name: meta.name.trim(),
                    phone: meta.phone.trim() || null,
                    website: meta.website.trim() || null,
                    location: meta.location.trim() || null,
                  })
                  setMetaBusy(false)
                  setMetaError(err)
                  if (!err) setEditingMeta(false)
                }}
              >
                {metaBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
              </button>
              <button className={BTN_QUIET} onClick={() => { setEditingMeta(false); setMetaError(null) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-[11.5px] text-ink-faint truncate">
            {[firm.phone, firm.website, firm.location].filter(Boolean).join(' · ') || 'No details yet'}
          </p>
        )}
      </div>

      {/* Color */}
      {canEdit && (
        <div>
          <p className={SECTION_CX}>Map color</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MAP_PALETTE.map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Set color ${c}`}
                className={`w-5 h-5 rounded-md transition-transform hover:scale-110 ${firm.map_color === c ? 'ring-2 ring-offset-1 ring-brand ring-offset-surface' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => onSetColor(firm.id, c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Territories */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className={SECTION_CX}>Territories ({sortedTerritories.length})</p>
          <span className="flex items-center gap-2.5">
            {sortedTerritories.length > 0 && (
              <button
                className="text-[11.5px] font-medium text-ink-muted hover:text-ink transition-colors"
                title="Zoom the map out to this firm's whole footprint"
                onClick={() => onFitFirm(firm.id)}
              >
                Show all
              </button>
            )}
            {canEdit && mode !== 'paint' && (
              <button className="text-[11.5px] font-medium text-brand hover:underline" onClick={onStartPaint}>
                Edit on map
              </button>
            )}
          </span>
        </div>
        {sortedTerritories.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-ink-faint">
            None yet{canEdit ? ' — “Edit on map”, then click states or counties.' : '.'}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {sortedTerritories.map((t) => (
              <li key={t.id} className="group rounded-lg border border-hairline bg-surface-soft px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-ink flex-1 truncate">
                    {territoryLabel(t.level, t.code)}
                    {t.level === 'county' && <span className="text-ink-faint font-normal"> · county</span>}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-faint hover:text-ink transition-all"
                        title="Exclusivity note"
                        onClick={() => { setEditingExcl(t.id); setExclDraft(t.exclusivity ?? '') }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-faint hover:text-rose-500 transition-all"
                        title="Remove territory"
                        onClick={() => onRemoveTerritory(t)}
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
                {editingExcl === t.id ? (
                  <form
                    className="mt-1 flex items-center gap-1.5"
                    onSubmit={(e) => { e.preventDefault(); onEditExclusivity(t, exclDraft.trim()); setEditingExcl(null) }}
                  >
                    <input
                      className={`${INPUT_CX} h-7`}
                      placeholder="Exclusive? e.g. yes, for food and bev"
                      value={exclDraft}
                      onChange={(e) => setExclDraft(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="p-1 rounded text-brand" title="Save"><Check size={13} /></button>
                  </form>
                ) : t.exclusivity ? (
                  <p className="mt-0.5 text-[11px] text-ink-faint">Exclusive: {t.exclusivity}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reps */}
      <div>
        <div className="flex items-center justify-between">
          <p className={SECTION_CX}>Reps ({contacts.length})</p>
          {canEdit && !addingContact && (
            <button className="text-[11.5px] font-medium text-brand hover:underline" onClick={() => setAddingContact(true)}>
              Add rep
            </button>
          )}
        </div>
        {addingContact && (
          <InlineForm
            fields={[
              { key: 'name', placeholder: 'Name', required: true },
              { key: 'title', placeholder: 'Title (optional)' },
              { key: 'email', placeholder: 'Email (optional)' },
              { key: 'phone', placeholder: 'Phone (optional)' },
            ]}
            submitLabel="Add rep"
            onCancel={() => setAddingContact(false)}
            onSubmit={async (v) => {
              const err = await onAddContact(firm.id, { name: v.name, title: v.title || undefined, email: v.email || undefined, phone: v.phone || undefined })
              if (!err) setAddingContact(false)
              return err
            }}
          />
        )}
        <ul className="mt-1.5 space-y-0.5">
          {contacts.map((k) => (
            <li key={k.id} className="group flex items-start gap-2 rounded-lg hover:bg-surface-soft transition-colors">
              <button
                className="min-w-0 flex-1 px-1.5 py-1.5 text-left"
                title={`Open ${k.name}`}
                onClick={() => onOpenRep(k.id)}
              >
                <span className="block text-[12.5px] font-medium text-ink truncate">
                  {k.name}
                  {k.title && <span className="font-normal text-ink-faint"> · {k.title}</span>}
                </span>
                <span className="block text-[11px] text-ink-faint truncate">{[k.email, k.phone].filter(Boolean).join(' · ') || '—'}</span>
              </button>
              {canEdit && (
                <button
                  className="opacity-0 group-hover:opacity-100 mt-1.5 p-1 rounded text-ink-faint hover:text-rose-500 transition-all flex-shrink-0"
                  title={`Remove ${k.name}`}
                  onClick={() => onDeleteContact(k.id)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Locations / pins */}
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <p className={SECTION_CX}>Locations ({locations.length})</p>
          {canEdit && !addingLocation && (
            <button className="text-[11.5px] font-medium text-brand hover:underline" onClick={() => setAddingLocation(true)}>
              Add location
            </button>
          )}
        </div>
        {addingLocation && (
          <InlineForm
            fields={[
              { key: 'label', placeholder: 'Label, e.g. HQ' },
              { key: 'city', placeholder: 'City' },
              { key: 'region', placeholder: 'State / province' },
            ]}
            selects={[{ key: 'country', options: ['US', 'CA'] }]}
            submitLabel="Add location"
            onCancel={() => setAddingLocation(false)}
            onSubmit={async (v) => {
              const err = await onAddLocation(firm.id, {
                label: v.label || undefined, city: v.city || undefined, region: v.region || undefined,
                country: (v.country as 'US' | 'CA') || 'US',
              })
              if (!err) setAddingLocation(false)
              return err
            }}
          />
        )}
        <ul className="mt-1.5 space-y-0.5">
          {locations.map((l) => {
            const placed = l.lat != null && l.lng != null
            const isPlacing = placingId === l.id && mode === 'place'
            return (
              <li key={l.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-soft transition-colors">
                <MapPin size={13} className={`flex-shrink-0 ${placed ? 'text-brand' : 'text-ink-faint'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink truncate">{l.label || l.city || 'Unnamed'}</p>
                  <p className="text-[11px] text-ink-faint truncate">
                    {[l.city, l.region, l.country].filter(Boolean).join(', ')}
                    {!placed && ' · not on map'}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      className={`p-1 rounded transition-all ${isPlacing ? 'text-brand' : 'opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink'}`}
                      title={placed ? 'Move on map' : 'Place on map'}
                      onClick={() => onStartPlace(l.id)}
                    >
                      <Crosshair size={12} />
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-faint hover:text-rose-500 transition-all"
                      title="Remove location"
                      onClick={() => onDeleteLocation(l.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ── Small inline add-form used for reps + locations ───────────────────────────

function InlineForm({
  fields, selects = [], submitLabel, onSubmit, onCancel,
}: {
  fields: { key: string; placeholder: string; required?: boolean }[]
  selects?: { key: string; options: string[] }[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<string | null>
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missingRequired = fields.some((f) => f.required && !(values[f.key] ?? '').trim())

  return (
    <form
      className="mt-1.5 space-y-1.5 rounded-lg border border-hairline bg-surface-soft p-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy || missingRequired) return
        setBusy(true)
        const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]))
        const err = await onSubmit(trimmed)
        setBusy(false)
        setError(err)
      }}
    >
      {fields.map((f, i) => (
        <input
          key={f.key}
          className={INPUT_CX}
          placeholder={f.placeholder}
          value={values[f.key] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          autoFocus={i === 0}
        />
      ))}
      {selects.map((s) => (
        <select
          key={s.key}
          className={INPUT_CX}
          value={values[s.key] ?? s.options[0]}
          onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
        >
          {s.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {error && <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex items-center gap-2 pt-0.5">
        <button type="submit" className={BTN_PRIMARY} disabled={busy || missingRequired}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {submitLabel}
        </button>
        <button type="button" className={BTN_QUIET} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
