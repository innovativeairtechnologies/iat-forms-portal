/* The catalogue of interactive blocks a lesson body can embed.
 *
 * One list, three consumers:
 *
 *   • `components/learn/InteractiveBlockView.tsx` types its registry as
 *     `Record<InteractiveBlockName, …>`, so adding a name here without wiring a
 *     component is a COMPILE error rather than a lesson that quietly renders
 *     "isn't available" in production.
 *   • `components/learn/admin/LessonEditor.tsx` builds its insert menu from it,
 *     so an author can only insert blocks that exist.
 *   • `scripts/gen-hvacr-course.mjs` checks every marker it writes against it.
 *
 * Plain data, no components — it has to be importable from a Server Component,
 * from a client module, and (by regex) from a build script.
 */

export type BlockParamSpec = {
  key: string
  label: string
  /** When present, the author picks from these rather than typing. */
  options?: { value: string; label: string }[]
}

export type BlockSpec = {
  name: string
  label: string
  /** Grouping in the author's insert menu. */
  group: string
  params?: BlockParamSpec[]
}

/* `as const` so the names survive as literals for `InteractiveBlockName`; the
   exported view below is widened back to `BlockSpec[]` so consumers can read
   `.params` on entries that don't declare it. */
const BLOCKS = [
  // ── Control panel course (migration 082) ──────────────────────────────────
  {
    name: 'cpco-sim',
    label: 'c.pCO panel simulator',
    group: 'Control panel',
    params: [
      { key: 'scenario', label: 'Graded scenario (blank for free play)' },
      {
        key: 'guided',
        label: 'Show all hints',
        options: [
          { value: 'true', label: 'Guided' },
          { value: '', label: 'Unguided' },
        ],
      },
    ],
  },
  { name: 'cpco-points', label: 'BACnet point explorer', group: 'Control panel' },
  { name: 'cpco-alarm-lab', label: 'Alarm lab', group: 'Control panel' },

  // ── Refrigeration & HVAC/R course (migration 085) ─────────────────────────
  { name: 'hvacr-cycle-3d', label: 'Refrigeration cycle (3D)', group: 'HVAC/R models' },
  { name: 'hvacr-compressor-3d', label: 'Compressors (3D)', group: 'HVAC/R models' },
  { name: 'hvacr-txv-3d', label: 'Expansion valve (3D)', group: 'HVAC/R models' },
  { name: 'hvacr-phase-particles', label: 'Phase change (3D)', group: 'HVAC/R models' },
  { name: 'hvacr-molecule-3d', label: 'Refrigerant molecules (3D)', group: 'HVAC/R models' },
  {
    name: 'hvacr-coil-3d',
    label: 'Air coil (3D)',
    group: 'HVAC/R models',
    params: [
      {
        key: 'coil',
        label: 'Which coil',
        options: [
          { value: 'condenser', label: 'Condenser' },
          { value: 'evaporator', label: 'Evaporator' },
        ],
      },
    ],
  },

  { name: 'hvacr-ppe-matcher', label: 'Hazard → PPE matcher', group: 'HVAC/R explorers' },
  { name: 'hvacr-component-map', label: 'System component map', group: 'HVAC/R explorers' },
  { name: 'hvacr-control-circuit', label: 'Control circuit', group: 'HVAC/R explorers' },
  { name: 'hvacr-control-sequence', label: 'Call-for-cooling sequence', group: 'HVAC/R explorers' },
  { name: 'hvacr-system-types', label: 'System types comparison', group: 'HVAC/R explorers' },

  { name: 'hvacr-temp-converter', label: 'Temperature converter', group: 'HVAC/R tools' },
  { name: 'hvacr-diagnostic-quadrant', label: 'Superheat/subcooling quadrant', group: 'HVAC/R tools' },
  { name: 'hvacr-psychrometric-chart', label: 'Psychrometric chart', group: 'HVAC/R tools' },
  { name: 'hvacr-micron-gauge', label: 'Micron gauge', group: 'HVAC/R tools' },
  { name: 'hvacr-pm-checklist', label: 'PM checklist', group: 'HVAC/R tools' },
  { name: 'hvacr-epa-tools', label: 'EPA 608 certification + leak rate', group: 'HVAC/R tools' },

  {
    name: 'hvacr-label',
    label: 'Label the diagram',
    group: 'HVAC/R exercises',
    params: [
      {
        key: 'set',
        label: 'Which diagram',
        options: [
          { value: 'cycle', label: 'Refrigeration cycle' },
          { value: 'compressor', label: 'Reciprocating compressor' },
          { value: 'condenser', label: 'Air-cooled condenser' },
          { value: 'components', label: 'Extended system' },
          { value: 'circuit', label: 'Control circuit' },
          { value: 'safety-devices', label: 'Safety devices' },
        ],
      },
    ],
  },
  {
    name: 'hvacr-sequence',
    label: 'Put the steps in order',
    group: 'HVAC/R exercises',
    params: [
      {
        key: 'set',
        label: 'Which sequence',
        options: [
          { value: 'loto', label: 'Lockout/tagout' },
          { value: 'cycle', label: 'Refrigeration cycle' },
          { value: 'install', label: 'Installation' },
        ],
      },
    ],
  },
  {
    name: 'hvacr-classify',
    label: 'Read and classify',
    group: 'HVAC/R exercises',
    params: [
      {
        key: 'set',
        label: 'Which drill',
        options: [
          { value: 'sensible-latent', label: 'Sensible or latent' },
          { value: 'ashrae', label: 'ASHRAE safety group' },
          { value: 'capacitor', label: 'Good capacitor or bad' },
          { value: 'dehumidify', label: 'Needs dehumidification' },
          { value: 'system-type', label: 'Match the system type' },
          { value: 'pm', label: 'Spot the maintenance issue' },
          { value: 'recovery', label: 'Recovery / recycling / reclaiming' },
        ],
      },
    ],
  },
  {
    name: 'hvacr-calc-classify',
    label: 'Calculate, then classify',
    group: 'HVAC/R exercises',
    params: [
      {
        key: 'set',
        label: 'Which drill',
        options: [
          { value: 'superheat', label: 'Superheat' },
          { value: 'heat-load', label: 'Heat load and sizing' },
        ],
      },
    ],
  },
  { name: 'hvacr-branch', label: 'Service call simulator', group: 'HVAC/R exercises' },
  {
    name: 'hvacr-flashcards',
    label: 'Key-term flashcards',
    group: 'HVAC/R exercises',
    params: [{ key: 'module', label: 'Source subject id, e.g. "compressors"' }],
  },
  { name: 'hvacr-certificate', label: 'Course certificate', group: 'HVAC/R exercises' },
] as const satisfies readonly BlockSpec[]

export type InteractiveBlockName = (typeof BLOCKS)[number]['name']

export const INTERACTIVE_BLOCKS: readonly BlockSpec[] = BLOCKS

export const BLOCK_GROUPS: string[] = [...new Set(INTERACTIVE_BLOCKS.map((b) => b.group))]
