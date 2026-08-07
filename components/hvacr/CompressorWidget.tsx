'use client'

/* Two compressor types side by side, so the difference in *mechanism* is
 * visible rather than described.
 *
 * Reciprocating: a piston on a crank, with suction and discharge flaps that
 * open on opposite halves of the stroke.
 *
 * Scroll: the orbiting scroll does not rotate — it orbits. That single fact is
 * the one people get wrong, so the model makes it the thing you can see.
 */

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL } from '@/lib/hvacr/palette'
import { Scene3D, SceneLegend } from './Scene3D'
import { ToggleButton, WidgetFrame, WidgetHint } from './WidgetFrame'

/* ── Reciprocating ────────────────────────────────────────────────────────── */

const CRANK_RADIUS = 0.55
const ROD_LEN = 1.6
const BASE_Y = -0.9

function ReciprocatingScene() {
  const piston = useRef<THREE.Mesh>(null)
  const rod = useRef<THREE.Mesh>(null)
  const crank = useRef<THREE.Mesh>(null)
  const pin = useRef<THREE.Mesh>(null)
  const suction = useRef<THREE.Mesh>(null)
  const discharge = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const theta = clock.getElapsedTime() * 1.6
    const pistonY = BASE_Y + ROD_LEN * 0.5 + Math.sin(theta) * 0.55 + 0.55

    if (piston.current) piston.current.position.y = pistonY
    if (rod.current) rod.current.position.y = (pistonY + BASE_Y) / 2 + 0.4
    if (crank.current) crank.current.rotation.z = theta
    if (pin.current) {
      pin.current.position.x = CRANK_RADIUS * Math.sin(theta) * 0.3
      pin.current.position.y = BASE_Y + CRANK_RADIUS * Math.cos(theta) * 0.3
    }
    // Valves are one-way: discharge cracks near top dead centre, suction near
    // bottom. Modelled as a snap rather than a curve — that is how a reed valve
    // actually behaves.
    if (discharge.current) discharge.current.rotation.x = Math.sin(theta) > 0.85 ? -0.6 : 0
    if (suction.current) suction.current.rotation.x = Math.sin(theta) < -0.85 ? 0.6 : 0
  })

  return (
    <group>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 2.6, 32, 1, true]} />
        <meshStandardMaterial
          color={MODEL.glass}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={piston}>
        <cylinderGeometry args={[1, 1, 0.5, 32]} />
        <meshStandardMaterial color={MODEL.compressor} roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh ref={rod}>
        <cylinderGeometry args={[0.12, 0.12, ROD_LEN, 12]} />
        <meshStandardMaterial color={MODEL.steel} />
      </mesh>

      <mesh ref={crank} position={[0, BASE_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CRANK_RADIUS, 0.14, 12, 24]} />
        <meshStandardMaterial color={MODEL.metering} />
      </mesh>

      <mesh ref={pin}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={MODEL.brass} />
      </mesh>

      <mesh ref={suction} position={[-0.7, 2.55, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color={MODEL.coldMix} />
      </mesh>
      <mesh ref={discharge} position={[0.7, 2.55, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color={MODEL.condenser} />
      </mesh>
    </group>
  )
}

/* ── Scroll ───────────────────────────────────────────────────────────────── */

function spiral(turns: number, a: number, b: number, dir: 1 | -1, z: number): THREE.Vector3[] {
  const steps = 140
  return Array.from({ length: steps + 1 }, (_, i) => {
    const theta = (i / steps) * turns * Math.PI * 2
    const r = a + b * theta
    return new THREE.Vector3(dir * r * Math.cos(theta), z, r * Math.sin(theta))
  })
}

const ORBIT_RADIUS = 0.16

function ScrollScene() {
  const orbiting = useRef<THREE.Group>(null)

  const fixedCurve = useMemo(() => new THREE.CatmullRomCurve3(spiral(2.1, 0.15, 0.16, 1, 0)), [])
  const orbitCurve = useMemo(() => new THREE.CatmullRomCurve3(spiral(2.1, 0.15, 0.16, -1, 0.3)), [])

  useFrame(({ clock }) => {
    const theta = clock.getElapsedTime() * 3.2
    // Position only — never rotation. The orbiting scroll translates in a small
    // circle while keeping its orientation, which is what lets the gas pockets
    // close progressively toward the centre.
    orbiting.current?.position.set(
      ORBIT_RADIUS * Math.cos(theta),
      0.05 * Math.sin(theta * 2),
      ORBIT_RADIUS * Math.sin(theta),
    )
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[fixedCurve, 200, 0.08, 8, false]} />
        <meshStandardMaterial color={MODEL.metering} />
      </mesh>

      <group ref={orbiting}>
        <mesh>
          <tubeGeometry args={[orbitCurve, 200, 0.08, 8, false]} />
          <meshStandardMaterial color={MODEL.evaporator} />
        </mesh>
      </group>

      <mesh>
        <cylinderGeometry args={[1.9, 1.9, 0.7, 48, 1, true]} />
        <meshStandardMaterial
          color={MODEL.glass}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/* ── Widget ───────────────────────────────────────────────────────────────── */

export default function CompressorWidget() {
  const [kind, setKind] = useState<'recip' | 'scroll'>('recip')

  return (
    <WidgetFrame
      caption="Two compressor types, animated. Switch tabs to compare how each one actually compresses refrigerant."
      tabs={
        <>
          <ToggleButton active={kind === 'recip'} onClick={() => setKind('recip')}>
            Reciprocating (piston)
          </ToggleButton>
          <ToggleButton active={kind === 'scroll'} onClick={() => setKind('scroll')}>
            Scroll
          </ToggleButton>
        </>
      }
      controls={<WidgetHint>Drag to rotate · scroll to zoom</WidgetHint>}
    >
      {kind === 'recip' ? (
        <Scene3D
          key="recip"
          label="reciprocating compressor"
          camera={{ x: 6, y: 4, z: 8 }}
          overlay={
            <SceneLegend>
              A piston (red) moves up and down inside the cylinder, driven by the crankshaft (violet).
              The suction (blue) and discharge (orange) valve flaps each open on only their half of the
              stroke.
            </SceneLegend>
          }
        >
          <ReciprocatingScene />
        </Scene3D>
      ) : (
        <Scene3D
          key="scroll"
          label="scroll compressor"
          camera={{ x: 0, y: 7, z: 0.001 }}
          overlay={
            <SceneLegend>
              The green scroll <strong className="font-semibold">orbits</strong> around the fixed violet
              scroll — it does not rotate. Gas pockets trapped between the spirals shrink toward the
              centre, and that shrinking is the compression.
            </SceneLegend>
          }
        >
          <ScrollScene />
        </Scene3D>
      )}
    </WidgetFrame>
  )
}
