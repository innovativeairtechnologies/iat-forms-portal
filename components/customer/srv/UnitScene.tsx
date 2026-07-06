'use client'

/**
 * Stylized 3D IAT desiccant dehumidifier for the interactive SRV.
 *
 * Modeled procedurally (no glTF asset) from the U2573-3 outline drawing of an
 * IAT-600RE/IDP: 1845×900×1085mm cabinet on 3.5" legs, control box on top,
 * process inlet hopper left, react inlet right, blower on the left end, coil
 * access box + react outlet on the top rear. Dimensions are meters. Being
 * code-built keeps the route payload tiny (no multi-MB model download on a
 * job-site connection) and lets hotspot anchors live next to the geometry.
 *
 * The numbered hotspots are SRV sections; their look mirrors the engineering
 * drawing's balloon callouts on purpose.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, ContactShadows, Edges } from '@react-three/drei'
import { useRef, useState, useEffect, useMemo } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { Check } from 'lucide-react'

export type HotspotState = 'todo' | 'partial' | 'done' | 'na'

export type SceneHotspot = {
  key: string
  number: number
  label: string
  state: HotspotState
  failures: number
}

const HOTSPOT_POSITIONS: Record<string, [number, number, number]> = {
  equipment_condition: [0.28, 0.66, 0.5],
  ductwork: [-1.14, 0.46, 0.3],
  electrical: [0.64, 1.62, 0.12],
  fans_motors: [-1.16, 0.92, -0.02],
  gas: [0.58, 1.26, -0.16],
  coils: [-0.42, 1.4, -0.16],
  refrigeration: [-0.45, 0.66, 0.5],
  controls: [0.28, 1.45, 0.37],
  condensate: [0.72, 0.16, 0.5],
  site_readiness: [1.5, 0.06, 1.12],
}

// ── Palette (physical unit stays light in both themes) ───────────────────────
const CABINET = '#d7dce2'
const PANEL = '#e3e7ec'
const EDGE = '#94a0ad'
const DARK = '#3f4650'
const STEEL = '#aeb8c2'

function Mat({ color, ...rest }: { color: string } & Record<string, unknown>) {
  return <meshStandardMaterial color={color} roughness={0.82} metalness={0.15} {...rest} />
}

/** Box with drawing-style edge lines. */
function Part({
  size, position, rotation, color = CABINET, edge = EDGE,
}: {
  size: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  edge?: string | null
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <Mat color={color} />
      {edge && <Edges linewidth={1} scale={1.001} color={edge} />}
    </mesh>
  )
}

function Cyl({
  r, len, position, rotation, color = STEEL, seg = 24,
}: {
  r: number
  len: number
  position: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  seg?: number
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[r, r, len, seg]} />
      <Mat color={color} />
    </mesh>
  )
}

const LEG_H = 0.089
const BODY = { l: 1.845, h: 1.085, d: 0.9 }
const BODY_TOP = LEG_H + BODY.h // 1.174

/** Front door panels: proud inset plates with latch handles, per the outline drawing. */
function FrontPanels() {
  // Door x-centers/widths across the 1.845 body (left → right).
  const doors: Array<{ x: number; w: number }> = [
    { x: -0.72, w: 0.33 },
    { x: -0.3, w: 0.46 },
    { x: 0.18, w: 0.44 },
    { x: 0.64, w: 0.42 },
  ]
  const z = BODY.d / 2 + 0.008
  return (
    <group>
      {doors.map((d, i) => (
        <group key={i}>
          <Part size={[d.w, BODY.h - 0.1, 0.016]} position={[d.x, LEG_H + BODY.h / 2, z]} color={PANEL} />
          {/* Latch handles — two per door like the drawing */}
          <Part size={[0.1, 0.028, 0.03]} position={[d.x, LEG_H + BODY.h * 0.72, z + 0.02]} color={DARK} edge={null} />
          <Part size={[0.1, 0.028, 0.03]} position={[d.x, LEG_H + BODY.h * 0.28, z + 0.02]} color={DARK} edge={null} />
        </group>
      ))}
      {/* Rotor observation window on the center door (green like the drawing) */}
      <mesh position={[0.18, LEG_H + BODY.h * 0.55, z + 0.012]}>
        <boxGeometry args={[0.11, 0.11, 0.01]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {/* Vertical door-edge pulls on the center door */}
      <Part size={[0.026, 0.16, 0.03]} position={[0.02, LEG_H + BODY.h * 0.62, z + 0.02]} color={DARK} edge={null} />
      <Part size={[0.026, 0.16, 0.03]} position={[0.02, LEG_H + BODY.h * 0.34, z + 0.02]} color={DARK} edge={null} />
      {/* Nameplate on the right door */}
      <Part size={[0.14, 0.09, 0.008]} position={[0.78, LEG_H + BODY.h * 0.62, z + 0.016]} color="#c3cad2" />
    </group>
  )
}

function UnitModel() {
  return (
    <group>
      {/* Mounting legs (3.5") */}
      {[-0.85, 0, 0.85].map((x) =>
        [-0.36, 0.36].map((z) => (
          <Part key={`${x}${z}`} size={[0.09, LEG_H, 0.09]} position={[x, LEG_H / 2, z]} color={STEEL} edge={null} />
        ))
      )}

      {/* Main cabinet */}
      <Part size={[BODY.l, BODY.h, BODY.d]} position={[0, LEG_H + BODY.h / 2, 0]} />
      <FrontPanels />

      {/* Elec control box on top (front) with HMI + power entry */}
      <group>
        <Part size={[0.62, 0.7, 0.46]} position={[0.28, BODY_TOP + 0.35, 0.1]} color={PANEL} />
        <mesh position={[0.28, BODY_TOP + 0.44, 0.1 + 0.235]}>
          <boxGeometry args={[0.17, 0.12, 0.01]} />
          <meshStandardMaterial color="#1c2733" emissive="#38bdf8" emissiveIntensity={0.18} roughness={0.35} />
        </mesh>
        {/* Status pilot lights */}
        {[0.16, 0.24, 0.32].map((dx, i) => (
          <mesh key={dx} position={[0.06 + dx, BODY_TOP + 0.58, 0.1 + 0.235]}>
            <cylinderGeometry args={[0.012, 0.012, 0.012, 12]} />
            <meshStandardMaterial
              color={['#f59e0b', '#10b981', '#ef4444'][i]}
              emissive={['#f59e0b', '#10b981', '#ef4444'][i]}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
        {/* Power input, top right of control box (item 7) */}
        <Cyl r={0.028} len={0.09} position={[0.62, BODY_TOP + 0.6, 0.1]} rotation={[0, 0, Math.PI / 2]} color={DARK} />
      </group>

      {/* Coil access box — top rear-left */}
      <Part size={[0.68, 0.26, 0.44]} position={[-0.42, BODY_TOP + 0.13, -0.18]} color={PANEL} />

      {/* React outlet — 6" round with weather cap, top rear-left */}
      <group position={[-0.8, 0, -0.3]}>
        <Cyl r={0.076} len={0.3} position={[0, BODY_TOP + 0.15, 0]} color={STEEL} />
        <Cyl r={0.09} len={0.05} position={[0, BODY_TOP + 0.32, 0]} color={DARK} />
      </group>

      {/* Process outlet — 8"×4" stub on top right */}
      <Part size={[0.2, 0.13, 0.11]} position={[0.78, BODY_TOP + 0.065, 0.18]} color={STEEL} />

      {/* React air blower — motor on the left end */}
      <group position={[-(BODY.l / 2), 0.95, -0.05]}>
        <Part size={[0.3, 0.34, 0.34]} position={[-0.02, -0.03, 0]} color={PANEL} />
        <Cyl r={0.115} len={0.26} position={[-0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]} color={DARK} seg={20} />
        <Cyl r={0.05} len={0.08} position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} color={STEEL} />
      </group>

      {/* Process inlet hopper — left, low (12"×24" transition) */}
      <group position={[-(BODY.l / 2) - 0.14, 0.38, 0.12]}>
        <Part size={[0.42, 0.3, 0.58]} position={[0, 0, 0]} rotation={[0, 0, -0.55]} color={CABINET} />
        <Part size={[0.02, 0.4, 0.62]} position={[-0.22, -0.12, 0]} rotation={[0, 0, -0.15]} color={STEEL} />
      </group>

      {/* React inlet — duct stub + hopper on the right end */}
      <group position={[BODY.l / 2, 0, 0]}>
        <Part size={[0.26, 0.3, 0.3]} position={[0.12, 0.98, -0.22]} color={STEEL} />
        <Part size={[0.36, 0.26, 0.5]} position={[0.14, 0.74, 0.12]} rotation={[0, 0, 0.5]} color={CABINET} />
      </group>

      {/* Coil connections — 7/8" supply & return, rear right, low */}
      <Cyl r={0.02} len={0.12} position={[0.55, 0.25, -(BODY.d / 2) - 0.05]} rotation={[Math.PI / 2, 0, 0]} color="#b87333" />
      <Cyl r={0.02} len={0.12} position={[0.55, 0.33, -(BODY.d / 2) - 0.05]} rotation={[Math.PI / 2, 0, 0]} color="#b87333" />

      {/* Condensate drain — front right, at the base */}
      <Cyl r={0.026} len={0.12} position={[0.72, 0.14, BODY.d / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]} color={STEEL} />
    </group>
  )
}

/** Faint floor ring — the "site readiness" zone around the unit. */
function SiteRing({ active }: { active: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <ringGeometry args={[1.62, 1.68, 64]} />
      <meshBasicMaterial color="#10b981" transparent opacity={active ? 0.5 : 0.18} />
    </mesh>
  )
}

const CHIP_STYLE: Record<HotspotState, string> = {
  todo: 'border-zinc-400/80 bg-white/95 text-zinc-600',
  partial: 'border-amber-500 bg-amber-50/95 text-amber-700',
  done: 'border-emerald-500 bg-emerald-500 text-white',
  na: 'border-zinc-300 bg-zinc-100/90 text-zinc-400',
}

function Hotspot({
  spot, selected, onSelect,
}: {
  spot: SceneHotspot
  selected: boolean
  onSelect: (key: string) => void
}) {
  const pos = HOTSPOT_POSITIONS[spot.key]
  if (!pos) return null
  return (
    <Html position={pos} center distanceFactor={4.5} zIndexRange={[30, 10]}>
      <button
        type="button"
        onClick={() => onSelect(spot.key)}
        className="group flex flex-col items-center gap-1 outline-none"
        style={{ touchAction: 'manipulation' }}
        aria-label={`Section ${spot.number}: ${spot.label}`}
      >
        <span
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-bold shadow-md backdrop-blur-sm transition-transform group-hover:scale-110 ${CHIP_STYLE[spot.state]} ${selected ? 'ring-4 ring-emerald-500/30 scale-110' : ''}`}
        >
          {spot.state === 'done' ? <Check size={16} strokeWidth={3} /> : spot.number}
          {spot.failures > 0 && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
          )}
          {spot.state === 'todo' && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400/40 [animation-duration:2.5s]" />
          )}
        </span>
        <span className="whitespace-nowrap rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 shadow-sm backdrop-blur-sm">
          {spot.label}
        </span>
      </button>
    </Html>
  )
}

/** Eases the orbit target toward the selected hotspot so tapping a balloon "walks over" to it. */
function CameraRig({ selectedKey, controlsRef }: {
  selectedKey: string | null
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const goal = useMemo(() => {
    const p = selectedKey ? HOTSPOT_POSITIONS[selectedKey] : null
    return p ? new THREE.Vector3(p[0] * 0.7, Math.min(p[1], 1.2), p[2] * 0.7) : new THREE.Vector3(0, 0.7, 0)
  }, [selectedKey])
  useFrame((_, dt) => {
    const c = controlsRef.current
    if (!c) return
    c.target.lerp(goal, Math.min(dt * 3, 1))
    c.update()
  })
  return null
}

function SceneReady({ onReady }: { onReady?: () => void }) {
  const ready = useRef(false)
  useThree() // ensures we're inside the canvas lifecycle
  useEffect(() => {
    if (!ready.current) { ready.current = true; onReady?.() }
  }, [onReady])
  return null
}

export default function UnitScene({
  hotspots, selectedKey, onSelect, onReady,
}: {
  hotspots: SceneHotspot[]
  selectedKey: string | null
  onSelect: (key: string) => void
  onReady?: () => void
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const [interacted, setInteracted] = useState(false)
  const siteActive = selectedKey === 'site_readiness'

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 38, position: [3.6, 2.3, 4.0] }}
      onPointerDown={() => setInteracted(true)}
      style={{ touchAction: 'none' }}
    >
      <SceneReady onReady={onReady} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[4, 7, 4]} intensity={0.9} />
      <directionalLight position={[-5, 3, -3]} intensity={0.35} />

      <UnitModel />
      <SiteRing active={siteActive} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.32} scale={7} blur={2.2} far={2.5} resolution={512} />

      {hotspots.map((s) => (
        <Hotspot key={s.key} spot={s} selected={selectedKey === s.key} onSelect={onSelect} />
      ))}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={2.2}
        maxDistance={7}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={!interacted && !selectedKey}
        autoRotateSpeed={0.6}
        target={[0, 0.7, 0]}
      />
      <CameraRig selectedKey={selectedKey} controlsRef={controlsRef} />
    </Canvas>
  )
}
