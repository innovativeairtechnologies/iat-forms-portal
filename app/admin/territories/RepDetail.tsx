'use client'

/* ────────────────────────────────────────────────────────────────────────────
   RepDetail — one rep's record, rendered INSIDE the floating rep panel.

   Reps used to be dead text: three lines in the roster, no click target, no way
   in. Only firms were selectable. Clicking a rep now drills the panel into that
   rep, exactly the way clicking a firm drills into FirmDetail — same back-link
   idiom, same panel, no overlay.

   Deliberately NOT a Drawer: this page's whole point is the map, and throwing a
   scrim over it to read a rep's territories hides the thing you're reading
   about. The panel already floats (see TerritoriesClient), so the record
   inherits that treatment for free and the map stays live behind it.

   Tabs are scoped to data that actually exists for a contact. There is no
   per-rep activity table, so there is no Activity tab — a tab that can only
   ever be empty is worse than no tab:

     Overview    — the rep's contact card (editable) + their firm
     Territories — the firm's assigned states/counties
     Locations   — the firm's pins
     Notes       — contacts.notes, the one free-text field on the row

   Writes go through the callbacks TerritoriesClient owns, matching how every
   other mutation on this page stays optimistic and in one place.
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import {
  ChevronLeft, Building2, Mail, Phone, MapPin, Trash2, Check, Loader2, Pencil, Crosshair, Star,
} from 'lucide-react'
import type { Company, Contact, CompanyLocation, CompanyTerritory } from '@/lib/supabase'
import { SHARED_FILL, territoryLabel } from '@/lib/territories'
import { Tabs, type TabDef } from '@/components/ui/Tabs'

type TabKey = 'overview' | 'territories' | 'locations' | 'notes'

const INPUT_CX =
  'w-full h-8 px-2.5 text-[12.5px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors'
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover transition-colors disabled:opacity-50'
const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'
const SECTION_CX = 'text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint'

export default function RepDetail({
  rep, firm, territories, locations, firmRepCount, canEdit, backLabel,
  onBack, onUpdateContact, onDeleteContact, onFitFirm, onSelectFirm,
}: {
  rep: Contact
  firm: Company | null
  territories: CompanyTerritory[]
  locations: CompanyLocation[]
  /** How many reps the firm has in total (this one included). */
  firmRepCount: number
  canEdit: boolean
  /** Where "back" actually goes — the roster, or the firm you drilled in from. */
  backLabel: string
  onBack: () => void
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

  // Reset when pointed at a DIFFERENT rep. Keyed on `rep.id` ONLY, with the lint
  // suppressed: a save replaces the contact object upstream, so depending on the
  // mutable fields made every successful save re-run this reset — snapping the
  // user off the Notes tab and discarding an unsaved draft.
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
    <div className="flex flex-col">
      {/* Back + identity */}
      <div className="px-4 pt-3">
        <button
          className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink transition-colors"
          onClick={onBack}
        >
          <ChevronLeft size={13} /> {backLabel}
        </button>

        <div className="mt-1.5 flex items-start justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-ink tracking-tight min-w-0 flex items-center gap-1.5">
            {rep.is_primary && <Star size={13} className="fill-amber-400 text-amber-400 flex-shrink-0" />}
            <span className="truncate">{rep.name}</span>
          </h2>
          {canEdit && !editing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-soft transition-colors"
                title="Edit rep details"
                onClick={() => {
                  setForm({ name: rep.name, title: rep.title ?? '', email: rep.email ?? '', phone: rep.phone ?? '' })
                  setEditing(true); setTab('overview')
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  confirmDelete
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                    : 'text-ink-faint hover:text-rose-500 hover:bg-surface-soft'
                }`}
                title={confirmDelete ? 'Click again to permanently remove this rep' : 'Remove rep'}
                onClick={() => (confirmDelete ? (onDeleteContact(rep.id), onBack()) : setConfirmDelete(true))}
                onBlur={() => setConfirmDelete(false)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        <p className="mt-0.5 text-[11.5px] text-ink-faint truncate">
          {[rep.title, firm?.name].filter(Boolean).join(' · ') || 'No details yet'}
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mt-3" />

      <div className="px-4 py-3 space-y-4">
        {error && (
          <p className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {tab === 'overview' ? (
          <>
            {/* Stat strip — the firm footprint this rep sells into */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Territories" value={sortedTerritories.length} />
              <StatTile label="Pins" value={placedPins.length} />
              <StatTile label="Firm reps" value={firmRepCount} />
            </div>

            {firm && (
              <button
                onClick={() => onSelectFirm(firm.id)}
                className="w-full flex items-center gap-2.5 rounded-xl border border-hairline bg-surface-soft px-3 py-2.5 text-left hover:border-hairline-strong transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-surface-strong flex items-center justify-center flex-shrink-0 text-ink-muted">
                  <Building2 size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${SECTION_CX}`}>Firm</span>
                  <span className="mt-0.5 flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: firm.map_color ?? SHARED_FILL }} />
                    <span className="block text-[12.5px] text-ink truncate">{firm.name}</span>
                  </span>
                </span>
              </button>
            )}

            <div>
              <p className={SECTION_CX}>Contact</p>
              {editing ? (
                <div className="mt-1.5 space-y-2">
                  <input className={INPUT_CX} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                  <input className={INPUT_CX} placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <input className={INPUT_CX} placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={INPUT_CX} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <div className="flex items-center gap-2 pt-0.5">
                    <button className={BTN_PRIMARY} disabled={busy || !form.name.trim()} onClick={saveDetails}>
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                    </button>
                    <button
                      className={BTN_QUIET}
                      onClick={() => {
                        setForm({ name: rep.name, title: rep.title ?? '', email: rep.email ?? '', phone: rep.phone ?? '' })
                        setEditing(false); setError(null)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 rounded-xl border border-hairline overflow-hidden">
                  <DetailRow icon={<Mail size={13} />} label="Email" value={rep.email} href={rep.email ? `mailto:${rep.email}` : null} />
                  <DetailRow icon={<Phone size={13} />} label="Phone" value={rep.phone} href={rep.phone ? `tel:${rep.phone}` : null} mono />
                  <DetailRow icon={<Building2 size={13} />} label="Title" value={rep.title} />
                </div>
              )}
            </div>
          </>
        ) : tab === 'territories' ? (
          sortedTerritories.length === 0 ? (
            <EmptyState
              icon={<MapPin size={17} />}
              title="No territories yet"
              caption={firm ? `${firm.name} has no assigned states or counties.` : 'This rep has no firm.'}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className={SECTION_CX}>{firm?.name ?? 'Firm'} coverage</p>
                {firm && (
                  <button
                    onClick={() => onFitFirm(firm.id)}
                    className="text-[11.5px] font-medium text-ink-muted hover:text-ink transition-colors"
                    title="Zoom the map out to this firm's whole footprint"
                  >
                    Show all
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {sortedTerritories.map((t) => (
                  <li key={t.id} className="rounded-lg border border-hairline bg-surface-soft px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: firm?.map_color ?? SHARED_FILL }} />
                      <span className="text-[12px] font-medium text-ink flex-1 truncate">
                        {territoryLabel(t.level, t.code)}
                        {t.level === 'county' && <span className="text-ink-faint font-normal"> · county</span>}
                      </span>
                    </div>
                    {t.exclusivity && <p className="mt-0.5 text-[11px] text-ink-faint">Exclusive: {t.exclusivity}</p>}
                  </li>
                ))}
              </ul>
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
            <ul className="space-y-0.5">
              {locations.map((l) => {
                const placed = l.lat != null && l.lng != null
                return (
                  <li key={l.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                    <MapPin size={13} className={`flex-shrink-0 ${placed ? 'text-brand' : 'text-ink-faint'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink truncate">{l.label || l.city || 'Unnamed'}</p>
                      <p className="text-[11px] text-ink-faint truncate">
                        {[l.city, l.region, l.country].filter(Boolean).join(', ')}
                        {!placed && ' · not on map'}
                      </p>
                    </div>
                    {placed && <Crosshair size={12} className="text-ink-faint flex-shrink-0" />}
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          /* ── Notes ── */
          <div>
            <div className="flex items-center justify-between">
              <p className={SECTION_CX}>Notes on {rep.name.split(' ')[0]}</p>
              {notesDirty && <span className="text-[11px] text-ink-faint">Unsaved</span>}
            </div>
            {canEdit ? (
              <>
                <textarea
                  rows={9}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="What should the team know about this rep? Strengths, accounts they own, how they like to be contacted…"
                  className={`${INPUT_CX} mt-1.5 h-auto py-2 leading-relaxed resize-y`}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button className={BTN_PRIMARY} onClick={saveNotes} disabled={!notesDirty || busy}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save notes
                  </button>
                  {notesDirty && (
                    <button className={BTN_QUIET} onClick={() => setNotesDraft(rep.notes ?? '')}>Discard</button>
                  )}
                </div>
              </>
            ) : rep.notes ? (
              <div className="mt-1.5 rounded-xl border border-hairline bg-surface-soft px-3 py-2.5">
                <p className="text-[12.5px] text-ink-secondary whitespace-pre-wrap break-words leading-relaxed">{rep.notes}</p>
              </div>
            ) : (
              <EmptyState icon={<Pencil size={17} />} title="No notes yet" caption="Sales and admin can add notes about this rep." />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-soft px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1">{label}</p>
      <p className="text-[16px] font-semibold tabular-nums leading-none text-ink">{value}</p>
    </div>
  )
}

function DetailRow({ icon, label, value, href, mono }: {
  icon: React.ReactNode; label: string; value: string | null; href?: string | null; mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 border-t border-hairline-soft first:border-t-0">
      <span className="mt-0.5 text-ink-faint flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
        {value && href ? (
          <a href={href} className={`block text-[12.5px] mt-0.5 break-words text-ink hover:text-brand-ink transition-colors ${mono ? 'font-mono text-[12px] tabular-nums' : ''}`}>
            {value}
          </a>
        ) : (
          <p className={`text-[12.5px] mt-0.5 break-words ${mono ? 'font-mono text-[12px] tabular-nums' : ''} ${value ? 'text-ink' : 'text-ink-faint'}`}>
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong px-4 py-7 text-center">
      <span className="mx-auto mb-2.5 w-9 h-9 rounded-xl bg-surface-strong flex items-center justify-center text-ink-faint">
        {icon}
      </span>
      <p className="text-[13px] font-medium text-ink-secondary">{title}</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">{caption}</p>
    </div>
  )
}
