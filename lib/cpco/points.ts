/* The unit's BACnet object list, transcribed from the c.design export
   `BACnet_Documentation.xls` (38 objects, instances 0-37).

   Read as a machine rather than a spreadsheet this is the whole dehumidifier:
   process air enters, is pre-cooled and pre-heated, crosses the desiccant
   wheel, is post-cooled and post-heated, and leaves for the space. The
   reactivation stream runs the other way through the wheel, heated by the
   burner.

   THREE THINGS THIS FILE EXISTS TO TEACH:

   1. Only six objects are writable — External Run and the five setpoints.
      Everything else is read-only. That is the answer to "can our building
      system *control* your unit?"
   2. Every object declares `UoM = NoUnits`. Nothing on the wire says these are
      degrees Fahrenheit; the integrator has to be told, or their graphics come
      up unlabelled. `declaredUnit` records what the export actually says and
      `actualUnit` what it means — the gap is the lesson.
   3. Four objects carry defects in their `Description`, which is the string the
      *customer's* BAS displays. See `POINT_DEFECTS`.

   ⚠️ Per "standard core, job-specific options": treat instance numbers as this
   job's, not as universal. `optional` marks stages a given unit may not have. */

export type BacnetType = 'BinaryInput' | 'BinaryValue' | 'AnalogInput' | 'AnalogValue'

export type PointGroup = 'alarm' | 'command' | 'sensor' | 'setpoint'

/** Where the point sits on the air path, for the schematic. */
export type Stage =
  | 'unit'
  | 'pre-des'
  | 'pre-cool'
  | 'pre-heat'
  | 'wheel'
  | 'post-des'
  | 'post-cool'
  | 'post-heat'
  | 'space'
  | 'react'

export type Stream = 'process' | 'reactivation' | 'space' | 'unit'

export type BacnetPoint = {
  instance: number
  type: BacnetType
  /** The c.suite variable behind the object. */
  name: string
  /** The `Description` property — what appears in the customer's BAS. */
  description: string
  group: PointGroup
  stage: Stage
  stream: Stream
  /** PresentValue is Read_Writeable rather than Read_NoWrite. */
  writable: boolean
  /** What the export declares. It is `NoUnits` for all 38 — that is the point. */
  declaredUnit: 'NoUnits'
  /** What the value actually is. Inferred, never declared on the wire. */
  actualUnit: string | null
  default?: number
  min?: number
  max?: number
  /** Only some units have this stage. */
  optional?: boolean
  /** A problem with the row as exported. */
  defect?: string
  note?: string
}

const NO_UNITS = 'NoUnits' as const

export const POINTS: BacnetPoint[] = [
  /* ------------------------------------------------- alarms (BinaryInput) */
  { instance: 0, type: 'BinaryInput', name: 'Alarm_Active', description: 'Summary Alarm', group: 'alarm', stage: 'unit', stream: 'unit', writable: false, declaredUnit: NO_UNITS, actualUnit: null, note: 'Rolls up every alarm below. Usually the only alarm point a BAS bothers to map.' },
  { instance: 1, type: 'BinaryInput', name: 'Alarm_Process_Fan_Not_Running', description: 'Process Fan Not Running', group: 'alarm', stage: 'unit', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 2, type: 'BinaryInput', name: 'Alarm_React_Fan_Not_Running', description: 'React Fan Not Running', group: 'alarm', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 3, type: 'BinaryInput', name: 'Alarm_Rotor_Not_Running', description: 'Desiccant Wheel Not Running', group: 'alarm', stage: 'wheel', stream: 'unit', writable: false, declaredUnit: NO_UNITS, actualUnit: null, note: 'The wheel is the machine. No rotation, no drying.' },
  { instance: 4, type: 'BinaryInput', name: 'Alarm_React_Temp_Sensor_Failed', description: 'React Sensor Failed', group: 'alarm', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 5, type: 'BinaryInput', name: 'Alarm_React_Overtemp', description: 'React Overtemp', group: 'alarm', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: null, note: 'Trips above 320 °F — the one alarm with a hard number in the export.' },
  { instance: 6, type: 'BinaryInput', name: 'Alarm_Pre_Des_DP_Sensor_Failed', description: 'Pre Des Humidity Sensor', group: 'alarm', stage: 'pre-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 7, type: 'BinaryInput', name: 'Alarm_Pre_Des_Temp_Sensor_Failed', description: 'Pre Des Temperature Sensor', group: 'alarm', stage: 'pre-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 8, type: 'BinaryInput', name: 'Alarm_Pre_Cool_Temp_Sensor_Failed', description: 'Pre Cool Temperature Sensor', group: 'alarm', stage: 'pre-cool', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null, optional: true },
  { instance: 9, type: 'BinaryInput', name: 'Alarm_Pre_Heat_Temp_Sensor_Failed', description: 'Pre Heat Temperature Sensor', group: 'alarm', stage: 'pre-heat', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null, optional: true },
  { instance: 10, type: 'BinaryInput', name: 'Alarm_Post_Des_DP_Sensor_Failed', description: 'Post Des Humidity Sensor', group: 'alarm', stage: 'post-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 11, type: 'BinaryInput', name: 'Alarm_Post_Des_Temp_Sensor_Failed', description: 'Post Des Temperature Sensor', group: 'alarm', stage: 'post-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null },
  { instance: 12, type: 'BinaryInput', name: 'Alarm_Post_Cool_Temp_Sensor_Failed', description: 'Post Cool Temperature Sensor', group: 'alarm', stage: 'post-cool', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null, optional: true },
  { instance: 13, type: 'BinaryInput', name: 'Alarm_Post_Heat_Temp_Sensor_Failed', description: 'Post Heat Temperature Sensor', group: 'alarm', stage: 'post-heat', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: null, optional: true },
  {
    instance: 14,
    type: 'BinaryInput',
    name: 'Alarm_Space_Dewpoint_Sensor_Failed',
    description: 'Space Humidity Sensor',
    group: 'alarm',
    stage: 'space',
    stream: 'space',
    writable: false,
    declaredUnit: NO_UNITS,
    actualUnit: null,
    defect: 'The export’s Variable Description reads "Space Temp Sensor Failed" — swapped with instance 15.',
  },
  {
    instance: 15,
    type: 'BinaryInput',
    name: 'Alarm_Space_Temp_Sensor_Failed',
    description: 'Space Temperature Sensor',
    group: 'alarm',
    stage: 'space',
    stream: 'space',
    writable: false,
    declaredUnit: NO_UNITS,
    actualUnit: null,
    defect: 'The export’s Variable Description reads "Space Dewpoint Sensor Failed" — swapped with instance 14.',
  },
  { instance: 16, type: 'BinaryInput', name: 'Alarm_Burner_Alarm', description: 'Burner Alarm', group: 'alarm', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: null, optional: true, note: 'Gas reactivation only.' },

  /* ---------------------------------------------- command (BinaryValue) */
  { instance: 17, type: 'BinaryValue', name: 'External_Run', description: 'External Run', group: 'command', stage: 'unit', stream: 'unit', writable: true, declaredUnit: NO_UNITS, actualUnit: null, note: 'The only on/off the BAS gets. Start and stop the unit.' },

  /* ----------------------------------------------- sensors (AnalogInput) */
  { instance: 18, type: 'AnalogInput', name: 'Pre_Des_DP', description: 'Pre Desiccant Humidity', group: 'sensor', stage: 'pre-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F dew point', note: 'Variable is named DP (dew point) while the label says Humidity. Same value, two vocabularies — say dew point.' },
  { instance: 19, type: 'AnalogInput', name: 'Pre_Des_Temp', description: 'Pre Desiccant Temperature', group: 'sensor', stage: 'pre-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F' },
  { instance: 20, type: 'AnalogInput', name: 'Pre_Cool_Temp', description: 'Pre Cooling Temperature', group: 'sensor', stage: 'pre-cool', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F', optional: true },
  { instance: 21, type: 'AnalogInput', name: 'Pre_Heat_Temp', description: 'Pre Heating Temperature', group: 'sensor', stage: 'pre-heat', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F', optional: true },
  { instance: 22, type: 'AnalogInput', name: 'React_Temp', description: 'React Temperature', group: 'sensor', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F', note: 'Watched by the 320 °F overtemp alarm.' },
  { instance: 23, type: 'AnalogInput', name: 'Post_Des_DP', description: 'Post Desiccant Humidity', group: 'sensor', stage: 'post-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F dew point', note: 'The money reading — this is the dryness the unit is actually delivering.' },
  { instance: 24, type: 'AnalogInput', name: 'Post_Des_Temp', description: 'Post Desiccant Temperature', group: 'sensor', stage: 'post-des', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F' },
  {
    instance: 25,
    type: 'AnalogInput',
    name: 'Post_Cool_Temp',
    description: 'Post Cooling Temperature',
    group: 'sensor',
    stage: 'post-cool',
    stream: 'process',
    writable: false,
    declaredUnit: NO_UNITS,
    actualUnit: '°F',
    optional: true,
    defect: 'The export labels this "Pre Cooling Temperature" — copy-pasted from instance 20.',
  },
  {
    instance: 26,
    type: 'AnalogInput',
    name: 'Post_Heat_Temp',
    description: 'Post Heating Temperature',
    group: 'sensor',
    stage: 'post-heat',
    stream: 'process',
    writable: false,
    declaredUnit: NO_UNITS,
    actualUnit: '°F',
    optional: true,
    defect: 'The export labels this "Pre Heating Temperature" — copy-pasted from instance 21.',
  },
  { instance: 27, type: 'AnalogInput', name: 'Space_DP', description: 'Space Humidity', group: 'sensor', stage: 'space', stream: 'space', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F dew point' },
  { instance: 28, type: 'AnalogInput', name: 'Space_Temp', description: 'Space Temperature', group: 'sensor', stage: 'space', stream: 'space', writable: false, declaredUnit: NO_UNITS, actualUnit: '°F' },
  { instance: 29, type: 'AnalogInput', name: 'Process_Plenum_Pressure', description: 'Process Plenum Pressure', group: 'sensor', stage: 'unit', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: 'in. w.c.' },
  { instance: 30, type: 'AnalogInput', name: 'React_Plenum_Pressure', description: 'React Plenum Pressure', group: 'sensor', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: 'in. w.c.' },
  { instance: 31, type: 'AnalogInput', name: 'Process_Filter_Pressure', description: 'Process Filter Pressure', group: 'sensor', stage: 'unit', stream: 'process', writable: false, declaredUnit: NO_UNITS, actualUnit: 'in. w.c.', note: 'Rising differential means a loading filter — the easiest predictive-maintenance point to sell.' },
  { instance: 32, type: 'AnalogInput', name: 'React_Filter_Pressure', description: 'React Filter Pressure', group: 'sensor', stage: 'react', stream: 'reactivation', writable: false, declaredUnit: NO_UNITS, actualUnit: 'in. w.c.' },

  /* -------------------------------------------- setpoints (AnalogValue) */
  { instance: 33, type: 'AnalogValue', name: 'Setpoint_Dew_Point', description: 'Humidity Setpoint', group: 'setpoint', stage: 'post-des', stream: 'process', writable: true, declaredUnit: NO_UNITS, actualUnit: '°F dew point', default: 15.7, min: -40, max: 140, note: 'The one the customer actually cares about.' },
  { instance: 34, type: 'AnalogValue', name: 'Setpoint_Pre_Cooling_Temp', description: 'Pre Cool Temperature Setpoint', group: 'setpoint', stage: 'pre-cool', stream: 'process', writable: true, declaredUnit: NO_UNITS, actualUnit: '°F', min: 55, max: 100, optional: true, defect: 'No default value in the export, unlike the other four setpoints.' },
  { instance: 35, type: 'AnalogValue', name: 'Setpoint_Pre_Heating_Temp', description: 'Pre Heat Temperature Setpoint', group: 'setpoint', stage: 'pre-heat', stream: 'process', writable: true, declaredUnit: NO_UNITS, actualUnit: '°F', min: 40, max: 100, optional: true, defect: 'No default value in the export, unlike the other four setpoints.' },
  { instance: 36, type: 'AnalogValue', name: 'Setpoint_Post_Cooling_Temp', description: 'Post Cool Temperature Setpoint', group: 'setpoint', stage: 'post-cool', stream: 'process', writable: true, declaredUnit: NO_UNITS, actualUnit: '°F', default: 65.0, min: 40, max: 100, optional: true },
  { instance: 37, type: 'AnalogValue', name: 'Setpoint_Post_Heat_Temp', description: 'Post Heat Temperature Setpoint', group: 'setpoint', stage: 'post-heat', stream: 'process', writable: true, declaredUnit: NO_UNITS, actualUnit: '°F', default: 140.0, min: 40, max: 200, optional: true },
]

export const POINTS_BY_INSTANCE = new Map(POINTS.map(p => [p.instance, p]))

export function pointsInGroup(group: PointGroup): BacnetPoint[] {
  return POINTS.filter(p => p.group === group)
}

/** The six objects a BAS can write. Everything else is read-only. */
export const WRITABLE_POINTS = POINTS.filter(p => p.writable)

/** Rows whose exported `Description` is wrong or incomplete. These ship to the
    customer's head-end, so they are worth fixing upstream — surfaced in the
    point explorer and raised with engineering. */
export const POINT_DEFECTS = POINTS.filter(p => p.defect)

/** Alarm codes the panel and the schematic share. */
export function alarmLabel(instance: number): string {
  return POINTS_BY_INSTANCE.get(instance)?.description ?? `Alarm ${instance}`
}

/** Ordered process-air path, for laying out the schematic left to right. */
export const PROCESS_PATH: Stage[] = [
  'pre-des',
  'pre-cool',
  'pre-heat',
  'wheel',
  'post-des',
  'post-cool',
  'post-heat',
  'space',
]

export const STAGE_LABELS: Record<Stage, string> = {
  unit: 'Unit',
  'pre-des': 'Entering air',
  'pre-cool': 'Pre-cool',
  'pre-heat': 'Pre-heat',
  wheel: 'Desiccant wheel',
  'post-des': 'Leaving wheel',
  'post-cool': 'Post-cool',
  'post-heat': 'Post-heat',
  space: 'Space',
  react: 'Reactivation',
}
