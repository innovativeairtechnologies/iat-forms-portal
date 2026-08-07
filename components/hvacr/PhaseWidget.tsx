'use client'

/* Phase change as molecular agitation.
 *
 * The slider is "heat added", not temperature — which is the point. Through the
 * melting and boiling bands the particles keep gaining energy while the readout
 * says the temperature holds steady. That is latent heat, and it is the idea the
 * whole refrigeration cycle rests on.
 */

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL } from '@/lib/hvacr/palette'
import { Scene3D, SceneLegend } from './Scene3D'
import { Slider, WidgetFrame, WidgetHint } from './WidgetFrame'

type Phase = { name: string; agitation: number; mode: 'vibrate' | 'drift' | 'free'; latent: boolean }

function phaseFor(v: number): Phase {
  if (v < 20) return { name: 'Solid', agitation: v / 20, mode: 'vibrate', latent: false }
  if (v < 30) return { name: 'Melting', agitation: 1, mode: 'vibrate', latent: true }
  if (v < 70) return { name: 'Liquid', agitation: (v - 30) / 40, mode: 'drift', latent: false }
  if (v < 80) return { name: 'Boiling', agitation: 1, mode: 'drift', latent: true }
  return { name: 'Vapour', agitation: (v - 80) / 20, mode: 'free', latent: false }
}

function PhaseScene({ heat }: { heat: number }) {
  const phase = phaseFor(heat)
  const meshes = useRef<(THREE.Mesh | null)[]>([])

  const particles = useMemo(() => {
    const out: { base: THREE.Vector3; vel: THREE.Vector3; seed: number }[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          out.push({
            base: new THREE.Vector3(x, y, z),
            vel: new THREE.Vector3(
              (Math.random() - 0.5) * 0.02,
              (Math.random() - 0.5) * 0.02,
              (Math.random() - 0.5) * 0.02,
            ),
            seed: Math.random() * 100,
          })
        }
      }
    }
    return out
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    particles.forEach((p, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return

      if (phase.mode === 'vibrate') {
        // Locked to a lattice site, just jittering harder as heat goes in.
        const amp = 0.05 + phase.agitation * 0.18
        mesh.position.set(
          p.base.x + Math.sin(t * 8 + p.seed) * amp,
          p.base.y + Math.cos(t * 7.3 + p.seed) * amp,
          p.base.z + Math.sin(t * 6.1 + p.seed * 1.3) * amp,
        )
      } else if (phase.mode === 'drift') {
        // Free to move past each other, still bounded by the container.
        const speed = 0.004 + phase.agitation * 0.012
        mesh.position.x += Math.sin(t * 2 + p.seed) * speed
        mesh.position.y += Math.cos(t * 2.3 + p.seed) * speed
        mesh.position.z += Math.sin(t * 1.7 + p.seed * 1.5) * speed
        mesh.position.clamp(new THREE.Vector3(-1.7, -1.7, -1.7), new THREE.Vector3(1.7, 1.7, 1.7))
      } else {
        mesh.position.addScaledVector(p.vel, 1 + phase.agitation * 3)
        for (const axis of ['x', 'y', 'z'] as const) {
          if (Math.abs(mesh.position[axis]) > 2.9) p.vel[axis] *= -1
        }
        mesh.position.clamp(new THREE.Vector3(-2.9, -2.9, -2.9), new THREE.Vector3(2.9, 2.9, 2.9))
      }
    })
  })

  return (
    <group>
      <mesh>
        <boxGeometry args={[3, 3, 3]} />
        <meshBasicMaterial color={MODEL.coldMix} wireframe transparent opacity={0.4} />
      </mesh>
      {particles.map((p, i) => (
        <mesh
          key={i}
          position={p.base}
          ref={(m) => {
            meshes.current[i] = m
          }}
        >
          <sphereGeometry args={[0.18, 14, 14]} />
          <meshStandardMaterial color={MODEL.evaporator} />
        </mesh>
      ))}
    </group>
  )
}

export default function PhaseWidget() {
  const [heat, setHeat] = useState(20)
  const phase = phaseFor(heat)

  return (
    <WidgetFrame
      caption="Drag the heat slider. Watch the particles go from vibrating in place, to sliding past each other, to flying free."
      controls={
        <>
          <Slider
            label="Heat added"
            min={0}
            max={100}
            step={1}
            value={heat}
            onChange={setHeat}
            readout={phase.name}
          />
          <WidgetHint>
            {phase.latent
              ? 'Temperature holds steady here — every bit of heat is going into the phase change. That is latent heat.'
              : 'Heat going in is raising the temperature. That is sensible heat.'}
          </WidgetHint>
        </>
      }
    >
      <Scene3D
        label="phase-change"
        camera={{ x: 5, y: 4, z: 7 }}
        autoRotate
        overlay={
          <SceneLegend>
            Same molecules the whole way through — only their energy changes. Melting and boiling are the
            two bands where the temperature stops climbing even though heat keeps going in.
          </SceneLegend>
        }
      >
        <PhaseScene heat={heat} />
      </Scene3D>
    </WidgetFrame>
  )
}
