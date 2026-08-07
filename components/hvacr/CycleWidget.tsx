'use client'

/* The vapour-compression cycle in 3D — the course's opening model.
 *
 * Four component blocks on a loop, with refrigerant particles riding the four
 * tubes between them. Tube and particle colour is the state of the refrigerant
 * at that point in the loop (hot gas, warm liquid, cold mix, cool vapour), which
 * is the one thing this model exists to make obvious.
 */

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL, cssHex } from '@/lib/hvacr/palette'
import { Scene3D, SceneKey } from './Scene3D'
import { Slider, ToggleButton, WidgetFrame, WidgetHint } from './WidgetFrame'

const POSITIONS = {
  compressor: new THREE.Vector3(-3, 1.6, 0),
  condenser: new THREE.Vector3(3, 1.6, 0),
  metering: new THREE.Vector3(3, -1.6, 0),
  evaporator: new THREE.Vector3(-3, -1.6, 0),
} as const

const BLOCKS = [
  { key: 'compressor', color: MODEL.compressor },
  { key: 'condenser', color: MODEL.condenser },
  { key: 'metering', color: MODEL.metering },
  { key: 'evaporator', color: MODEL.evaporator },
] as const

/** Bows each run outward so the four tubes read as a loop, not a rectangle. */
function loopCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.CatmullRomCurve3 {
  const bow = a.y === b.y ? (a.y > 0 ? 0.5 : -0.5) : 0
  const mid1 = a.clone().lerp(b, 0.33)
  const mid2 = a.clone().lerp(b, 0.67)
  mid1.y += bow
  mid2.y += bow
  return new THREE.CatmullRomCurve3([a, mid1, mid2, b])
}

const RUNS = [
  { from: 'compressor', to: 'condenser', tube: MODEL.hotGas, dot: MODEL.particleHot, count: 4 },
  { from: 'condenser', to: 'metering', tube: MODEL.warmLiquid, dot: MODEL.particleWarm, count: 3 },
  { from: 'metering', to: 'evaporator', tube: MODEL.coldMix, dot: MODEL.particleCold, count: 4 },
  { from: 'evaporator', to: 'compressor', tube: MODEL.coolVapor, dot: MODEL.particleCool, count: 4 },
] as const

function CycleScene({ playing, speed }: { playing: boolean; speed: number }) {
  const curves = useMemo(
    () => RUNS.map((r) => loopCurve(POSITIONS[r.from], POSITIONS[r.to])),
    [],
  )

  const dots = useMemo(
    () =>
      RUNS.flatMap((run, ri) =>
        Array.from({ length: run.count }, (_, i) => ({
          curveIndex: ri,
          color: run.dot,
          offset: i / run.count,
        })),
      ),
    [],
  )

  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const t = useRef(0)

  useFrame((_, delta) => {
    if (playing) t.current = (t.current + delta * speed * 0.12) % 1
    dots.forEach((dot, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      const at = (t.current + dot.offset) % 1
      mesh.position.copy(curves[dot.curveIndex].getPointAt(at))
    })
  })

  return (
    <group>
      {BLOCKS.map((b) => (
        <mesh key={b.key} position={POSITIONS[b.key]}>
          <boxGeometry args={[1.6, 1, 1.2]} />
          <meshStandardMaterial color={b.color} roughness={0.5} metalness={0.15} />
        </mesh>
      ))}

      {RUNS.map((run, i) => (
        <mesh key={run.from}>
          <tubeGeometry args={[curves[i], 40, 0.09, 8, false]} />
          <meshStandardMaterial color={run.tube} roughness={0.4} />
        </mesh>
      ))}

      {dots.map((dot, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
        >
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color={dot.color} />
        </mesh>
      ))}
    </group>
  )
}

export default function CycleWidget() {
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  return (
    <WidgetFrame
      caption="Rotate, zoom, and watch refrigerant flow through a full vapour-compression cycle. Colour is the state of the refrigerant at that point in the loop."
      controls={
        <>
          <ToggleButton active={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause' : 'Play'}
          </ToggleButton>
          <Slider
            label="Flow speed"
            min={0.3}
            max={3}
            step={0.1}
            value={speed}
            onChange={setSpeed}
            readout={`${speed.toFixed(1)}×`}
          />
          <WidgetHint>Drag to rotate · scroll to zoom</WidgetHint>
        </>
      }
    >
      <Scene3D
        label="refrigeration cycle"
        camera={{ x: 8, y: 6, z: 10 }}
        autoRotate
        overlay={
          <SceneKey
            items={[
              { color: cssHex(MODEL.compressor), label: 'Compressor' },
              { color: cssHex(MODEL.condenser), label: 'Condenser' },
              { color: cssHex(MODEL.metering), label: 'Metering device' },
              { color: cssHex(MODEL.evaporator), label: 'Evaporator' },
            ]}
          />
        }
      >
        <CycleScene playing={playing} speed={speed} />
      </Scene3D>
    </WidgetFrame>
  )
}
