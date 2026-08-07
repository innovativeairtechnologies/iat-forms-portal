/* Refrigerant molecule models for the 3D viewer.
 *
 * Schematic, not computed: positions are hand-placed to read clearly on screen,
 * not real bond angles or lengths from a structure file. The widget says so on
 * its face — a technician needs to see "R-22 carries a chlorine and R-32 does
 * not", which is the whole reason ozone depletion split those two apart, and
 * that reads better from a clean layout than from accurate VSEPR geometry.
 */

export type Element = 'C' | 'H' | 'F' | 'Cl' | 'O'

export type Molecule = {
  key: string
  /** Tab label. */
  label: string
  /** Full name shown under the model. */
  name: string
  /** One line on why this refrigerant matters. */
  note: string
  atoms: { el: Element; p: [number, number, number] }[]
  bonds: [number, number][]
}

export const MOLECULES: Molecule[] = [
  {
    key: 'r22',
    label: 'R-22 (legacy HCFC)',
    name: 'R-22 · CHClF₂',
    note: 'The chlorine atom is why R-22 depletes ozone, and why it was phased out under the Montreal Protocol.',
    atoms: [
      { el: 'C', p: [0, 0, 0] },
      { el: 'H', p: [0.9, 0.6, 0.3] },
      { el: 'Cl', p: [-0.9, 0.6, 0.3] },
      { el: 'F', p: [0.4, -0.7, 0.7] },
      { el: 'F', p: [-0.4, -0.7, -0.7] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  },
  {
    key: 'r32',
    label: 'R-32 (A2L)',
    name: 'R-32 · CH₂F₂',
    note: 'No chlorine, so no ozone impact — but it is mildly flammable (A2L) and needs the newer service precautions.',
    atoms: [
      { el: 'C', p: [0, 0, 0] },
      { el: 'H', p: [0.9, 0.6, 0.3] },
      { el: 'H', p: [-0.9, 0.6, 0.3] },
      { el: 'F', p: [0.5, -0.7, 0.7] },
      { el: 'F', p: [-0.5, -0.7, -0.7] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  },
  {
    key: 'r1234yf',
    label: 'R-1234yf (HFO)',
    name: 'R-1234yf · simplified',
    note: 'The carbon–carbon double bond breaks down fast in the atmosphere, which is what gives HFOs their very low GWP.',
    atoms: [
      { el: 'C', p: [-1.1, 0, 0] },
      { el: 'C', p: [0, 0.3, 0] },
      { el: 'C', p: [1.1, -0.2, 0] },
      { el: 'F', p: [-1.8, 0.8, 0.3] },
      { el: 'F', p: [-1.6, -0.9, -0.3] },
      { el: 'F', p: [1.9, 0.5, 0.3] },
      { el: 'F', p: [1.4, -1.1, -0.4] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [0, 3],
      [0, 4],
      [2, 5],
      [2, 6],
    ],
  },
  {
    key: 'r744',
    label: 'R-744 / CO₂',
    name: 'R-744 · CO₂ (linear)',
    note: 'A natural refrigerant with a GWP of 1, but it runs transcritical at high pressures — different equipment, different rules.',
    atoms: [
      { el: 'O', p: [-1.4, 0, 0] },
      { el: 'C', p: [0, 0, 0] },
      { el: 'O', p: [1.4, 0, 0] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    key: 'r290',
    label: 'R-290 / propane',
    name: 'R-290 · propane, C₃H₈',
    note: 'Pure hydrocarbon: excellent thermodynamics and near-zero GWP, but A3 — highly flammable, so charge limits are strict.',
    atoms: [
      { el: 'C', p: [-1.2, 0.2, 0] },
      { el: 'C', p: [0, -0.3, 0] },
      { el: 'C', p: [1.2, 0.2, 0] },
      { el: 'H', p: [-1.8, 0.9, 0.4] },
      { el: 'H', p: [-1.6, -0.6, -0.6] },
      { el: 'H', p: [0, -1.0, 0.7] },
      { el: 'H', p: [0, -0.9, -0.7] },
      { el: 'H', p: [1.8, -0.4, 0.5] },
      { el: 'H', p: [1.6, 0.9, -0.5] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [0, 3],
      [0, 4],
      [1, 5],
      [1, 6],
      [2, 7],
      [2, 8],
    ],
  },
]

export const ATOM_RADIUS: Record<Element, number> = {
  C: 0.35,
  H: 0.2,
  F: 0.3,
  Cl: 0.3,
  O: 0.3,
}
