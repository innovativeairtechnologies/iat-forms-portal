'use client'

/* A thermostatic expansion valve that responds to superheat.
 *
 * The whole point of a TXV is a feedback loop most people take on faith: the
 * bulb senses suction-line temperature, bulb pressure pushes the diaphragm, the
 * diaphragm moves the needle, and the needle sets how much refrigerant gets in.
 * Drag the slider and the loop runs in front of you.
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL } from '@/lib/hvacr/palette'
import { Scene3D, SceneLegend } from './Scene3D'
import { Slider, WidgetFrame, WidgetHint } from './WidgetFrame'

const PARTICLES = 6

/** Superheat (°F) → valve opening (0–1). The 4–18°F band is the working range
 *  the source course used; outside it the valve is at a stop, not linear. */
function openingFor(superheat: number): number {
  return Math.min(1, Math.max(0.04, (superheat - 4) / 14))
}

function TxvScene({ superheat }: { superheat: number }) {
  const opening = openingFor(superheat)
  const needle = useRef<THREE.Mesh>(null)
  const diaphragm = useRef<THREE.Mesh>(null)
  const flow = useRef<(THREE.Mesh | null)[]>([])
  const t = useRef(0)

  const springCurve = useRef(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 41 }, (_, i) => {
        const ang = i * 1.4
        return new THREE.Vector3(Math.cos(ang) * 0.22, 0.2 + (i / 40) * 1.1, Math.sin(ang) * 0.22)
      }),
    ),
  ).current

  useFrame((_, delta) => {
    if (needle.current) needle.current.position.x = -1.05 + opening * 0.55
    if (diaphragm.current) diaphragm.current.position.y = 1.5 + opening * 0.15

    t.current += delta * (0.35 + opening * 1.2)
    flow.current.forEach((mesh, i) => {
      if (!mesh) return
      const at = (t.current + i / PARTICLES) % 1
      mesh.position.x = -1.6 + at * 3.2
      // Droplet size tracks the opening: a nearly-closed valve passes a trickle.
      mesh.scale.setScalar((0.05 + opening * 0.12) / 0.1)
      mesh.visible = opening > 0.03
    })
  })

  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.75, 0.75, 2.4, 24]} />
        <meshStandardMaterial color={MODEL.steel} metalness={0.4} roughness={0.5} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.4, 16]} />
        <meshStandardMaterial color={MODEL.darkSteel} />
      </mesh>

      <mesh ref={needle} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.16, 0.9, 16]} />
        <meshStandardMaterial color={MODEL.compressor} metalness={0.5} />
      </mesh>

      <mesh ref={diaphragm} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.12, 24]} />
        <meshStandardMaterial color={MODEL.coldMix} />
      </mesh>

      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color={MODEL.steel} />
      </mesh>

      <mesh position={[0, 3.2, 0]}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshStandardMaterial color={MODEL.brass} />
      </mesh>

      <mesh>
        <tubeGeometry args={[springCurve, 100, 0.03, 6, false]} />
        <meshStandardMaterial color={MODEL.metering} />
      </mesh>

      {Array.from({ length: PARTICLES }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            flow.current[i] = m
          }}
        >
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshBasicMaterial color={MODEL.particleCold} />
        </mesh>
      ))}
    </group>
  )
}

export default function TxvWidget() {
  const [superheat, setSuperheat] = useState(10)
  const opening = openingFor(superheat)

  return (
    <WidgetFrame
      caption="Drag the superheat slider and watch the needle respond. This is exactly how a TXV self-regulates — no controller, no wiring, just pressure balance."
      controls={
        <>
          <Slider
            label="Suction-line superheat"
            min={2}
            max={20}
            step={0.5}
            value={superheat}
            onChange={setSuperheat}
            readout={`${superheat.toFixed(1)}°F`}
          />
          <WidgetHint>
            Valve {Math.round(opening * 100)}% open · drag to rotate · scroll to zoom
          </WidgetHint>
        </>
      }
    >
      <Scene3D
        label="expansion valve"
        camera={{ x: 5, y: 3, z: 7 }}
        overlay={
          <SceneLegend>
            The sensing bulb (orange) reads suction-line temperature. More superheat means higher bulb
            pressure, which pushes the diaphragm down and opens the needle (red) further — feeding more
            refrigerant until superheat comes back to setpoint.
          </SceneLegend>
        }
      >
        <TxvScene superheat={superheat} />
      </Scene3D>
    </WidgetFrame>
  )
}
