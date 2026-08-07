'use client'

/* Refrigerant molecules, side by side.
 *
 * Regulation in this trade is chemistry: the chlorine on R-22 is why it was
 * banned, the double bond on an HFO is why its GWP is low, and the missing
 * chlorine on R-32 is why it is flammable enough to need new precautions. Seeing
 * the atoms makes those three rules one rule.
 */

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ELEMENT, MODEL } from '@/lib/hvacr/palette'
import { ATOM_RADIUS, MOLECULES, type Molecule } from '@/lib/hvacr/molecules'
import { Scene3D, SceneLegend } from './Scene3D'
import { ToggleButton, WidgetFrame, WidgetHint } from './WidgetFrame'

function MoleculeScene({ molecule }: { molecule: Molecule }) {
  const group = useRef<THREE.Group>(null)

  const bonds = useMemo(
    () =>
      molecule.bonds.map(([ai, bi]) => {
        const a = new THREE.Vector3(...molecule.atoms[ai].p)
        const b = new THREE.Vector3(...molecule.atoms[bi].p)
        const dir = new THREE.Vector3().subVectors(b, a)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        )
        return {
          length: dir.length(),
          position: a.clone().addScaledVector(dir, 0.5),
          quaternion,
        }
      }),
    [molecule],
  )

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.getElapsedTime() * 0.4
  })

  return (
    <group ref={group}>
      {molecule.atoms.map((atom, i) => (
        <mesh key={i} position={atom.p}>
          <sphereGeometry args={[ATOM_RADIUS[atom.el], 20, 20]} />
          <meshStandardMaterial color={ELEMENT[atom.el]} />
        </mesh>
      ))}
      {bonds.map((bond, i) => (
        <mesh key={i} position={bond.position} quaternion={bond.quaternion}>
          <cylinderGeometry args={[0.09, 0.09, bond.length, 8]} />
          <meshStandardMaterial color={MODEL.fin} />
        </mesh>
      ))}
    </group>
  )
}

export default function MoleculeWidget() {
  const [key, setKey] = useState(MOLECULES[0].key)
  const molecule = MOLECULES.find((m) => m.key === key) ?? MOLECULES[0]

  return (
    <WidgetFrame
      caption="Schematic molecule models — clean layouts rather than exact bond angles. Switch tabs to compare what each refrigerant is actually made of."
      tabs={MOLECULES.map((m) => (
        <ToggleButton key={m.key} active={m.key === key} onClick={() => setKey(m.key)}>
          {m.label}
        </ToggleButton>
      ))}
      controls={
        <>
          <span className="text-[13px] font-medium text-ink">{molecule.name}</span>
          <WidgetHint>Drag to rotate · scroll to zoom</WidgetHint>
        </>
      }
    >
      <Scene3D
        key={molecule.key}
        label="molecule"
        height={300}
        camera={{ x: 4, y: 3, z: 5 }}
        overlay={<SceneLegend>{molecule.note}</SceneLegend>}
      >
        <MoleculeScene molecule={molecule} />
      </Scene3D>
    </WidgetFrame>
  )
}
