'use client'

// TerritoriesClient — state owner for /admin/territories. Holds the CRM slice
// (rep firms + contacts) and the map slice (territories + locations), applies
// every mutation optimistically, and writes through the API routes (deals
// fetch-pattern — server actions would revalidate the whole map page per paint
// click). MapCanvas (maplibre, browser-only) loads via dynamic ssr:false — the
// same escape hatch three.js uses (KnowledgeReactorClient precedent).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Check, PanelRight, X } from 'lucide-react'
import type { Company, Contact, CompanyLocation, CompanyTerritory } from '@/lib/supabase'
import { SHARED_FILL, type TerritoryLevel } from '@/lib/territories'
import type { HoverInfo, MapFocus, MapMode, PinDatum } from './MapCanvas'
import RepPanel from './RepPanel'

const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-canvas">
      <p className="text-[13px] text-ink-muted animate-pulse">Loading map…</p>
    </div>
  ),
})

type Props = {
  initialCompanies: Company[]
  initialContacts: Contact[]
  initialLocations: CompanyLocation[]
  initialTerritories: CompanyTerritory[]
  canEdit: boolean
}

async function api<T = Record<string, unknown>>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<{ ok: true; json: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (json as { error?: string }).error || `Request failed (${res.status})` }
    return { ok: true, json: json as T }
  } catch {
    return { ok: false, error: 'Network error — nothing was saved.' }
  }
}

export default function TerritoriesClient({
  initialCompanies, initialContacts, initialLocations, initialTerritories, canEdit,
}: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [contacts, setContacts] = useState(initialContacts)
  const [locations, setLocations] = useState(initialLocations)
  const [territories, setTerritories] = useState(initialTerritories)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<MapMode>('view')
  const [paintLevel, setPaintLevel] = useState<'state' | 'county'>('state')
  const [placingId, setPlacingId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const focusToken = useRef(0)

  // next-themes hydration guard (AdminSidebar precedent).
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'

  // Transient error toast — clears itself.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const selected = selectedId ? companiesById.get(selectedId) ?? null : null

  // ── Derived map data ────────────────────────────────────────────────────────
  const fills = useMemo(() => {
    const out: Record<TerritoryLevel, Record<string, string[]>> = { state: {}, province: {}, county: {} }
    for (const t of territories) {
      const color = companiesById.get(t.company_id)?.map_color ?? SHARED_FILL
      ;(out[t.level][t.code] ??= []).push(color)
    }
    return out
  }, [territories, companiesById])

  const pins = useMemo<PinDatum[]>(
    () =>
      locations
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => {
          const firm = companiesById.get(l.company_id)
          return {
            id: l.id,
            companyId: l.company_id,
            lng: l.lng as number,
            lat: l.lat as number,
            color: firm?.map_color ?? SHARED_FILL,
            title: firm?.name ?? 'Unknown firm',
            subtitle: [l.label, l.city].filter(Boolean).join(' · ') || 'Location',
          }
        }),
    [locations, companiesById],
  )

  const countiesVisible =
    (mode === 'paint' && paintLevel === 'county') || territories.some((t) => t.level === 'county')

  const lookup = useCallback(
    (level: TerritoryLevel, code: string): HoverInfo | null => {
      const owners = territories
        .filter((t) => t.level === level && t.code === code)
        .map((t) => {
          const firm = companiesById.get(t.company_id)
          return { name: firm?.name ?? 'Unknown firm', color: firm?.map_color ?? SHARED_FILL, exclusivity: t.exclusivity }
        })
      if (owners.length === 0) return null
      return { title: '', owners } // title '' → MapCanvas falls back to the feature's own name
    },
    [territories, companiesById],
  )

  // Frame a firm's whole footprint — the right move when you PICK a firm from
  // the list ("show me everything they own").
  const focusFirm = useCallback((id: string) => {
    const codes: Record<TerritoryLevel, string[]> = { state: [], province: [], county: [] }
    for (const t of territories) if (t.company_id === id) codes[t.level].push(t.code)
    const firmPins = locations
      .filter((l) => l.company_id === id && l.lat != null && l.lng != null)
      .map((l) => [l.lng as number, l.lat as number] as [number, number])
    if (codes.state.length + codes.province.length + codes.county.length + firmPins.length === 0) return
    focusToken.current += 1
    setFocus({ token: focusToken.current, kind: 'bounds', codes, pins: firmPins })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories, locations])

  /** Go to one spot and zoom in — used when a specific pin is clicked. */
  const focusPoint = useCallback((lng: number, lat: number) => {
    focusToken.current += 1
    setFocus({ token: focusToken.current, kind: 'point', center: [lng, lat], minZoom: 8 })
  }, [])

  // `fit` defaults ON for list picks. Map clicks pass fit:false: re-framing to
  // a multi-state footprint would yank the camera away from the very thing the
  // user just clicked (and fitBounds' maxZoom would zoom them back OUT).
  const select = useCallback((id: string | null, opts?: { fit?: boolean }) => {
    setSelectedId(id)
    setMode('view')
    setPlacingId(null)
    if (id) {
      setPanelOpen(true)
      if (opts?.fit !== false) focusFirm(id)
    }
  }, [focusFirm])

  // ── Firm CRUD (alive CRM routes) ────────────────────────────────────────────
  const addFirm = useCallback(async (fields: { name: string; phone?: string; website?: string; location?: string }) => {
    const res = await api<{ company: Company; existed: boolean }>('/api/admin/deals/companies', 'POST', {
      name: fields.name, kind: 'rep_firm', phone: fields.phone ?? null,
      website: fields.website ?? null, location: fields.location ?? null,
    })
    if (!res.ok) return res.error
    const { company, existed } = res.json
    if (existed && company.kind !== 'rep_firm') {
      return `“${company.name}” already exists in the CRM as ${company.kind} — manage it from the CRM, or use a distinct firm name.`
    }
    setCompanies((cs) => (cs.some((c) => c.id === company.id) ? cs : [...cs, company].sort((a, b) => a.name.localeCompare(b.name))))
    setSelectedId(company.id)
    return null
  }, [])

  const updateFirm = useCallback(async (id: string, patch: Partial<Pick<Company, 'name' | 'phone' | 'website' | 'location'>>) => {
    const res = await api<{ company: Company }>(`/api/admin/deals/companies/${id}`, 'PATCH', patch)
    if (!res.ok) return res.error
    setCompanies((cs) => cs.map((c) => (c.id === id ? res.json.company : c)))
    return null
  }, [])

  const deleteFirm = useCallback(async (id: string) => {
    const prev = { companies, contacts, locations, territories }
    setCompanies((cs) => cs.filter((c) => c.id !== id))
    setContacts((ks) => ks.filter((k) => k.company_id !== id))
    setLocations((ls) => ls.filter((l) => l.company_id !== id))
    setTerritories((ts) => ts.filter((t) => t.company_id !== id))
    setSelectedId(null)
    const res = await api(`/api/admin/deals/companies/${id}`, 'DELETE')
    if (!res.ok) {
      setCompanies(prev.companies); setContacts(prev.contacts)
      setLocations(prev.locations); setTerritories(prev.territories)
      setError(res.error)
    }
  }, [companies, contacts, locations, territories])

  const setColor = useCallback(async (id: string, color: string) => {
    const prev = companiesById.get(id)?.map_color ?? null
    setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, map_color: color } : c)))
    const res = await api(`/api/admin/deals/companies/${id}`, 'PATCH', { map_color: color })
    if (!res.ok) {
      setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, map_color: prev } : c)))
      setError(res.error)
    }
  }, [companiesById])

  // ── Contacts ────────────────────────────────────────────────────────────────
  const addContact = useCallback(async (companyId: string, fields: { name: string; title?: string; email?: string; phone?: string }) => {
    const res = await api<{ contact: Contact }>('/api/admin/deals/contacts', 'POST', {
      company_id: companyId, name: fields.name, title: fields.title ?? null,
      email: fields.email ?? null, phone: fields.phone ?? null,
    })
    if (!res.ok) return res.error
    setContacts((ks) => [...ks, res.json.contact])
    return null
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    const prev = contacts
    setContacts((ks) => ks.filter((k) => k.id !== id))
    const res = await api(`/api/admin/deals/contacts/${id}`, 'DELETE')
    if (!res.ok) { setContacts(prev); setError(res.error) }
  }, [contacts])

  // ── Locations / pins ────────────────────────────────────────────────────────
  const addLocation = useCallback(async (companyId: string, fields: { label?: string; city?: string; region?: string; country: 'US' | 'CA' }) => {
    const res = await api<{ location: CompanyLocation }>('/api/admin/territories/locations', 'POST', {
      companyId, label: fields.label ?? null, city: fields.city ?? null,
      region: fields.region ?? null, country: fields.country,
    })
    if (!res.ok) return res.error
    setLocations((ls) => [...ls, res.json.location])
    return null
  }, [])

  const deleteLocation = useCallback(async (id: string) => {
    const prev = locations
    setLocations((ls) => ls.filter((l) => l.id !== id))
    if (placingId === id) { setPlacingId(null); setMode('view') }
    const res = await api(`/api/admin/territories/locations/${id}`, 'DELETE')
    if (!res.ok) { setLocations(prev); setError(res.error) }
  }, [locations, placingId])

  const startPlace = useCallback((id: string) => {
    setPlacingId(id)
    setMode('place')
    setPanelOpen(false)
  }, [])

  const stopPlace = useCallback(() => {
    setPlacingId(null)
    setMode('view')
    setPanelOpen(true)
  }, [])

  const placeAt = useCallback(async (lng: number, lat: number) => {
    if (!placingId) return
    const prev = locations.find((l) => l.id === placingId)
    if (!prev) return
    setLocations((ls) => ls.map((l) => (l.id === placingId ? { ...l, lng, lat } : l)))
    const res = await api(`/api/admin/territories/locations/${placingId}`, 'PATCH', { lng, lat })
    if (!res.ok) {
      setLocations((ls) => ls.map((l) => (l.id === placingId ? { ...l, lng: prev.lng, lat: prev.lat } : l)))
      setError(res.error)
    }
  }, [placingId, locations])

  // ── Territory painting ──────────────────────────────────────────────────────
  const toggleTerritory = useCallback(async (level: TerritoryLevel, code: string, name: string) => {
    if (!selectedId || !canEdit) return
    const existing = territories.find((t) => t.company_id === selectedId && t.level === level && t.code === code)
    if (existing) {
      setTerritories((ts) => ts.filter((t) => t.id !== existing.id))
      const res = await api('/api/admin/territories/assignments', 'DELETE', { companyId: selectedId, level, code, label: name })
      if (!res.ok) { setTerritories((ts) => [...ts, existing]); setError(res.error) }
      return
    }
    const temp: CompanyTerritory = {
      id: `temp-${level}-${code}`, company_id: selectedId, level, code,
      exclusivity: null, created_at: new Date().toISOString(),
    }
    setTerritories((ts) => [...ts, temp])
    const res = await api<{ territory: CompanyTerritory; company: Company | null }>(
      '/api/admin/territories/assignments', 'POST',
      { companyId: selectedId, level, code, label: name },
    )
    if (!res.ok) {
      setTerritories((ts) => ts.filter((t) => t.id !== temp.id))
      setError(res.error)
      return
    }
    setTerritories((ts) => ts.map((t) => (t.id === temp.id ? res.json.territory : t)))
    if (res.json.company) {
      const updated = res.json.company
      setCompanies((cs) => cs.map((c) => (c.id === updated.id ? updated : c)))
    }
  }, [selectedId, canEdit, territories])

  const removeTerritory = useCallback(async (t: CompanyTerritory) => {
    setTerritories((ts) => ts.filter((x) => x.id !== t.id))
    const res = await api('/api/admin/territories/assignments', 'DELETE', { companyId: t.company_id, level: t.level, code: t.code })
    if (!res.ok) { setTerritories((ts) => [...ts, t]); setError(res.error) }
  }, [])

  const editExclusivity = useCallback(async (t: CompanyTerritory, value: string) => {
    const next = value || null
    setTerritories((ts) => ts.map((x) => (x.id === t.id ? { ...x, exclusivity: next } : x)))
    const res = await api('/api/admin/territories/assignments', 'PATCH', { companyId: t.company_id, level: t.level, code: t.code, exclusivity: next })
    if (!res.ok) {
      setTerritories((ts) => ts.map((x) => (x.id === t.id ? { ...x, exclusivity: t.exclusivity } : x)))
      setError(res.error)
    }
  }, [])

  // ── Map events ──────────────────────────────────────────────────────────────
  const onFeatureClick = useCallback((level: TerritoryLevel, code: string, name: string) => {
    if (mode === 'paint') { toggleTerritory(level, code, name); return }
    const owners = territories.filter((t) => t.level === level && t.code === code)
    // Identify-only: show the owner in the panel, leave the camera alone.
    if (owners.length > 0) select(owners[0].company_id, { fit: false })
  }, [mode, toggleTerritory, territories, select])

  // Clicking a pin zooms to THAT pin — not to its firm's whole footprint.
  const onPinClick = useCallback((companyId: string, locationId: string) => {
    select(companyId, { fit: false })
    const loc = locations.find((l) => l.id === locationId)
    if (loc?.lat != null && loc?.lng != null) focusPoint(loc.lng, loc.lat)
  }, [select, locations, focusPoint])

  const placingLocation = placingId ? locations.find((l) => l.id === placingId) : null
  const placing = mode === 'place' && placingLocation && placingLocation.lat != null && placingLocation.lng != null
    ? { lng: placingLocation.lng, lat: placingLocation.lat }
    : null

  const levelPillCx = (active: boolean) =>
    `px-2.5 h-6 rounded-md text-[11.5px] font-medium transition-colors ${
      active ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
    }`

  return (
    <div className="flex-1 min-h-0 flex relative">
      {/* Map column */}
      <div className="relative flex-1 min-w-0 flex flex-col">
        <MapCanvas
          dark={dark}
          fills={fills}
          pins={pins}
          mode={mode}
          paintLevel={paintLevel}
          countiesVisible={countiesVisible}
          focus={focus}
          placing={placing}
          lookup={lookup}
          onFeatureClick={onFeatureClick}
          onMapClick={placeAt}
          onPinClick={onPinClick}
        />

        {/* Mode banner — the single floating control while painting / placing */}
        {mode === 'paint' && selected && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.map_color ?? SHARED_FILL }} />
            <span className="text-[12.5px] text-ink-secondary max-w-[240px] truncate">
              Painting <span className="font-semibold text-ink">{selected.name}</span> — click to toggle
            </span>
            <span className="flex items-center gap-0.5 rounded-lg bg-surface-soft border border-hairline p-0.5">
              <button className={levelPillCx(paintLevel === 'state')} onClick={() => setPaintLevel('state')}>States</button>
              <button className={levelPillCx(paintLevel === 'county')} onClick={() => setPaintLevel('county')}>Counties</button>
            </span>
            <button
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand-hover transition-colors"
              onClick={() => setMode('view')}
            >
              <Check size={13} /> Done
            </button>
          </div>
        )}
        {mode === 'place' && placingLocation && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-xl border border-hairline bg-surface px-3 py-1.5">
            <span className="text-[12.5px] text-ink-secondary max-w-[300px] truncate">
              Click the map to place <span className="font-semibold text-ink">{placingLocation.label || placingLocation.city || 'this location'}</span>
              {placing && ' — drag the pin to fine-tune'}
            </span>
            <button
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand-hover transition-colors"
              onClick={stopPlace}
            >
              <Check size={13} /> Done
            </button>
          </div>
        )}

        {/* Error toast (also mirrored inside the panel) */}
        {error && !panelOpen && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {/* Panel toggle */}
        <button
          className="absolute top-3 right-3 z-30 flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-surface text-ink-muted hover:text-ink transition-colors"
          title={panelOpen ? 'Hide the list' : 'Show the list'}
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? <X size={15} /> : <PanelRight size={15} />}
        </button>
      </div>

      {/* Side panel — overlays on small screens, docks from md up */}
      {panelOpen && (
        <aside className="absolute md:static inset-y-0 right-0 z-20 w-full sm:w-[380px] md:w-[380px] flex-shrink-0 border-l border-hairline bg-surface flex flex-col">
          <RepPanel
            companies={companies}
            contacts={contacts}
            locations={locations}
            territories={territories}
            selectedId={selectedId}
            canEdit={canEdit}
            mode={mode}
            placingId={placingId}
            error={error}
            onSelect={select}
            onAddFirm={addFirm}
            onUpdateFirm={updateFirm}
            onDeleteFirm={deleteFirm}
            onSetColor={setColor}
            onAddContact={addContact}
            onDeleteContact={deleteContact}
            onAddLocation={addLocation}
            onDeleteLocation={deleteLocation}
            onStartPlace={startPlace}
            onStartPaint={() => setMode('paint')}
            onFitFirm={focusFirm}
            onRemoveTerritory={removeTerritory}
            onEditExclusivity={editExclusivity}
          />
        </aside>
      )}
    </div>
  )
}
