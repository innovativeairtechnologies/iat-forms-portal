'use client'

/* One coil model serving both the condenser and the evaporator subject.
 *
 * They are the same machine running the same way in opposite directions, so
 * they are the same component with a `coil` param: the condenser takes cool air
 * in and sends it out hot, the evaporator does the reverse. Particles change
 * colour as they cross the coil, which is the heat transfer.
 *
 * The fault toggle is the teaching moment. A fouled condenser and an iced
 * evaporator are different words for the same failure — air stopped moving —
 * and the model shows the same thing happening in both.
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL } from '@/lib/hvacr/palette'
import { Scene3D, SceneLegend } from './Scene3D'
import { ToggleButton, WidgetFrame, WidgetHint } from './WidgetFrame'

const PARTICLES = 10

type CoilKind = 'condenser' | 'evaporator'

const SPEC: Record<
  CoilKind,
  {
    coilColor: number
    fanX: number
    dir: 1 | -1
    inColor: number
    outColor: number
    caption: string
    legend: string
    okLabel: string
    faultLabel: string
    faultLegend: string
  }
> = {
  condenser: {
    coilColor: MODEL.condenser,
    fanX: -2.4,
    dir: 1,
    inColor: MODEL.particleCold,
    outColor: MODEL.hotGas,
    caption:
      'Cool ambient air (blue) picks up heat as it crosses the coil and leaves warmer (orange). Try the dirty-coil toggle.',
    legend:
      'The condenser rejects heat. Air enters cool, leaves warm, and the refrigerant inside gives up enough heat to condense into a liquid.',
    okLabel: 'Clean coil',
    faultLabel: 'Dirty / blocked coil',
    faultLegend:
      'Debris blocks the face and the fan slows. Less air across the coil means less heat rejected, so head pressure climbs — the single most common summer service call.',
  },
  evaporator: {
    coilColor: MODEL.evaporator,
    fanX: 2.4,
    dir: -1,
    inColor: MODEL.hotGas,
    outColor: MODEL.particleCold,
    caption:
      'Warm room air (orange) gives up heat crossing the cold coil and leaves cooler (blue). Toggle frost to see what restricted airflow looks like.',
    legend:
      'The evaporator absorbs heat. Air enters warm, leaves cool, and the refrigerant inside picks up enough heat to boil into a vapour.',
    okLabel: 'Normal operation',
    faultLabel: 'Frosted / iced coil',
    faultLegend:
      'Ice blocks the fins and airflow collapses. Less air means the coil runs colder still, which makes more ice — a runaway the defrost cycle exists to break.',
  },
}

function CoilScene({ kind, fault }: { kind: CoilKind; fault: boolean }) {
  const spec = SPEC[kind]
  const blades = useRef<THREE.Group>(null)
  const flow = useRef<(THREE.Mesh | null)[]>([])
  const offsets = useRef(
    Array.from({ length: PARTICLES }, (_, i) => ({
      t: i / PARTICLES,
      y: (i / PARTICLES - 0.5) * 1.8,
      z: (((i * 7) % PARTICLES) / PARTICLES - 0.5) * 1.8,
    })),
  ).current

  const inColor = useRef(new THREE.Color(spec.inColor)).current
  const outColor = useRef(new THREE.Color(spec.outColor)).current

  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.x += delta * (fault ? 4 : 10)

    const speed = fault ? 0.15 : 0.45
    offsets.forEach((p, i) => {
      const mesh = flow.current[i]
      if (!mesh) return
      p.t = (p.t + delta * speed * 0.6) % 1
      mesh.position.set(spec.dir * (-2.6 + p.t * 5.2), p.y, p.z)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.copy(inColor).lerp(outColor, p.t)
      // A blocked coil only passes air near the centre — the outer streamlines
      // simply stop arriving, which is what "restricted airflow" looks like.
      mesh.visible = !(fault && p.t > 0.15 && p.t < 0.85 && (Math.abs(p.y) > 0.5 || Math.abs(p.z) > 0.5))
    })
  })

  return (
    <group>
      <mesh>
        <boxGeometry args={[0.4, 2.2, 2.2]} />
        <meshStandardMaterial color={spec.coilColor} metalness={0.3} roughness={0.5} />
      </mesh>

      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[(i - 4) * 0.2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.02, 2.2]} />
          <meshStandardMaterial color={MODEL.fin} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <mesh position={[spec.fanX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
        <meshStandardMaterial color={MODEL.steel} />
      </mesh>

      <group ref={blades} position={[spec.fanX, 0, 0]}>
        {Array.from({ length: 4 }, (_, b) => (
          <group key={b} rotation={[(b * Math.PI) / 2, 0, 0]}>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.05, 1.1, 0.28]} />
              <meshStandardMaterial color={MODEL.coldMix} />
            </mesh>
          </group>
        ))}
      </group>

      {offsets.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            flow.current[i] = m
          }}
        >
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color={spec.inColor} />
        </mesh>
      ))}
    </group>
  )
}

export default function CoilWidget({ coil }: { coil?: string }) {
  const kind: CoilKind = coil === 'evaporator' ? 'evaporator' : 'condenser'
  const spec = SPEC[kind]
  const [fault, setFault] = useState(false)

  return (
    <WidgetFrame
      caption={spec.caption}
      controls={
        <>
          <div className="flex gap-1.5">
            <ToggleButton active={!fault} onClick={() => setFault(false)}>
              {spec.okLabel}
            </ToggleButton>
            <ToggleButton active={fault} onClick={() => setFault(true)}>
              {spec.faultLabel}
            </ToggleButton>
          </div>
          <WidgetHint>Drag to rotate · scroll to zoom</WidgetHint>
        </>
      }
    >
      <Scene3D
        label={kind}
        camera={{ x: 6, y: 3.5, z: 8 }}
        overlay={<SceneLegend>{fault ? spec.faultLegend : spec.legend}</SceneLegend>}
      >
        <CoilScene kind={kind} fault={fault} />
      </Scene3D>
    </WidgetFrame>
  )
}
