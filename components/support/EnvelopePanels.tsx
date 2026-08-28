'use client'

/**
 * RFQ step 5 — three live envelope cross-sections.
 *
 * Replaces the three static "Good / Better / Best" cut-away photos that used to
 * sit above the material dropdowns. Walls, roof and floor each get their own
 * section, rebuilt layer-by-layer whenever that dropdown changes, with animated
 * droplets showing roughly how much moisture the assembly lets through.
 *
 * 🔴 PURELY ILLUSTRATIVE. Every permeance shown is read from lib/rfq.ts through
 * retarderPermOf() + assemblyPermOf() — the same two functions estimateLoad
 * uses — so the picture cannot disagree with the quote. Nothing here writes to
 * `data`, and the layer build-ups in lib/rfq-envelope-art.ts feed nothing at all.
 *
 * The droplet RATE is not a flux. Real flux across these assemblies spans about
 * 2,700:1; at the tight end that is one droplet every few minutes, which reads
 * as broken rather than as tight. It is compressed and capped — see flowOf().
 *
 * ⚠️ TWO DELIBERATE DEPARTURES FROM DESIGN.md, both signed off by the owner
 * (2026-08-28) because here the motion IS the content:
 *   • The build runs at ~2.7s, well outside the 120–200ms window.
 *   • The droplets loop, which "nothing loops" otherwise forbids.
 * Both stop entirely under prefers-reduced-motion, and the whole animation is
 * suspended while the panels are scrolled out of view.
 *
 * To go back to the photos, see docs/rfq-envelope-panels.md — the three webp
 * files were left in public/rfq/ precisely so that is a small change.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CEILING_MATERIALS, FLOOR_MATERIALS, WALL_MATERIALS,
  assemblyPermOf, retarderPermOf,
  type MaterialOption, type RfqData,
} from '@/lib/rfq'
import {
  FLOOR_ART, GENERIC_STACK, RETARDER_PATTERN, ROOF_ART, SWATCH, WALL_ART,
  envelopePatternDefs, type ArtLayer,
} from '@/lib/rfq-envelope-art'

// ─── Geometry ─────────────────────────────────────────────────────────────────
// An extruded slab seen slightly from above. The front face carries the layer
// bands; a top or side face gives it thickness. X0/X1 are pulled left of centre
// so the +DX extrusion lands the drawing optically centred in the viewBox.
const PW = 240, PH = 212
const X0 = 21, X1 = 197, Y0 = 60, Y1 = 168
const DX = 22, DY = -17

// ─── Motion ───────────────────────────────────────────────────────────────────
// Owner-selected 3.0x on 2026-08-28 after watching it at 0.4x–3x. Changing these
// four numbers is the whole speed control; they were a slider during review.
const T = { dur: 1020, stagger: 315, exit: 630, lead: 450, dist: 1.5 }
const ARRIVE = 6.0            // droplets/sec arriving at each panel
const MAX_MOTES = 70

type SurfaceKey = 'wall' | 'roof' | 'floor'

type PanelDef = {
  key: SurfaceKey
  title: string
  list: MaterialOption[]
  art: Record<string, readonly ArtLayer[]>
  field: 'wallMaterial' | 'ceilingMaterial' | 'floorMaterial'
  axis: 'x' | 'y'
  /** Direction moisture travels along the stack: +1 outward-in, -1 the reverse. */
  dir: 1 | -1
  ends: [string, string]
}

/**
 * ⚠️ The FLOOR is the one that inverts. Its stack is stored room-side first, so
 * drawing it in array order correctly puts the slab on top and the subgrade at
 * the bottom — which means moisture has to climb the stack backwards, from the
 * ground up into the room. That is what dir:-1 means. Wall reads left-to-right,
 * roof top-to-bottom.
 */
const PANELS: PanelDef[] = [
  { key: 'wall',  title: 'Walls',          list: WALL_MATERIALS,    art: WALL_ART,  field: 'wallMaterial',    axis: 'x', dir: 1,  ends: ['Outside', 'Inside'] },
  { key: 'roof',  title: 'Roof / ceiling', list: CEILING_MATERIALS, art: ROOF_ART,  field: 'ceilingMaterial', axis: 'y', dir: 1,  ends: ['Outside', 'Room'] },
  { key: 'floor', title: 'Floor',          list: FLOOR_MATERIALS,   art: FLOOR_ART, field: 'floorMaterial',   axis: 'y', dir: -1, ends: ['Room', 'Ground'] },
]

const NS = 'http://www.w3.org/2000/svg'
const svgEl = (n: string, a: Record<string, string> = {}) => {
  const e = document.createElementNS(NS, n)
  for (const k in a) e.setAttribute(k, a[k])
  return e
}
const poly = (ps: number[][]) => ps.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')

/** Cumulative 0..1 boundaries for a stack; thicknesses need not sum to 1. */
function cumulative(layers: readonly ArtLayer[]): number[] {
  const tot = layers.reduce((s, l) => s + l[1], 0) || 1
  const cum = [0]
  let a = 0
  for (const l of layers) { a += l[1] / tot; cum.push(a) }
  cum[cum.length - 1] = 1
  return cum
}

/**
 * The drawn stack, with the chosen retarder dropped in.
 *
 * Placement is per-surface and COSMETIC — walls and roofs get it just inside the
 * innermost finish, a floor gets it directly under the slab, which is where a
 * slab vapor barrier actually goes. The permeance reaching the arithmetic is
 * identical either way; only the position of the black line changes.
 */
function drawnStack(p: PanelDef, label: string, vaporBarrier: string, retarder: number | undefined): ArtLayer[] {
  const base = (p.art[label] ?? GENERIC_STACK).map(l => [...l] as unknown as ArtLayer)
  if (!retarder) return base
  const name = vaporBarrier === 'Custom' ? `Retarder, ${retarder} perm` : `${vaporBarrier} retarder`
  const at = p.key === 'floor' ? 1 : Math.max(1, base.length - 1)
  const pattern = RETARDER_PATTERN[vaporBarrier] ?? 'poly'
  base.splice(Math.min(at, base.length), 0, [name, 0.085, pattern, true])
  return base
}

/**
 * Droplet rate, 0..1. Anchored on 3.0 perm (the Class III / vapor-open end)
 * rather than the 116-perm fabric extreme — against 116 every ordinary assembly
 * bunches at zero and the panels all look identical.
 */
const flowOf = (perm: number) => Math.max(0.02, Math.min(1, Math.pow(perm / 3.0, 0.85)))

/** Plain-language band + the Tone it is drawn in. */
function bandOf(perm: number): [string, 'emerald' | 'sky' | 'amber' | 'rose'] {
  if (perm <= 0.1) return ['Near vapor-tight', 'emerald']
  if (perm <= 0.5) return ['Tight', 'emerald']
  if (perm <= 1.5) return ['Moderate', 'sky']
  if (perm <= 5) return ['Vapor-open', 'amber']
  return ['Very vapor-open', 'rose']
}
const fmtPerm = (p: number) => (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toFixed(3))

// Tone classes follow the raw-scale convention already used in RfqWizard's TONE
// map rather than inventing new utilities.
const PILL: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
}
const BAR: Record<string, string> = {
  emerald: 'bg-emerald-500', sky: 'bg-sky-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
}

/** Front face plus its thickness, for one layer band. */
function bandPieces(axis: 'x' | 'y', a: number, b: number, isFirst: boolean, isLast: boolean) {
  const out: { p: number[][]; sh: number }[] = []
  if (axis === 'x') {
    const xa = X0 + a * (X1 - X0), xb = X0 + b * (X1 - X0)
    out.push({ p: [[xa, Y0], [xb, Y0], [xb, Y1], [xa, Y1]], sh: 0 })
    out.push({ p: [[xa, Y0], [xb, Y0], [xb + DX, Y0 + DY], [xa + DX, Y0 + DY]], sh: -0.1 })
    if (isLast) out.push({ p: [[X1, Y0], [X1 + DX, Y0 + DY], [X1 + DX, Y1 + DY], [X1, Y1]], sh: 0.16 })
  } else {
    const ya = Y0 + a * (Y1 - Y0), yb = Y0 + b * (Y1 - Y0)
    out.push({ p: [[X0, ya], [X1, ya], [X1, yb], [X0, yb]], sh: 0 })
    out.push({ p: [[X1, ya], [X1 + DX, ya + DY], [X1 + DX, yb + DY], [X1, yb]], sh: 0.16 })
    if (isFirst) out.push({ p: [[X0, Y0], [X1, Y0], [X1 + DX, Y0 + DY], [X0 + DX, Y0 + DY]], sh: -0.1 })
  }
  return out
}

/** Stack-space position (0..1 across the layers) → a point in the drawing. */
const stackPoint = (axis: 'x' | 'y', p: number, lateral: number): [number, number] =>
  axis === 'x'
    ? [X0 + p * (X1 - X0), Y0 + 9 + lateral * (Y1 - Y0 - 18)]
    : [X0 + 11 + lateral * (X1 - X0 - 22), Y0 + p * (Y1 - Y0)]

type Mote = { t: number; life: number; hold: number; passes: boolean; from: number; to: number; lateral: number; speed: number }

export default function EnvelopePanels({
  data, reduced,
}: { data: RfqData; reduced: boolean }) {
  const [tip, setTip] = useState<{ x: number; y: number; surface: string; name: string } | null>(null)
  const hostRefs = useRef<(SVGGElement | null)[]>([])
  const markRefs = useRef<(SVGGElement | null)[]>([])
  const moteRefs = useRef<(SVGGElement | null)[]>([])
  const motes = useRef<Mote[][]>(PANELS.map(() => []))
  const flows = useRef<number[]>(PANELS.map(() => 0))
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(true)

  const retarder = retarderPermOf(data)

  /** Everything the panels need, recomputed only when an input actually moves. */
  const model = useMemo(() => PANELS.map(p => {
    const label = data[p.field]
    const material = p.list.find(m => m.label === label)
    const perm = assemblyPermOf(p.list, label, retarder)
    const [text, tone] = bandOf(perm)
    return {
      label, perm, text, tone,
      materialPerm: material?.perm,
      stack: drawnStack(p, label, data.vaporBarrier, retarder),
      flow: flowOf(perm),
    }
  }), [data.wallMaterial, data.ceilingMaterial, data.floorMaterial, retarder, data.vaporBarrier])

  useEffect(() => { flows.current = model.map(m => m.flow) }, [model])

  // Suspend everything while scrolled away — the droplets loop, so they should
  // not burn a phone battery below the fold.
  useEffect(() => {
    const node = wrapRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(node)
    return () => io.disconnect()
  }, [])

  // ── Build the bands. Each rebuild gets its OWN wrapper <g>; outgoing wrappers
  //    animate out and remove themselves.
  //    ⚠️ EVERY prior wrapper is retired, not just the first — retiring
  //    firstElementChild orphans the ones in between when selections come faster
  //    than one exit. And `oncancel` does not fire in Chrome, so the reaper is a
  //    timeout, which also covers a hidden tab never advancing the animation.
  useEffect(() => {
    model.forEach((m, i) => {
      const host = hostRefs.current[i]
      const marks = markRefs.current[i]
      if (!host || !marks) return
      const p = PANELS[i]
      const cum = cumulative(m.stack)

      const retire = (parent: SVGGElement, dx: number, dy: number) => {
        const olds = Array.from(parent.children)
        const fresh = svgEl('g') as SVGGElement
        parent.appendChild(fresh)
        for (const old of olds) {
          if (reduced) { old.remove(); continue }
          const a = old.animate(
            [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }],
            { duration: T.exit, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
          )
          const reap = () => old.remove()
          a.onfinish = reap
          window.setTimeout(reap, T.exit + 500)
        }
        return fresh
      }

      const enter = (node: SVGElement, dx: number, dy: number, idx: number) => {
        if (reduced) return
        node.animate(
          [{ transform: `translate(${dx * T.dist}px,${dy * T.dist}px)`, opacity: 0 },
            { transform: 'translate(0,0)', opacity: 1 }],
          { duration: T.dur, delay: T.lead + idx * T.stagger, easing: 'cubic-bezier(.16,.86,.28,1)', fill: 'backwards' },
        )
      }

      const g = retire(host, p.axis === 'x' ? -26 : 0, p.axis === 'x' ? -14 : 24)
      const dx = p.axis === 'x' ? -18 : 0
      const dy = p.axis === 'x' ? -10 : 18

      m.stack.forEach((L, li) => {
        bandPieces(p.axis, cum[li], cum[li + 1], li === 0, li === m.stack.length - 1).forEach(pc => {
          const node = svgEl('polygon', {
            points: poly(pc.p), fill: `url(#rfqp-${L[2]})`,
            'data-name': L[0], 'data-surface': p.title,
          })
          const title = svgEl('title')
          title.textContent = `${p.title}: ${L[0]}`
          node.appendChild(title)
          g.appendChild(node)
          enter(node, dx, dy, li)
          if (pc.sh) {
            const ov = svgEl('polygon', {
              points: poly(pc.p), fill: pc.sh > 0 ? '#0B1B2B' : '#FFFFFF',
              opacity: String(Math.abs(pc.sh)), 'pointer-events': 'none',
            })
            g.appendChild(ov)
          }
          if (L[3]) {
            const o = svgEl('polygon', {
              points: poly(pc.p), fill: 'none', stroke: '#0B1B2B',
              'stroke-opacity': '.42', 'stroke-width': '1', 'pointer-events': 'none',
            })
            g.appendChild(o)
            enter(o, dx, dy, li)
          }
        })
      })

      g.appendChild(svgEl('polygon', {
        points: poly([[X0, Y0], [X1, Y0], [X1 + DX, Y0 + DY], [X0 + DX, Y0 + DY]]),
        fill: 'none', stroke: '#2B3138', 'stroke-opacity': '.26', 'stroke-width': '1', 'pointer-events': 'none',
      }))
      g.appendChild(svgEl('polygon', {
        points: poly([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]),
        fill: 'none', stroke: '#2B3138', 'stroke-opacity': '.3', 'stroke-width': '1', 'pointer-events': 'none',
      }))

      // End labels — the droplets only make sense once you know which way they go.
      const mg = retire(marks, 0, 0)
      const chip = (x: number, y: number, text: string) => {
        const w = text.length * 5.6 + 13
        mg.appendChild(svgEl('rect', {
          x: String(x - w / 2), y: String(y - 8.5), width: String(w), height: '17', rx: '8.5',
          fill: '#FFFFFF', stroke: '#DAD7CF', 'stroke-width': '1', opacity: '.95', 'pointer-events': 'none',
        }))
        const t = svgEl('text', {
          x: String(x), y: String(y + 3.4), 'font-size': '9.5', 'font-weight': '600',
          'letter-spacing': '.8', fill: '#8A867C', 'text-anchor': 'middle', 'pointer-events': 'none',
        })
        t.textContent = text.toUpperCase()
        mg.appendChild(t)
      }
      if (p.axis === 'x') { chip(X0 + 26, Y1 + 24, p.ends[0]); chip(X1 + 2, Y1 + 24, p.ends[1]) }
      else { chip((X0 + X1) / 2 + 11, 22, p.ends[0]); chip((X0 + X1) / 2, Y1 + 30, p.ends[1]) }
      if (!reduced) {
        const base = T.dur + T.stagger * 3
        Array.from(mg.children).forEach((n, ci) => (n as SVGElement).animate(
          [{ opacity: 0 }, { opacity: n.tagName === 'rect' ? 0.95 : 1 }],
          { duration: 240, delay: base + Math.floor(ci / 2) * 120, easing: 'ease-out', fill: 'backwards' },
        ))
      }
    })
  }, [model, reduced])

  // ── Droplets ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduced || !visible) return
    let raf = 0
    let last = 0
    const acc = PANELS.map(() => 0)

    const spawn = (pi: number) => {
      const p = PANELS[pi]
      const m = model[pi]
      const cum = cumulative(m.stack)
      const passes = Math.random() < flows.current[pi]
      // Where a blocked droplet stops is drawn from the resistances in the
      // stack, so the retarder visibly does the work when it is the bigger one.
      let to: number
      if (passes) to = p.dir > 0 ? 1.34 : -0.34
      else {
        const ri = m.stack.findIndex(l => l[3])
        const share = retarder && m.materialPerm
          ? (1 / retarder) / (1 / retarder + 1 / m.materialPerm) : 0
        if (ri >= 0 && Math.random() < share) to = cum[ri + 1]
        else {
          const li = Math.min(m.stack.length - 1, Math.floor(Math.random() * m.stack.length))
          to = cum[li] + Math.random() * (cum[li + 1] - cum[li])
        }
      }
      motes.current[pi].push({
        t: 0, life: 0, hold: 0, passes,
        from: p.dir > 0 ? -0.2 : 1.2, to,
        lateral: 0.06 + Math.random() * 0.88, speed: 0.3 + Math.random() * 0.14,
      })
    }

    const frame = (ts: number) => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016
      last = ts
      PANELS.forEach((p, pi) => {
        const list = motes.current[pi]
        acc[pi] += dt * ARRIVE
        while (acc[pi] >= 1) { acc[pi] -= 1; if (list.length < MAX_MOTES) spawn(pi) }
        for (const mo of list) { mo.t += dt * mo.speed; mo.life += dt; if (mo.t >= 1) mo.hold += dt }
        for (let i = list.length - 1; i >= 0; i--) {
          const mo = list[i]
          if (mo.passes ? mo.t > 1 : mo.hold > 0.6) list.splice(i, 1)
        }
        const g = moteRefs.current[pi]
        if (!g) return
        while (g.childNodes.length < list.length) g.appendChild(svgEl('circle', { r: '2.3', 'pointer-events': 'none' }))
        while (g.childNodes.length > list.length) g.removeChild(g.lastChild!)
        list.forEach((mo, i) => {
          const c = g.childNodes[i] as SVGCircleElement
          const pos = mo.from + (mo.to - mo.from) * Math.min(mo.t, 1)
          const [x, y] = stackPoint(p.axis, pos, mo.lateral)
          const fadeIn = Math.min(1, mo.life * 3.5)
          const fadeOut = mo.passes ? Math.max(0, 1 - Math.max(0, mo.t - 1) / 0.7) : Math.max(0, 1 - mo.hold / 0.6)
          const through = mo.passes && mo.t > 0.94
          c.setAttribute('cx', x.toFixed(1))
          c.setAttribute('cy', y.toFixed(1))
          c.setAttribute('r', (through ? 2.9 : 2.4 - Math.min(mo.t, 1) * 0.5).toFixed(2))
          c.setAttribute('fill', through ? '#1F7FC4' : '#57A8DC')
          c.setAttribute('opacity', (0.85 * fadeIn * fadeOut).toFixed(3))
        })
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      motes.current.forEach((l, i) => { l.length = 0; const g = moteRefs.current[i]; if (g) g.replaceChildren() })
    }
  }, [model, reduced, visible, retarder])

  const legend = useMemo(() => {
    const seen = new Map<string, string>()
    model.forEach(m => m.stack.forEach(L => { if (!seen.has(L[0])) seen.set(L[0], L[2]) }))
    return [...seen]
  }, [model])

  return (
    <div ref={wrapRef} className="relative">
      {/* One off-screen sprite holds every pattern; all three panels reference it
          by id. Zero-size + absolute, NOT display:none — a hidden ancestor can
          stop a referenced paint server rendering. */}
      <svg aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <defs dangerouslySetInnerHTML={{ __html: envelopePatternDefs() }} />
      </svg>

      <div className="grid gap-3 sm:grid-cols-3">
        {PANELS.map((p, i) => {
          const m = model[i]
          return (
            <figure key={p.key} className="overflow-hidden rounded-xl border border-hairline bg-surface">
              {/* The artwork keeps its own light ground in dark mode, exactly as the
                  cut-away photos it replaces did — re-toning brick or steel for a
                  dark theme would misrepresent the materials. */}
              <div className="border-b border-hairline-soft bg-[#FAFAF8]">
                <svg
                  viewBox={`0 0 ${PW} ${PH}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`${p.title}: ${m.label}. ${m.text}, ${fmtPerm(m.perm)} perms.`}
                  onPointerMove={e => {
                    const t = (e.target as Element).closest('[data-name]') as SVGElement | null
                    if (!t) { setTip(null); return }
                    setTip({
                      x: e.clientX, y: e.clientY,
                      surface: t.getAttribute('data-surface') || '',
                      name: t.getAttribute('data-name') || '',
                    })
                  }}
                  onPointerLeave={() => setTip(null)}
                >
                  <g ref={el => { hostRefs.current[i] = el }} />
                  <g ref={el => { moteRefs.current[i] = el }} />
                  <g ref={el => { markRefs.current[i] = el }} />
                </svg>
              </div>
              <figcaption className="px-3 pb-2.5 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{p.title}</p>
                <p className="mt-0.5 min-h-[2.6em] text-[12.5px] leading-snug text-ink">{m.label || '—'}</p>
                <p className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[m.tone]}`}
                    title={`${fmtPerm(m.perm)} grains/hr/sq.ft/inHg`}
                  >
                    {m.text}
                  </span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-strong">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-300 ease-out ${BAR[m.tone]}`}
                      style={{ width: `${(5 + m.flow * 95).toFixed(1)}%` }}
                    />
                  </span>
                </p>
              </figcaption>
            </figure>
          )
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
        {legend.map(([name, pat]) => (
          <span key={name} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <i
              className="block h-2.5 w-5 flex-none rounded-[3px] border border-hairline-strong"
              style={{ background: SWATCH[pat] || '#ccc' }}
            />
            {name}
          </span>
        ))}
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[150%] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium leading-snug text-surface"
          style={{ left: tip.x, top: tip.y }}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] opacity-60">{tip.surface}</span>
          {tip.name}
        </div>
      )}
    </div>
  )
}
