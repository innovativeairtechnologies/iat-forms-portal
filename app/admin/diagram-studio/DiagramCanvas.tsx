'use client'

import {
  useCallback, useRef,
  type MutableRefObject, type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ARTBOARD, FOOTER_Y, HEADER_H, PAPER, TONES,
  calloutHeight, nodeBox,
  type Callout, type DiagramNode, type Flow, type Note, type Pt, type Scene, type Tone,
} from '@/lib/diagrams'

/* ────────────────────────────────────────────────────────────────────────────
   DiagramCanvas — renders a Scene as one self-contained SVG artboard.

   Self-contained is the requirement, not a nicety: export works by serialising
   this element, so anything the figure needs must live INSIDE the <svg> —
   gradients in <defs>, the photo as a data URL, colours as literals. No CSS
   classes, no design tokens, no `currentColor`. If a colour came from the page,
   the exported PNG would lose it (or, worse, come out in dark mode).

   Editing chrome (selection outlines, drag handles) is tagged data-chrome and
   stripped from the clone before export — see serializeSvg().
   ──────────────────────────────────────────────────────────────────────────── */

export type Selection =
  | { type: 'callout'; id: string }
  | { type: 'note'; id: string }
  | { type: 'node'; id: string }
  | null

type Props = {
  scene: Scene
  selected: Selection
  onSelect: (s: Selection) => void
  /** Live drag updates. `patch` is a partial of the callout/note being moved. */
  onMoveCallout: (id: string, x: number, y: number) => void
  onMoveAnchor: (id: string, anchor: Pt) => void
  onMoveNote: (id: string, x: number, y: number) => void
  /** The studio holds this to serialise the artboard on export. */
  svgRef?: MutableRefObject<SVGSVGElement | null>
  /** Editing affordances off = a clean preview (used for nothing yet, but export-safe). */
  interactive?: boolean
}

const FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const SELECT = '#089447'

// ─── geometry helpers ────────────────────────────────────────────────────────

/** Block arrow (shaft + head) from `a` to `b`, at any angle. */
function arrowPoints(a: Pt, b: Pt, width: number): string {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const half = width / 2
  const head = Math.min(width * 1.25, len * 0.55)
  const headHalf = width * 0.92
  const bx = b[0] - ux * head
  const by = b[1] - uy * head
  const p = (x: number, y: number) => `${round(x)},${round(y)}`
  return [
    p(a[0] + nx * half, a[1] + ny * half),
    p(bx + nx * half, by + ny * half),
    p(bx + nx * headHalf, by + ny * headHalf),
    p(b[0], b[1]),
    p(bx - nx * headHalf, by - ny * headHalf),
    p(bx - nx * half, by - ny * half),
    p(a[0] - nx * half, a[1] - ny * half),
  ].join(' ')
}

/**
 * Rectangle swept along `a`→`b` — the duct run.
 *
 * Both ends run half a width long. Duct runs are authored as butt-jointed
 * segments, and without the overhang every corner leaves a square notch.
 */
function ductPoints(a: Pt, b: Pt, width: number): string {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy * (width / 2)
  const ny = ux * (width / 2)
  const ex = ux * (width / 2)
  const ey = uy * (width / 2)
  const p = (x: number, y: number) => `${round(x)},${round(y)}`
  return [
    p(a[0] - ex + nx, a[1] - ey + ny), p(b[0] + ex + nx, b[1] + ey + ny),
    p(b[0] + ex - nx, b[1] + ey - ny), p(a[0] - ex - nx, a[1] - ey - ny),
  ].join(' ')
}

/** Where a leader line leaves a card: the card edge on the ray toward `target`. */
function edgePoint(cx: number, cy: number, hw: number, hh: number, target: Pt): Pt {
  const dx = target[0] - cx
  const dy = target[1] - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx)
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy)
  const s = Math.min(sx, sy)
  return [cx + dx * s, cy + dy * s]
}

/** Keeps arrow labels upright — a straight-down arrow still reads bottom-to-top. */
function labelAngle(a: Pt, b: Pt): number {
  let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  if (deg > 90) deg -= 180
  if (deg < -90) deg += 180
  return deg
}

/** Cooling-coil serpentine inside a box. */
function zigzag(x: number, y: number, w: number, h: number, teeth: number): string {
  const step = w / teeth
  let d = `M ${round(x)} ${round(y + h)}`
  for (let i = 0; i < teeth; i++) {
    const x1 = x + step * i + step / 2
    const x2 = x + step * (i + 1)
    d += ` L ${round(x1)} ${round(y)} L ${round(x2)} ${round(y + h)}`
  }
  return d
}

const round = (n: number) => Math.round(n * 10) / 10

function lines(text: string): string[] {
  return text.split('\n')
}

// ─── component ───────────────────────────────────────────────────────────────

export default function DiagramCanvas({
  scene, selected, onSelect, onMoveCallout, onMoveAnchor, onMoveNote, svgRef, interactive = true,
}: Props) {
  // One internal ref does the coordinate maths; the caller's ref (used for
  // export) is mirrored through the same callback. A callback ref rather than
  // handing `svgRef` straight to <svg>: React's `RefObject` is covariant and
  // read-only, so a `<T | null>` ref is not assignable to the `ref` prop.
  const ref = useRef<SVGSVGElement | null>(null)
  const attach = useCallback((el: SVGSVGElement | null) => {
    ref.current = el
    if (svgRef) svgRef.current = el
  }, [svgRef])
  const drag = useRef<{ kind: 'callout' | 'anchor' | 'note'; id: string; grabDx: number; grabDy: number } | null>(null)

  const toSvg = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const svg = ref.current
    if (!svg) return [0, 0]
    const ctm = svg.getScreenCTM()
    if (!ctm) return [0, 0]
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(ctm.inverse())
    return [q.x, q.y]
  }, [])

  const startDrag = useCallback(
    (e: ReactPointerEvent, kind: 'callout' | 'anchor' | 'note', id: string, originX: number, originY: number) => {
      if (!interactive) return
      e.stopPropagation()
      const [px, py] = toSvg(e)
      drag.current = { kind, id, grabDx: px - originX, grabDy: py - originY }
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    },
    [interactive, toSvg],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current
      if (!d) return
      const [px, py] = toSvg(e)
      const x = Math.round(px - d.grabDx)
      const y = Math.round(py - d.grabDy)
      const cx = Math.max(0, Math.min(ARTBOARD.w, x))
      const cy = Math.max(HEADER_H, Math.min(FOOTER_Y, y))
      if (d.kind === 'callout') onMoveCallout(d.id, cx, cy)
      else if (d.kind === 'anchor') onMoveAnchor(d.id, [cx, cy])
      else onMoveNote(d.id, cx, cy)
    },
    [onMoveAnchor, onMoveCallout, onMoveNote, toSvg],
  )

  const endDrag = useCallback(() => { drag.current = null }, [])

  const isSel = (type: 'callout' | 'note' | 'node', id: string) =>
    selected?.type === type && selected.id === id

  return (
    <svg
      ref={attach}
      viewBox={`0 0 ${ARTBOARD.w} ${ARTBOARD.h}`}
      width={ARTBOARD.w}
      height={ARTBOARD.h}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily={FONT}
      style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => interactive && onSelect(null)}
    >
      <defs>
        <linearGradient id="dgm-header" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={PAPER.headerFrom} />
          <stop offset="100%" stopColor={PAPER.headerTo} />
        </linearGradient>
        <linearGradient id="dgm-rotor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F4E7C6" />
          <stop offset="45%" stopColor="#DCC28C" />
          <stop offset="100%" stopColor="#F0E1BC" />
        </linearGradient>
        <pattern id="dgm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={PAPER.grid} strokeWidth="1" />
        </pattern>
        {scene.nodes.filter((n) => n.kind === 'room').map((n) => (
          <clipPath key={n.id} id={`dgm-clip-${n.id}`}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} />
          </clipPath>
        ))}
      </defs>

      {/* board */}
      <rect x={0} y={0} width={ARTBOARD.w} height={ARTBOARD.h} fill={PAPER.canvas} />
      {scene.showGrid && (
        <rect x={0} y={HEADER_H} width={ARTBOARD.w} height={FOOTER_Y - HEADER_H} fill="url(#dgm-grid)" />
      )}

      <Header scene={scene} />
      <Footer scene={scene} />

      {/* body */}
      <g>
        {scene.flows.map((f) => <FlowShape key={f.id} flow={f} />)}
        {scene.nodes.map((n) => (
          <NodeShape
            key={n.id}
            node={n}
            selectable={interactive}
            onSelect={() => onSelect({ type: 'node', id: n.id })}
          />
        ))}
        {scene.callouts.map((c) => (
          <CalloutCard
            key={c.id}
            callout={c}
            selected={isSel('callout', c.id)}
            interactive={interactive}
            onSelect={() => onSelect({ type: 'callout', id: c.id })}
            onDragCard={(e) => startDrag(e, 'callout', c.id, c.x, c.y)}
            onDragAnchor={(e) => c.anchor && startDrag(e, 'anchor', c.id, c.anchor[0], c.anchor[1])}
          />
        ))}
        {scene.notes.map((n) => (
          <NoteText
            key={n.id}
            note={n}
            selected={isSel('note', n.id)}
            interactive={interactive}
            onSelect={() => onSelect({ type: 'note', id: n.id })}
            onDrag={(e) => startDrag(e, 'note', n.id, n.x, n.y)}
          />
        ))}
      </g>

      {/* selection ring for nodes (cards/notes draw their own) */}
      {interactive && selected?.type === 'node' && (() => {
        const n = scene.nodes.find((x) => x.id === selected.id)
        if (!n) return null
        const b = nodeBox(n)
        return (
          <rect
            data-chrome="1" pointerEvents="none"
            x={b.x - 8} y={b.y - 8} width={b.w + 16} height={b.h + 16} rx={10}
            fill="none" stroke={SELECT} strokeWidth={2.5} strokeDasharray="8 6"
          />
        )
      })()}
    </svg>
  )
}

// ─── header / footer ─────────────────────────────────────────────────────────

function Header({ scene }: { scene: Scene }) {
  const badgeW = Math.max(120, scene.figure.length * 13 + 34)
  return (
    <g>
      <rect x={0} y={0} width={ARTBOARD.w} height={HEADER_H} fill="url(#dgm-header)" />
      <rect x={0} y={HEADER_H - 5} width={ARTBOARD.w} height={5} fill={PAPER.headerRule} />
      {scene.figure ? (
        <>
          <rect x={34} y={26} width={badgeW} height={40} rx={7} fill="none" stroke={PAPER.headerRule} strokeWidth={2.5} />
          <text
            x={34 + badgeW / 2} y={53} textAnchor="middle"
            fontSize={20} fontWeight={700} letterSpacing="0.09em" fill={PAPER.headerRule}
          >
            {scene.figure.toUpperCase()}
          </text>
        </>
      ) : null}
      <text
        x={scene.figure ? 34 + badgeW + 30 : 34} y={54}
        fontSize={31} fontWeight={650} letterSpacing="-0.01em" fill={PAPER.headerInk}
      >
        {scene.title}
      </text>
      <text
        x={ARTBOARD.w - 34} y={53} textAnchor="end"
        fontSize={18} fontWeight={500} letterSpacing="0.14em" fill={PAPER.headerMuted}
      >
        {scene.eyebrow.toUpperCase()}
      </text>
    </g>
  )
}

function Footer({ scene }: { scene: Scene }) {
  let x = 216
  return (
    <g>
      <line x1={34} y1={FOOTER_Y} x2={ARTBOARD.w - 34} y2={FOOTER_Y} stroke={PAPER.cardEdge} strokeWidth={1.5} />
      <text x={40} y={FOOTER_Y + 42} fontSize={15} fontWeight={700} letterSpacing="0.1em" fill={PAPER.muted}>
        AIRFLOW KEY
      </text>
      {scene.legend.map((item) => {
        const at = x
        x += 40 + item.label.length * 9.6 + 40
        return (
          <g key={`${item.tone}-${item.label}`}>
            <rect x={at} y={FOOTER_Y + 26} width={32} height={20} rx={4} fill={TONES[item.tone].fill} />
            <text x={at + 42} y={FOOTER_Y + 42} fontSize={17} fontWeight={600} fill={PAPER.equipInk}>
              {item.label}
            </text>
          </g>
        )
      })}
      <text x={ARTBOARD.w - 40} y={FOOTER_Y + 42} textAnchor="end" fontSize={14.5} fill={PAPER.faint}>
        {scene.footnote}
      </text>
    </g>
  )
}

// ─── flows ───────────────────────────────────────────────────────────────────

function FlowShape({ flow }: { flow: Flow }) {
  const tone = TONES[flow.tone]
  const mid: Pt = [(flow.from[0] + flow.to[0]) / 2, (flow.from[1] + flow.to[1]) / 2]

  if (flow.style === 'duct') {
    return (
      <g>
        <polygon points={ductPoints(flow.from, flow.to, flow.width)} fill="#DDE5EC" stroke={PAPER.equipEdge} strokeWidth={1.5} />
        <line
          x1={flow.from[0]} y1={flow.from[1]} x2={flow.to[0]} y2={flow.to[1]}
          stroke={PAPER.leader} strokeWidth={1.5} strokeDasharray="10 7"
        />
      </g>
    )
  }

  const label = flow.label.trim()
  const pillW = label ? label.length * 10.5 + 20 : 0
  return (
    <g>
      <polygon points={arrowPoints(flow.from, flow.to, flow.width)} fill={tone.fill} />
      {label ? (
        <g transform={`translate(${round(mid[0])},${round(mid[1])}) rotate(${round(labelAngle(flow.from, flow.to))})`}>
          <rect x={-pillW / 2} y={-13} width={pillW} height={26} rx={5} fill={tone.fill} />
          <text
            x={0} y={5} textAnchor="middle"
            fontSize={15} fontWeight={700} letterSpacing="0.07em" fill="#FFFFFF"
          >
            {label.toUpperCase()}
          </text>
        </g>
      ) : null}
    </g>
  )
}

// ─── equipment ───────────────────────────────────────────────────────────────

function NodeShape({ node, selectable, onSelect }: { node: DiagramNode; selectable: boolean; onSelect: () => void }) {
  const hit = selectable
    ? { onPointerDown: (e: ReactPointerEvent) => { e.stopPropagation(); onSelect() }, style: { cursor: 'pointer' as const } }
    : {}

  if (node.kind === 'desiccant') {
    const splitY = node.y + node.h * node.split
    const coilW = node.w - 44
    return (
      <g {...hit}>
        <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={10} fill={PAPER.equipFill} stroke={PAPER.equipEdge} strokeWidth={2} />
        <line x1={node.x} y1={splitY} x2={node.x + node.w} y2={splitY} stroke={PAPER.equipEdge} strokeWidth={2} />
        <ChamberLabel text={node.topLabel} cx={node.x + node.w / 2} cy={(node.y + splitY) / 2} />
        {/* the coil eats the bottom of the process chamber, so the label rides up */}
        <ChamberLabel
          text={node.bottomLabel}
          cx={node.x + node.w / 2}
          cy={(splitY + node.y + node.h) / 2 - (node.precool ? 16 : 0)}
        />
        {node.precool && (
          <g>
            <rect x={node.x + 22} y={node.y + node.h - 44} width={coilW} height={26} rx={4} fill="#FFFFFF" stroke={TONES.water.fill} strokeWidth={2} />
            <path d={zigzag(node.x + 30, node.y + node.h - 39, coilW - 16, 16, 5)} fill="none" stroke={TONES.water.fill} strokeWidth={2.2} />
          </g>
        )}
        {node.rotor && (
          <g>
            <ellipse cx={node.x + node.w} cy={node.y + node.h / 2} rx={24} ry={node.h / 2 + 6} fill="url(#dgm-rotor)" stroke="#B99A50" strokeWidth={2} />
            <ellipse cx={node.x + node.w} cy={node.y + node.h / 2} rx={14} ry={node.h / 2 - 8} fill="none" stroke="#C4A868" strokeWidth={1.2} />
            <ellipse cx={node.x + node.w} cy={node.y + node.h / 2} rx={6} ry={node.h / 2 - 22} fill="none" stroke="#C4A868" strokeWidth={1.2} />
          </g>
        )}
      </g>
    )
  }

  if (node.kind === 'ahu') {
    const secW = node.w / Math.max(1, node.sections.length)
    const coilIdx = node.sections.findIndex((s) => s.icon === 'coil')
    return (
      <g {...hit}>
        {node.inlet && (
          <polygon
            points={`${node.x - 86},${node.y + 24} ${node.x},${node.y} ${node.x},${node.y + node.h} ${node.x - 86},${node.y + node.h - 24}`}
            fill={PAPER.equipFill} stroke={PAPER.equipEdge} strokeWidth={2}
          />
        )}
        <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={4} fill="#EDF2F6" stroke={PAPER.equipEdge} strokeWidth={2} />
        {node.sections.map((s, i) => {
          const sx = node.x + secW * i
          const cx = sx + secW / 2
          return (
            <g key={`${s.label}-${i}`}>
              {i > 0 && <line x1={sx} y1={node.y} x2={sx} y2={node.y + node.h} stroke={PAPER.equipEdge} strokeWidth={1.5} />}
              {s.icon === 'fan' && <FanIcon cx={cx} cy={node.y + node.h * 0.42} />}
              {s.icon === 'coil' && <CoilIcon cx={cx} cy={node.y + node.h * 0.42} w={Math.min(secW - 34, 132)} />}
              <text
                x={cx} y={node.y + node.h - 16} textAnchor="middle"
                fontSize={14} fontWeight={700} letterSpacing="0.09em" fill={PAPER.equipInk}
              >
                {s.label.toUpperCase()}
              </text>
            </g>
          )
        })}
        {node.underCoil && coilIdx >= 0 && (() => {
          const cx = node.x + secW * coilIdx + secW / 2
          const w = Math.min(secW - 34, 132)
          return (
            <g>
              <rect x={cx - w / 2} y={node.y + node.h - 4} width={w} height={22} rx={4} fill="#FFFFFF" stroke={TONES.water.fill} strokeWidth={2} />
              <path d={zigzag(cx - w / 2 + 8, node.y + node.h + 1, w - 16, 13, 5)} fill="none" stroke={TONES.water.fill} strokeWidth={2.2} />
            </g>
          )
        })()}
      </g>
    )
  }

  if (node.kind === 'room') {
    return (
      <g {...hit}>
        <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={6} fill="#DEE6ED" stroke={PAPER.ink} strokeWidth={5} />
        {node.photo ? (
          <image
            href={node.photo}
            x={node.x} y={node.y} width={node.w} height={node.h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#dgm-clip-${node.id})`}
          />
        ) : (
          <g>
            <rect x={node.x + 18} y={node.y + 18} width={node.w - 36} height={node.h - 36} rx={4} fill="none" stroke={PAPER.faint} strokeWidth={2} strokeDasharray="10 8" />
            <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 6} textAnchor="middle" fontSize={19} fontWeight={600} fill={PAPER.faint}>
              Add a photo of the space
            </text>
          </g>
        )}
        {node.caption ? (
          <text
            x={node.x + node.w / 2} y={node.y + node.h + 30} textAnchor="middle"
            fontSize={17} fontWeight={700} letterSpacing="0.05em" fill={PAPER.equipInk}
          >
            {node.caption.toUpperCase()}
          </text>
        ) : null}
      </g>
    )
  }

  // box
  const tone = TONES[node.tone]
  return (
    <g {...hit}>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={6} fill={PAPER.equipFill} stroke={PAPER.equipEdge} strokeWidth={2} />
      <rect x={node.x} y={node.y} width={5} height={node.h} rx={2.5} fill={tone.fill} />
      <text
        x={node.x + node.w / 2} y={node.y + node.h / 2 + (node.subtitle ? -4 : 6)} textAnchor="middle"
        fontSize={17} fontWeight={700} letterSpacing="0.06em" fill={PAPER.equipInk}
      >
        {node.title.toUpperCase()}
      </text>
      {node.subtitle ? (
        <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 24} textAnchor="middle" fontSize={16} fill={PAPER.muted}>
          {node.subtitle}
        </text>
      ) : null}
    </g>
  )
}

function ChamberLabel({ text, cx, cy }: { text: string; cx: number; cy: number }) {
  const ls = lines(text)
  const start = cy - ((ls.length - 1) * 24) / 2 + 7
  return (
    <text x={cx} y={start} textAnchor="middle" fontSize={19} fontWeight={500} fill={PAPER.equipInk}>
      {ls.map((l, i) => (
        <tspan key={i} x={cx} dy={i === 0 ? 0 : 24}>{l}</tspan>
      ))}
    </text>
  )
}

function FanIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={27} fill="#FFFFFF" stroke={PAPER.equipInk} strokeWidth={2} />
      {[0, 90, 180, 270].map((a) => (
        <ellipse key={a} transform={`rotate(${a}) translate(0,-13)`} rx={5.5} ry={10} fill={PAPER.equipInk} opacity={0.7} />
      ))}
      <circle r={4} fill={PAPER.equipInk} />
    </g>
  )
}

function CoilIcon({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  const h = 46
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4} fill="#FFFFFF" stroke={TONES.supply.fill} strokeWidth={2.5} />
      <path d={zigzag(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20, 5)} fill="none" stroke={TONES.supply.fill} strokeWidth={2.5} />
    </g>
  )
}

// ─── callout cards ───────────────────────────────────────────────────────────

function CalloutCard({
  callout: c, selected, interactive, onSelect, onDragCard, onDragAnchor,
}: {
  callout: Callout
  selected: boolean
  interactive: boolean
  onSelect: () => void
  onDragCard: (e: ReactPointerEvent) => void
  onDragAnchor: (e: ReactPointerEvent) => void
}) {
  const tone = TONES[c.tone]
  const h = calloutHeight(c)
  const unitX = Math.min(100, Math.max(62, c.w * 0.42))

  return (
    <g>
      {c.anchor && (() => {
        const [ex, ey] = edgePoint(c.x + c.w / 2, c.y + h / 2, c.w / 2, h / 2, c.anchor)
        return (
          <g pointerEvents="none">
            <line x1={ex} y1={ey} x2={c.anchor[0]} y2={c.anchor[1]} stroke={PAPER.leader} strokeWidth={1.6} strokeDasharray="7 5" />
            <circle cx={c.anchor[0]} cy={c.anchor[1]} r={5} fill={PAPER.leader} />
          </g>
        )
      })()}

      <g
        onPointerDown={interactive ? (e) => { onSelect(); onDragCard(e) } : undefined}
        style={interactive ? { cursor: 'grab' } : undefined}
      >
        <rect x={c.x} y={c.y} width={c.w} height={h} rx={8} fill={PAPER.card} stroke={PAPER.cardEdge} strokeWidth={1.5} />
        <rect x={c.x} y={c.y} width={6} height={h} rx={3} fill={tone.fill} />
        <text
          x={c.x + 18} y={c.y + 24}
          fontSize={15.5} fontWeight={700} letterSpacing="0.06em" fill={tone.ink}
        >
          {c.title.toUpperCase()}
        </text>
        {c.rows.map((r, i) => {
          const by = c.y + 34 + 18 + i * 26
          return (
            <g key={i}>
              <text
                x={c.x + 18} y={by} fontSize={22} fontWeight={650} fill={PAPER.ink}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {r.value}
              </text>
              <text x={c.x + 18 + unitX} y={by} fontSize={14} fill={PAPER.muted}>{r.unit}</text>
            </g>
          )
        })}
      </g>

      {interactive && selected && (
        <g data-chrome="1">
          <rect
            x={c.x - 6} y={c.y - 6} width={c.w + 12} height={h + 12} rx={11}
            fill="none" stroke={SELECT} strokeWidth={2.5} pointerEvents="none"
          />
          {c.anchor && (
            <circle
              cx={c.anchor[0]} cy={c.anchor[1]} r={11}
              fill="#FFFFFF" fillOpacity={0.5} stroke={SELECT} strokeWidth={2.5}
              style={{ cursor: 'move' }}
              onPointerDown={onDragAnchor}
            />
          )}
        </g>
      )}
    </g>
  )
}

// ─── free labels ─────────────────────────────────────────────────────────────

function NoteText({
  note: n, selected, interactive, onSelect, onDrag,
}: {
  note: Note
  selected: boolean
  interactive: boolean
  onSelect: () => void
  onDrag: (e: ReactPointerEvent) => void
}) {
  const tone = TONES[n.tone]
  const ls = lines(n.text)
  const lh = n.size * 1.35
  const longest = ls.reduce((m, l) => Math.max(m, l.length), 0)

  // Plain notes anchor on the first baseline; ellipse notes centre on (x, y).
  const firstY = n.ellipse ? n.y - ((ls.length - 1) * lh) / 2 + n.size * 0.36 : n.y
  const anchor = n.ellipse ? 'middle' : n.align

  const rx = longest * n.size * (n.caps ? 0.36 : 0.31) + 30
  const ry = (ls.length * lh) / 2 + 20

  return (
    <g
      onPointerDown={interactive ? (e) => { onSelect(); onDrag(e) } : undefined}
      style={interactive ? { cursor: 'grab' } : undefined}
    >
      {n.ellipse && (
        <ellipse
          cx={n.x} cy={n.y} rx={rx} ry={ry}
          fill="#FFFFFF" fillOpacity={0.88} stroke={tone.fill} strokeWidth={2.5} strokeDasharray="10 7"
        />
      )}
      <text
        x={n.x} y={firstY} textAnchor={anchor}
        fontSize={n.size} fontWeight={n.weight} fill={tone.ink}
        letterSpacing={n.caps ? '0.09em' : '0'}
      >
        {ls.map((l, i) => (
          <tspan key={i} x={n.x} dy={i === 0 ? 0 : lh}>{n.caps ? l.toUpperCase() : l}</tspan>
        ))}
      </text>
      {interactive && selected && (() => {
        const w = n.ellipse ? rx * 2 : longest * n.size * (n.caps ? 0.36 : 0.31) + 16
        const left = n.ellipse || anchor === 'middle' ? n.x - w / 2 : anchor === 'end' ? n.x - w : n.x - 8
        const top = n.ellipse ? n.y - ry : n.y - n.size - 6
        const hgt = n.ellipse ? ry * 2 : ls.length * lh + 12
        return (
          <rect
            data-chrome="1" pointerEvents="none"
            x={left} y={top} width={w} height={hgt} rx={8}
            fill="none" stroke={SELECT} strokeWidth={2.5} strokeDasharray="7 5"
          />
        )
      })()}
    </g>
  )
}

// ─── export ──────────────────────────────────────────────────────────────────

/**
 * Serialise the live artboard into standalone SVG markup.
 *
 * Clones first so the editing chrome can be removed without touching what the
 * user is looking at, and pins width/height because a viewBox-only SVG has no
 * intrinsic size — an <img> would rasterise it at 300×150.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-chrome]').forEach((el) => el.remove())
  clone.setAttribute('width', String(ARTBOARD.w))
  clone.setAttribute('height', String(ARTBOARD.h))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.removeAttribute('style')
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

/**
 * Rasterise to PNG at `scale`× the artboard.
 *
 * Goes through a base64 data: URL rather than a blob: URL on purpose — an SVG
 * drawn from a blob URL taints the canvas in some engines, and a tainted canvas
 * makes toBlob() throw a SecurityError at the very last step.
 */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const markup = serializeSvg(svg)
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(markup)))
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not rasterise the diagram.'))
    i.src = `data:image/svg+xml;base64,${encoded}`
  })

  const canvas = document.createElement('canvas')
  canvas.width = ARTBOARD.w * scale
  canvas.height = ARTBOARD.h * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png')
  })
}

/** Tone lookup for the inspector swatches, so the studio never imports TONES twice. */
export { TONES as CANVAS_TONES }
