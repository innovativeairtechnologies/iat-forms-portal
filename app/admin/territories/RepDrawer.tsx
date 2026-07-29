'use client'

/* ────────────────────────────────────────────────────────────────────────────
   RepDrawer — the floating record for one rep (a `contacts` row).

   Until now reps on /admin/territories were static text: three lines, no click
   target, no way in. Firms were the only selectable thing. This gives a rep the
   same "click it and the record floats in from the right" treatment the deals
   board has, sharing components/ui/Drawer + Tabs so the two read as one pattern.

   Tabs are scoped to data that actually exists for a contact — there is no
   per-rep activity table, so there is no Activity tab here; what a rep *has* is
   their own details, and their firm's footprint:

     Overview   — the rep's contact card (editable) + their firm
     Territories — the firm's assigned states/counties
     Locations  — the firm's pins
     Notes      — contacts.notes, the one free-text field on the row

   Writes go through the callbacks TerritoriesClient owns, matching how every
   other mutation on this page stays optimistic and in one place.
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import {
  X, Building2, Mail, Phone, MapPin, Trash2, Check, Loader2, Pencil, Crosshair, Star,
} from 'lucide-react'
import type { Company, Contact, CompanyLocation, CompanyTerritory } from '@/lib/supabase'
import { SHARED_FILL, territoryLabel } from '@/lib/territories'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/Drawer'
import { Tabs, type TabDef } from '@/components/ui/Tabs'

type TabKey = 'overview' | 'territories' | 'locations' | 'notes'

const INPUT_CX =
  'w-full h-8 px-2.5 text-[12.5px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors'
const SECTION_CX = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted'

export default function RepDrawer({
  rep, firm, territories, locations, firmRepCount, canEdit,
  onClose, onUpdateContact, onDeleteContact, onFitFirm, onSelectFirm,
}: {
  rep: Contact
  firm: Company | null
  territories: CompanyTerritory[]
  locations: CompanyLocation[]
  /** How many reps the firm has in total (this one included). */
  firmRepCount: number
  canEdit: boolean
  onClose: () => void
  onUpdateContact: (id: string, patch: Partial<Pick<Contact, 'name' | 'title' | 'email' | 'phone' | 'notes'>>) => Promise<string | null>
  onDeleteContact: (id: string) => void
  onFitFirm: (id: string) => void
  onSelectFirm: (id: string) => void
}) {
  const [tab, setTab] = useState<TabKey>('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: rep.name, title: rep.title ?? '', email: rep.email ?? '', phone: rep.phone ?? '',
  })
  const [notesDraft, setNotesDraft] = useState(rep.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset the buffers when the drawer is pointed at a DIFFERENT rep.
  //
  // Keyed on `rep.id` ONLY — deliberately, with the lint suppressed. A save
  // replaces the contact object in TerritoriesClient's state, so depending on
  // the mutable fields (name/title/email/phone/notes) made every successful save
  // re-run this reset: it snapped the user off the Notes tab back to Overview,
  // and could discard an unsaved notes draft when an unrelated field was saved.
  // (RepPanel also passes key={rep.id}, so this is belt-and-braces anyway.)
  useEffect(() => {
    setTab('overview')
    setEditing(false)
    setForm({ name: rep.name, title: rep.title ?? '', email: rep.email ?? '', phone: rep.phone ?? '' })
    setNotesDraft(rep.notes ?? '')
    setError(null)
    setConfirmDelete(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep.id])

  const sortedTerritories = [...territories].sort((a, b) =>
    a.level === b.level ? a.code.localeCompare(b.code) : a.level.localeCompare(b.level))
  const placedPins = locations.filter((l) => l.lat != null && l.lng != null)
  const notesDirty = notesDraft !== (rep.notes ?? '')

  const saveDetails = async () => {
    if (!form.name.trim() || busy) return
    setBusy(true)
    const err = await onUpdateContact(rep.id, {
      name: form.name.trim(),
      title: form.title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    })
    setBusy(false)
    setError(err)
    if (!err) setEditing(false)
  }

  const saveNotes = async () => {
    if (busy) return
    setBusy(true)
    const err = await onUpdateContact(rep.id, { notes: notesDraft.trim() || null })
    setBusy(false)
    setError(err)
  }

  const TABS: TabDef<TabKey>[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'territories', label: 'Territories', count: sortedTerritories.length || undefined },
    { key: 'locations', label: 'Locations', count: locations.length || undefined },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    // `dismissable` guards on the edit form only. It deliberately does NOT
    // guard on an unsaved notes draft: the header X and footer Close discard it
    // regardless, so blocking Esc/scrim-click protected nothing while silently
    // killing the two gestures users reach for first. The Notes tab carries an
    // "Unsaved" marker + Discard instead.
    <Drawer onClose={onClose} dismissable={!editing} width={440} labelledBy="rep-drawer-title">
      <DrawerHeader>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-md bg-surface-strong text-ink-muted">
            {rep.is_primary && <Star size={10} className="fill-amber-400 text-amber-400" />}
            {rep.is_primary ? 'Primary rep' : 'Rep'}
          </span>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <h2 id="rep-drawer-title" className="mt-2 text-[17px] font-semibold text-ink tracking-[-0.014em] break-words">
          {rep.name}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted truncate">
          {[rep.title, firm?.name].filter(Boolean).join(' · ') || 'No title yet'}
        </p>
      </DrawerHeader>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <DrawerBody>
        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {tab === 'overview' ? (
          <div className="space-y-5">
            {/* Stat strip — the firm footprint this rep sells into. */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile label="Territories" value={sortedTerritories.length} />
              <StatTile label="Pins" value={placedPins.length} />
              <StatTile label="Firm reps" value={firmRepCount} />
            </div>

            {/* Firm */}
            {firm && (
              <button
                onClick={() => onSelectFirm(firm.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-hairline bg-surface-soft px-3.5 py-3 text-left hover:border-hairline-strong transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-surface-strong flex items-center justify-center flex-shrink-0 text-ink-muted">
                  <Building2 size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${SECTION_CX}`}>Firm</span>
                  <span className="mt-0.5 flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: firm.map_color ?? SHARED_FILL }} />
                    <span className="block text-[13px] text-ink truncate">{firm.name}</span>
                  </span>
                </span>
              </button>
            )}

            {/* Contact card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={SECTION_CX}>Contact</span>
                {canEdit && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-2">
                  <input className={INPUT_CX} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                  <input className={INPUT_CX} placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <input className={INPUT_CX} placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={INPUT_CX} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              ) : (
                <div className="rounded-xl border border-hairline overflow-hidden">
                  <DetailRow icon={<Mail size={13} />} label="Email" value={rep.email} href={rep.email ? `mailto:${rep.email}` : null} />
                  <DetailRow icon={<Phone size={13} />} label="Phone" value={rep.phone} href={rep.phone ? `tel:${rep.phone}` : null} mono />
                  <DetailRow icon={<Building2 size={13} />} label="Title" value={rep.title} />
                </div>
              )}
            </div>
          </div>
        ) : tab === 'territories' ? (
          sortedTerritories.length === 0 ? (
            <EmptyState
              icon={<MapPin size={17} />}
              title="No territories yet"
              caption={firm ? `${firm.name} has no assigned states or counties.` : 'This rep has no firm.'}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className={SECTION_CX}>{firm?.name ?? 'Firm'} coverage</span>
                {firm && (
                  <button
                    onClick={() => onFitFirm(firm.id)}
                    className="text-[11.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
                    title="Zoom the map to this firm's whole footprint"
                  >
                    Show on map
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-hairline overflow-hidden">
                {sortedTerritories.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-hairline-soft first:border-t-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: firm?.map_color ?? SHARED_FILL }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink truncate">
                        {territoryLabel(t.level, t.code)}
                        {t.level === 'county' && <span className="font-normal text-ink-faint"> · county</span>}
                      </p>
                      {t.exclusivity && <p className="text-[11px] text-ink-faint truncate">Exclusive: {t.exclusivity}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : tab === 'locations' ? (
          locations.length === 0 ? (
            <EmptyState
              icon={<MapPin size={17} />}
              title="No locations yet"
              caption={firm ? `${firm.name} has no offices or sites on file.` : 'This rep has no firm.'}
            />
          ) : (
            <div className="rounded-xl border border-hairline overflow-hidden">
              {locations.map((l) => {
                const placed = l.lat != null && l.lng != null
                return (
                  <div key={l.id} className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-hairline-soft first:border-t-0">
                    <MapPin size={14} className={`flex-shrink-0 ${placed ? 'text-brand' : 'text-ink-faint'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink truncate">{l.label || l.city || 'Unnamed'}</p>
                      <p className="text-[11px] text-ink-faint truncate">
                        {[l.city, l.region, l.country].filter(Boolean).join(', ')}
                        {!placed && ' · not on map'}
                      </p>
                    </div>
                    {placed && <Crosshair size={12} className="text-ink-faint flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* ── Notes ── */
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={SECTION_CX}>Notes on {rep.name.split(' ')[0]}</span>
              {notesDirty && <span className="text-[11px] text-ink-faint">Unsaved</span>}
            </div>
            {canEdit ? (
              <>
                <textarea
                  rows={10}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="What should the team know about this rep? Strengths, accounts they own, how they like to be contacted…"
                  className={`${INPUT_CX} h-auto py-2.5 leading-relaxed resize-y`}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={!notesDirty || busy}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save notes
                  </button>
                  {notesDirty && (
                    <button
                      onClick={() => setNotesDraft(rep.notes ?? '')}
                      className="h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors"
                    >
                      Discard
                    </button>
                  )}
                </div>
              </>
            ) : rep.notes ? (
              <div className="rounded-xl border border-hairline bg-surface-soft px-3.5 py-3">
                <p className="text-[12.5px] text-ink-secondary whitespace-pre-wrap break-words leading-relaxed">{rep.notes}</p>
              </div>
            ) : (
              <EmptyState icon={<Pencil size={17} />} title="No notes yet" caption="Sales and admin can add notes about this rep." />
            )}
          </div>
        )}
      </DrawerBody>

      <DrawerFooter>
        {editing ? (
          <>
            <span className="text-[11px] text-ink-faint">Editing — changes apply when you save</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setForm({ name: rep.name, title: rep.title ?? '', email: rep.email ?? '', phone: rep.phone ?? '' })
                  setEditing(false); setError(null)
                }}
                className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveDetails}
                disabled={busy || !form.name.trim()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white bg-brand hover:bg-brand-hover active:scale-[.98] disabled:opacity-50 transition-all"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save changes
              </button>
            </div>
          </>
        ) : (
          <>
            {canEdit ? (
              <button
                onClick={() => (confirmDelete ? (onDeleteContact(rep.id), onClose()) : setConfirmDelete(true))}
                onBlur={() => setConfirmDelete(false)}
                title={confirmDelete ? 'Click again to permanently remove this rep' : 'Remove rep'}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] font-medium transition-colors ${
                  confirmDelete ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' : 'text-ink-faint hover:text-rose-500 hover:bg-surface-soft'
                }`}
              >
                <Trash2 size={13} /> {confirmDelete ? 'Click to confirm' : 'Remove'}
              </button>
            ) : <span />}
            <button
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors"
            >
              Close
            </button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-soft px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1">{label}</p>
      <p className="text-[17px] font-semibold tabular-nums leading-none text-ink">{value}</p>
    </div>
  )
}

function DetailRow({ icon, label, value, href, mono }: {
  icon: React.ReactNode; label: string; value: string | null; href?: string | null; mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 border-t border-hairline-soft first:border-t-0">
      <span className="mt-0.5 text-ink-faint flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
        {value && href ? (
          <a href={href} className={`block text-[13px] mt-0.5 break-words text-ink hover:text-brand-ink transition-colors ${mono ? 'font-mono text-[12px] tabular-nums' : ''}`}>
            {value}
          </a>
        ) : (
          <p className={`text-[13px] mt-0.5 break-words ${mono ? 'font-mono text-[12px] tabular-nums' : ''} ${value ? 'text-ink' : 'text-ink-faint'}`}>
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong px-4 py-8 text-center">
      <span className="mx-auto mb-2.5 w-9 h-9 rounded-xl bg-surface-strong flex items-center justify-center text-ink-faint">
        {icon}
      </span>
      <p className="text-[13px] font-medium text-ink-secondary">{title}</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">{caption}</p>
    </div>
  )
}
