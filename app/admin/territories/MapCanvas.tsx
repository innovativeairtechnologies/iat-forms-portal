'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MapCanvas — the maplibre wrapper for /admin/territories. ALL map-engine risk
// lives here so the rest of the feature is plain React.
//
// Lifecycle rules (load-bearing — see docs/territory-map.md):
//  • The map is created ONCE per mount; StrictMode double-mount is guarded by
//    the cleanup calling map.remove() and the init effect re-running cleanly.
//  • Theme switching calls map.setStyle(), which DESTROYS every custom source
//    and layer. ensureLayers() is idempotent and re-runs on every 'style.load',
//    so fills/pins survive the swap. Never add a source/layer outside it.
//  • Geo boundary files (public/geo/*.json, TopoJSON — see scripts/build-geo.mjs)
//    are fetched once per session (module-level cache) and converted with
//    topojson-client. Counties (~1.7MB) load lazily on first need.
//  • Basemap: OpenFreeMap (no key, production-permitted). positron light / dark
//    dark — both verified live; if a style URL ever 404s, fall back to positron.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties, Position } from 'geojson'
import { buildFillExpr, SHARED_FILL, type TerritoryLevel } from '@/lib/territories'

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'

// MapLibre v6 (ESM-only) locates its render worker via
// new URL('./maplibre-gl-worker.mjs', import.meta.url) — webpack inlines
// import.meta.url as a literal build-machine file:/// path, the worker never
// loads, and the map paints a silent blank canvas ("module script ...
// text/html" in the console as the fallback fetch gets 307'd to /login).
// Point maplibre at the vendored same-origin copy instead (kept in sync by
// scripts/sync-maplibre-worker.mjs on prebuild). Must run before any Map is
// constructed; this module is client-only (dynamic ssr:false), so no window
// guard is needed.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')

// One geography layer = one source + one fill + one line. Counties sit ABOVE
// states/provinces so a county assignment paints over the state wash.
const GEO_LAYERS: { key: GeoKey; url: string; object: string; level: TerritoryLevel }[] = [
  { key: 'states', url: '/geo/us-states.json', object: 'states', level: 'state' },
  { key: 'provinces', url: '/geo/ca-provinces.json', object: 'provinces', level: 'province' },
  { key: 'counties', url: '/geo/us-counties.json', object: 'counties', level: 'county' },
]

type GeoKey = 'states' | 'provinces' | 'counties'
type FC = FeatureCollection<Geometry, GeoJsonProperties>

export type PinDatum = {
  id: string
  companyId: string
  lng: number
  lat: number
  color: string
  title: string
  subtitle: string
}

export type HoverInfo = { title: string; owners: { name: string; color: string | null; exclusivity: string | null }[] }

export type MapMode = 'view' | 'paint' | 'place'

/** A camera request. Bump `token` to (re-)run it.
 *  'bounds' — frame a firm's whole footprint (picking it from the list).
 *  'point'  — go TO one spot and zoom IN, never out (clicking a pin). */
export type MapFocus =
  | { token: number; kind: 'bounds'; codes: Record<TerritoryLevel, string[]>; pins: [number, number][] }
  | { token: number; kind: 'point'; center: [number, number]; minZoom?: number }

type Props = {
  dark: boolean
  /** owner colors per territory code, per level (already includes optimistic edits) */
  fills: Record<TerritoryLevel, Record<string, string[]>>
  pins: PinDatum[]
  mode: MapMode
  paintLevel: 'state' | 'county'
  /** county layer shown when painting counties OR any county assignment exists */
  countiesVisible: boolean
  focus: MapFocus | null
  /** Pixels of the map obscured on the right by the floating rep panel. The
   *  canvas runs full-bleed underneath it, so camera moves have to account for
   *  it or a framed footprint lands behind the panel. */
  insetRight?: number
  /** the location being placed — rendered as a draggable marker */
  placing: { lng: number; lat: number } | null
  lookup: (level: TerritoryLevel, code: string) => HoverInfo | null
  onFeatureClick: (level: TerritoryLevel, code: string, name: string) => void
  onMapClick: (lng: number, lat: number) => void
  onPinClick: (companyId: string, locationId: string) => void
}

// Session-wide geo cache — survives remounts and theme swaps.
const geoCache = new Map<GeoKey, Promise<FC>>()
function loadGeo(key: GeoKey): Promise<FC> {
  let p = geoCache.get(key)
  if (!p) {
    const def = GEO_LAYERS.find((g) => g.key === key)!
    p = fetch(def.url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} loading ${def.url}`)
        return r.json()
      })
      .then((topo: Topology) => {
        const fc = feature(topo, topo.objects[def.object]) as FC
        // Counties carry their FIPS as feature.id — mirror it into properties.code
        // so every layer keys fills/clicks/hover off the same property.
        for (const f of fc.features) {
          if (!f.properties) f.properties = {}
          if (f.properties.code == null) f.properties.code = String(f.id)
        }
        return fc
      })
    geoCache.set(key, p)
    p.catch(() => geoCache.delete(key)) // let a failed fetch retry next time
  }
  return p
}

function walkPositions(geom: Geometry, visit: (p: Position) => void) {
  if (geom.type === 'GeometryCollection') { geom.geometries.forEach((g) => walkPositions(g, visit)); return }
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') visit(c as Position)
    else if (Array.isArray(c)) c.forEach(walk)
  }
  walk((geom as { coordinates: unknown }).coordinates)
}

const PAINT_FALLBACK = 'rgba(148,163,184,0.16)' // faint slate so unassigned units are visibly clickable in paint mode

export default function MapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const geoRef = useRef<Partial<Record<GeoKey, FC>>>({})
  const hoverRef = useRef<{ layer: string; id: string | number } | null>(null)
  const placingMarkerRef = useRef<maplibregl.Marker | null>(null)
  // Latest props via a ref so map event handlers (bound once) never go stale.
  const propsRef = useRef(props)
  propsRef.current = props
  const [tooltip, setTooltip] = useState<{ x: number; y: number; info: HoverInfo } | null>(null)
  // The actual failure message, shown ON the page — a silent blank map is
  // undebuggable from a user screenshot; this makes the screenshot the diagnosis.
  const [mapError, setMapError] = useState<string | null>(null)

  // ── One-time init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: propsRef.current.dark ? STYLE_DARK : STYLE_LIGHT,
        center: [-95.5, 39.5],
        zoom: 3.4,
        minZoom: 2.5,
        // Added manually below so it can sit bottom-LEFT. maplibre defaults it
        // to bottom-right, which is exactly where the floating rep panel now
        // lives — the OpenFreeMap/OSM credit was ~9% visible and its "i" toggle
        // unclickable, which ODbL attribution can't be.
        attributionControl: false,
      })
    } catch (e) {
      // Most likely WebGL unavailable (hardware acceleration off) — the
      // constructor throws synchronously and there is no map to attach to.
      console.error('[territories map] init failed', e)
      setMapError(e instanceof Error ? e.message : 'The map engine failed to start.')
      return
    }
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    map.on('error', (e) => {
      // Surface load-time failures (blocked tile host, dead style URL) instead
      // of a silent blank canvas; a later successful style.load clears this.
      if (!map.isStyleLoaded() && !disposed) {
        setMapError(e?.error?.message ? `Basemap failed to load: ${e.error.message}` : 'Basemap failed to load.')
      }
      console.error('[territories map]', e?.error ?? e)
    })

    const ensureLayers = () => {
      if (disposed || !map.getStyle()) return
      setMapError(null) // the style DID load — clear any transient load error
      // Insert our fills beneath the basemap's labels so place names stay readable.
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id

      for (const def of GEO_LAYERS) {
        const fc = geoRef.current[def.key]
        if (!fc) continue
        if (!map.getSource(def.key)) {
          map.addSource(def.key, { type: 'geojson', data: fc, promoteId: 'code' })
        }
        const fillId = `${def.key}-fill`
        const lineId = `${def.key}-line`
        if (!map.getLayer(fillId)) {
          // ensureLayers re-runs on every style.load (incl. after a theme swap),
          // so reading the current theme here keeps fills legible on both
          // basemaps: the dark basemap is near-black, so the same 0.35 wash that
          // reads well on the light "positron" map looks washed-out on it —
          // bump the dark opacity so territories stay clearly colored.
          const base = propsRef.current.dark ? 0.5 : 0.35
          const hover = propsRef.current.dark ? 0.68 : 0.55
          map.addLayer(
            {
              id: fillId,
              type: 'fill',
              source: def.key,
              paint: {
                'fill-color': 'rgba(0,0,0,0)',
                'fill-opacity': [
                  'case', ['boolean', ['feature-state', 'hover'], false], hover, base,
                ] as unknown as ExpressionSpecification,
              },
            },
            firstSymbol,
          )
        }
        if (!map.getLayer(lineId)) {
          map.addLayer(
            {
              id: lineId,
              type: 'line',
              source: def.key,
              paint: {
                'line-color': '#94a3b8',
                'line-opacity': def.key === 'counties' ? 0.3 : 0.45,
                'line-width': def.key === 'counties' ? 0.4 : 0.7,
              },
            },
            firstSymbol,
          )
        }
      }

      if (!map.getSource('pins')) {
        map.addSource('pins', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 46,
          clusterMaxZoom: 12,
        })
      }
      if (!map.getLayer('pins-clusters')) {
        map.addLayer({
          id: 'pins-clusters',
          type: 'circle',
          source: 'pins',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#334155',
            'circle-radius': ['step', ['get', 'point_count'], 13, 5, 16, 15, 20] as unknown as ExpressionSpecification,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255,255,255,0.85)',
          },
        })
      }
      if (!map.getLayer('pins-count')) {
        map.addLayer({
          id: 'pins-count',
          type: 'symbol',
          source: 'pins',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'] as unknown as ExpressionSpecification,
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
          },
          paint: { 'text-color': '#ffffff' },
        })
      }
      if (!map.getLayer('pins-dot')) {
        map.addLayer({
          id: 'pins-dot',
          type: 'circle',
          source: 'pins',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'] as unknown as ExpressionSpecification,
            'circle-radius': 6.5,
            'circle-stroke-width': 1.8,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        })
      }

      applyData()
    }

    // Re-apply everything data-driven: fill expressions, pin data, visibility.
    const applyData = () => {
      if (disposed || !map.getStyle()) return
      const { fills, pins, mode, countiesVisible } = propsRef.current
      for (const def of GEO_LAYERS) {
        const fillId = `${def.key}-fill`
        if (!map.getLayer(fillId)) continue
        let expr = buildFillExpr(fills[def.level])
        if (mode === 'paint') {
          // Unassigned units get a faint wash in paint mode so the clickable
          // grid is visible; expr's last element is the match fallback.
          if (Array.isArray(expr)) (expr as unknown[])[(expr as unknown[]).length - 1] = PAINT_FALLBACK
          else expr = PAINT_FALLBACK
        }
        map.setPaintProperty(fillId, 'fill-color', expr as ExpressionSpecification)
        const visible = def.key !== 'counties' || countiesVisible
        map.setLayoutProperty(fillId, 'visibility', visible ? 'visible' : 'none')
        if (map.getLayer(`${def.key}-line`)) {
          map.setLayoutProperty(`${def.key}-line`, 'visibility', visible ? 'visible' : 'none')
        }
      }
      const pinsSource = map.getSource('pins') as maplibregl.GeoJSONSource | undefined
      pinsSource?.setData({
        type: 'FeatureCollection',
        features: pins.map((p) => ({
          type: 'Feature' as const,
          properties: { id: p.id, companyId: p.companyId, color: p.color, title: p.title, subtitle: p.subtitle },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
      })
    }
    // Expose to the prop-sync effects below without re-binding listeners.
    ;(map as unknown as Record<string, unknown>).__applyData = applyData
    ;(map as unknown as Record<string, unknown>).__ensureLayers = ensureLayers

    map.on('style.load', ensureLayers)

    // Load boundaries: states + provinces now, counties on demand (see effect).
    for (const key of ['states', 'provinces'] as GeoKey[]) {
      loadGeo(key).then((fc) => {
        if (disposed) return
        geoRef.current[key] = fc
        if (map.isStyleLoaded()) ensureLayers()
      }).catch((e) => console.error('[territories geo]', e))
    }

    // ── Pointer interactions (bound once; read propsRef for current state) ────
    const clearHover = () => {
      const h = hoverRef.current
      if (h && map.getSource(h.layer)) map.setFeatureState({ source: h.layer, id: h.id }, { hover: false })
      hoverRef.current = null
    }

    const topFeatureAt = (e: MapMouseEvent) => {
      const { countiesVisible, paintLevel, mode } = propsRef.current
      // County layer wins when it's shown and being painted; otherwise admin-1.
      const order: { layer: string; key: GeoKey; level: TerritoryLevel }[] = []
      if (countiesVisible && (mode !== 'paint' || paintLevel === 'county')) {
        order.push({ layer: 'counties-fill', key: 'counties', level: 'county' })
      }
      if (!(mode === 'paint' && paintLevel === 'county')) {
        order.push({ layer: 'states-fill', key: 'states', level: 'state' })
        order.push({ layer: 'provinces-fill', key: 'provinces', level: 'province' })
      }
      for (const o of order) {
        if (!map.getLayer(o.layer)) continue
        const hits = map.queryRenderedFeatures(e.point, { layers: [o.layer] })
        if (hits.length) return { ...o, feature: hits[0] }
      }
      return null
    }

    map.on('mousemove', (e) => {
      if (disposed) return
      const { mode, lookup } = propsRef.current
      if (mode === 'place') { clearHover(); setTooltip(null); return }

      // Pins take precedence for hover info.
      if (map.getLayer('pins-dot')) {
        const pinHits = map.queryRenderedFeatures(e.point, { layers: ['pins-dot'] })
        if (pinHits.length) {
          clearHover()
          map.getCanvas().style.cursor = 'pointer'
          const p = pinHits[0].properties as { title: string; subtitle: string }
          setTooltip({ x: e.point.x, y: e.point.y, info: { title: p.title, owners: [{ name: p.subtitle, color: null, exclusivity: null }] } })
          return
        }
      }

      const hit = topFeatureAt(e)
      if (!hit) {
        clearHover()
        map.getCanvas().style.cursor = ''
        setTooltip(null)
        return
      }
      const code = String(hit.feature.properties?.code ?? '')
      const prev = hoverRef.current
      if (!prev || prev.layer !== hit.key || prev.id !== code) {
        clearHover()
        hoverRef.current = { layer: hit.key, id: code }
        map.setFeatureState({ source: hit.key, id: code }, { hover: true })
      }
      map.getCanvas().style.cursor = 'pointer'
      const info = lookup(hit.level, code)
      const title = info?.title || String(hit.feature.properties?.name ?? code)
      setTooltip({ x: e.point.x, y: e.point.y, info: { title, owners: info?.owners ?? [] } })
    })

    map.on('mouseout', () => { clearHover(); setTooltip(null) })

    map.on('click', (e) => {
      if (disposed) return
      const { mode, onMapClick, onPinClick, onFeatureClick } = propsRef.current
      if (mode === 'place') { onMapClick(e.lngLat.lng, e.lngLat.lat); return }

      // Cluster → zoom in. Pin → open its firm.
      if (map.getLayer('pins-clusters')) {
        const clusterHits = map.queryRenderedFeatures(e.point, { layers: ['pins-clusters'] })
        if (clusterHits.length) {
          const clusterId = clusterHits[0].properties?.cluster_id as number
          const src = map.getSource('pins') as maplibregl.GeoJSONSource
          src.getClusterExpansionZoom(clusterId).then((zoom) => {
            // Expansion zoom is the exact zoom the cluster splits at, which can
            // be a barely-visible step; the floor guarantees the click feels
            // like it did something.
            map.easeTo({
              center: (clusterHits[0].geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: Math.max(zoom, map.getZoom() + 0.75),
              duration: 600,
            })
          })
          return
        }
      }
      if (map.getLayer('pins-dot')) {
        const pinHits = map.queryRenderedFeatures(e.point, { layers: ['pins-dot'] })
        if (pinHits.length) {
          const p = pinHits[0].properties as { id: string; companyId: string }
          onPinClick(p.companyId, p.id)
          return
        }
      }
      const hit = topFeatureAt(e)
      if (hit) {
        onFeatureClick(hit.level, String(hit.feature.properties?.code ?? ''), String(hit.feature.properties?.name ?? ''))
      }
    })

    // Panel collapse / window changes resize the canvas container.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      disposed = true
      ro.disconnect()
      placingMarkerRef.current?.remove()
      placingMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Prop sync effects ───────────────────────────────────────────────────────
  const call = (name: '__applyData' | '__ensureLayers') => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    ;((map as unknown as Record<string, unknown>)[name] as () => void)?.()
  }

  // Theme → swap basemap style (ensureLayers re-adds everything on style.load).
  const darkRef = useRef(props.dark)
  useEffect(() => {
    if (darkRef.current === props.dark) return
    darkRef.current = props.dark
    mapRef.current?.setStyle(props.dark ? STYLE_DARK : STYLE_LIGHT)
  }, [props.dark])

  // Fills / pins / mode / visibility → re-apply data-driven paint.
  useEffect(() => { call('__applyData') }, [props.fills, props.pins, props.mode, props.paintLevel, props.countiesVisible])

  // Counties are heavy — fetch only when first needed.
  useEffect(() => {
    if (!props.countiesVisible || geoRef.current.counties) return
    let stale = false
    loadGeo('counties').then((fc) => {
      if (stale) return
      geoRef.current.counties = fc
      call('__ensureLayers')
    }).catch((e) => console.error('[territories geo]', e))
    return () => { stale = true }
  }, [props.countiesVisible])

  // Cursor per mode.
  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = props.mode === 'place' ? 'crosshair' : ''
  }, [props.mode])

  // Focus → move the camera. Point focus zooms IN on one spot (clicking a pin);
  // bounds focus frames a whole footprint (picking a firm from the list).
  useEffect(() => {
    const map = mapRef.current
    const focus = props.focus
    if (!map || !focus || focus.token === 0) return
    // Clamp to a third of the canvas: on a phone the panel covers the full
    // width, and padding wider than the container makes fitBounds incoherent.
    const inset = Math.max(0, Math.min(props.insetRight ?? 0, map.getContainer().clientWidth / 3))
    if (focus.kind === 'point') {
      // Never zoom OUT to reach a pin the user just clicked — max() keeps the
      // current zoom when they're already closer than the target.
      // The offset nudges the target left of the container centre by half the
      // panel width, so it lands in the visible half rather than under the panel.
      map.easeTo({
        center: focus.center,
        zoom: Math.max(map.getZoom(), focus.minZoom ?? 8),
        offset: [-inset / 2, 0],
        duration: 600,
      })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    let any = false
    for (const def of GEO_LAYERS) {
      const fc = geoRef.current[def.key]
      const codes = new Set(focus.codes[def.level])
      if (!fc || codes.size === 0) continue
      for (const f of fc.features) {
        if (!codes.has(String(f.properties?.code))) continue
        walkPositions(f.geometry, ([lng, lat]) => bounds.extend([lng, lat]))
        any = true
      }
    }
    for (const [lng, lat] of focus.pins) { bounds.extend([lng, lat]); any = true }
    if (any) map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 + inset }, maxZoom: 7, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focus?.token])

  // Placing marker — one draggable DOM marker for the location being placed.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!props.placing) {
      placingMarkerRef.current?.remove()
      placingMarkerRef.current = null
      return
    }
    const { lng, lat } = props.placing
    if (!placingMarkerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true, color: '#089447' })
        .setLngLat([lng, lat])
        .addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        propsRef.current.onMapClick(pos.lng, pos.lat)
      })
      placingMarkerRef.current = marker
    } else {
      placingMarkerRef.current.setLngLat([lng, lat])
    }
  }, [props.placing])

  return (
    <div className="relative flex-1 min-h-0">
      {/* Inline position/inset, NOT classes: maplibre-gl.css sets
          `.maplibregl-map { position: relative; overflow: hidden }` on this
          element when the map attaches, and its stylesheet loads after
          Tailwind (it ships with this lazy chunk) — a class-based
          `absolute` loses that fight and the container collapses to 0px
          height (proven in the css-order harness). Inline style always wins. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {mapError && (
        // z-50: above the floating rep panel (z-30). This message IS the
        // diagnosis ("screenshot this"), so it must never be half-covered.
        <div className="pointer-events-none absolute inset-x-0 top-14 z-50 flex justify-center px-4">
          <p className="max-w-[480px] rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            {mapError} — try reloading; if it persists, screenshot this message.
          </p>
        </div>
      )}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[260px] rounded-lg border border-hairline bg-surface px-3 py-2 text-[12px] leading-snug"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold text-ink">{tooltip.info.title}</p>
          {tooltip.info.owners.length === 0 ? (
            <p className="text-ink-faint">Unassigned</p>
          ) : (
            tooltip.info.owners.map((o, i) => (
              <p key={i} className="flex items-center gap-1.5 text-ink-secondary">
                {o.color !== null && (
                  <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: o.color || SHARED_FILL }} />
                )}
                <span className="truncate">{o.name}</span>
                {o.exclusivity && <span className="text-ink-faint truncate">· {o.exclusivity}</span>}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  )
}
