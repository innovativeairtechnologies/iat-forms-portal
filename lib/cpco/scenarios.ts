/* Graded tasks.

   The whole reason the simulator exists: sales asked not to be handed a
   textbook and a test. A scenario states a job the way a customer would state
   it, then checks whether the trainee actually did it on the panel. There are
   no multiple-choice answers here.

   Keystroke counts are reported, never graded. A trainee who wanders and gets
   there has done the job; the count is feedback, not a gate. */

import { IAT_TREE_ID } from './trees/iat-app'
import { SYSTEM_TREE_ID } from './trees/system'
import type { PanelState } from './machine'
import type { Values } from './types'

export type Goal =
  /** A value on the panel must end up at this setting. */
  | { kind: 'value'; label: string; path: string; equals: string | number }
  /** The trainee must have reached this screen at some point. */
  | { kind: 'visited'; label: string; screenId: string }
  /** The panel must have actually been restarted. */
  | { kind: 'rebooted'; label: string }

export type Scenario = {
  id: string
  title: string
  /** Stated the way the job arrives — a phone call, not an instruction. */
  brief: string
  treeId: string
  /** Overrides applied on top of the tree defaults when the scenario starts. */
  seed?: Values
  goals: Goal[]
  /** Rough shortest path, for the efficiency read-out. Informative only. */
  optimalKeystrokes: number
  /** Revealed one at a time, on request. */
  hints: string[]
  /** Shown after a pass — the part that matters on a customer call. */
  debrief: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'bacnet-instance',
    title: 'Put the unit on BACnet',
    brief:
      'The customer’s controls contractor is on site commissioning their building system. ' +
      'They need this unit on BACnet at device instance 2749001. Set it up on the panel.',
    treeId: IAT_TREE_ID,
    goals: [
      { kind: 'value', label: 'BMS2 protocol set to BACNET', path: 'bms2.protocol', equals: 'BACNET' },
      { kind: 'rebooted', label: 'Controller restarted so the protocol takes effect' },
      { kind: 'value', label: 'Device Instance set to 2749001', path: 'bacnet.deviceInstance', equals: 2749001 },
    ],
    // Measured, not guessed: the acceptance test walks the shortest documented
    // path — Prg, four Enters through the login, Settings, Communications,
    // BMS2, three Ups to BACNET, Enter, reboot, then back in to the BACnet mask
    // and seven digits entered the short way round the wrap — in 66 presses.
    optimalKeystrokes: 66,
    hints: [
      'Prg from the main screen starts the login. Enter walks the password digits.',
      'Settings → Communications. The protocol lives under BMS2, the instance under BACnet.',
      'Enter moves the cursor to the next field; Up and Down change the value under it.',
      'Changing the protocol prompts for a restart. The change is not live until you take it.',
      'On Device Instance the cursor walks one digit at a time — Up/Down set the digit, Enter moves along.',
    ],
    debrief:
      'Two things worth saying out loud on a call. The device instance has to be unique across the ' +
      'customer’s whole BACnet network, so it is their integrator’s number to give you, not ours to pick. ' +
      'And BACnet runs on one port at a time — BMS2, FBus2 or Ethernet, never two at once — so ask early ' +
      'whether they want MS/TP or IP.',
  },

  {
    id: 'find-device-instance',
    title: 'Answer the integrator’s question',
    brief:
      'An integrator calls: “What device instance is that dehumidifier set to?” ' +
      'Find the answer on the panel without changing anything.',
    treeId: IAT_TREE_ID,
    seed: { 'bacnet.deviceInstance': 1180042, 'bms2.protocol': 'BACNET' },
    goals: [{ kind: 'visited', label: 'Opened the BACnet connectivity mask', screenId: 'iat.bacnet' }],
    optimalKeystrokes: 20,
    hints: [
      'You are only reading. Prg, then Settings → Communications.',
      'BMS2 is where the protocol lives. BACnet is where its settings live.',
    ],
    debrief:
      'Reading a value is the same walk as setting one — you just never press Up or Down. ' +
      'Esc backs out one level at a time and changes nothing.',
  },

  {
    id: 'mac-for-tera',
    title: 'Get the controller’s MAC address',
    brief:
      'We want this unit on tERA so we can look at it remotely instead of sending someone. ' +
      'Registration needs the controller’s MAC address. Find it.',
    treeId: IAT_TREE_ID,
    goals: [{ kind: 'visited', label: 'Opened PCO INFORMATION', screenId: 'sys.info.pco' }],
    optimalKeystrokes: 4,
    hints: [
      'This one is not in the IAT application at all — it belongs to the controller itself.',
      'Hold Alarm and Enter together for three seconds from anywhere.',
      'INFORMATION → PCO INFORMATION. MAC, UID and the tERA code are all on that mask.',
    ],
    debrief:
      'That Alarm+Enter menu is the CAREL operating system underneath our application, and it is the ' +
      'same on every c.pCO regardless of what is loaded. It is also where the MAC is printed if the ' +
      'label on the board is unreadable.',
  },

  {
    id: 'plan-address',
    title: 'Set the pLAN address',
    brief:
      'A second controller is going into this pLAN network and both are sitting at address 1, ' +
      'so neither is talking. Set this one to address 3 and apply it.',
    treeId: IAT_TREE_ID,
    goals: [
      { kind: 'value', label: 'pLAN address set to 3', path: 'sys.plan.addr', equals: 3 },
      { kind: 'value', label: 'Configuration update confirmed', path: 'sys.plan.update', equals: 'Yes' },
    ],
    optimalKeystrokes: 14,
    hints: [
      'Alarm+Enter for three seconds gets you into the controller’s own menu.',
      'SETTINGS → PLAN SETTINGS.',
      'Setting the address is not enough — Update config has to be confirmed.',
    ],
    debrief:
      'Every device on a pLAN needs its own address, terminals included, up to 32 devices. ' +
      'There is a second way to do this without a display: the recessed button next to the ' +
      'seven-segment readout on the board.',
  },

  {
    id: 'static-ip',
    title: 'Take the controller off DHCP',
    brief:
      'The customer’s IT group wants this controller on a fixed address so their BAS can find it ' +
      'reliably and so the built-in web pages stay at one URL. Turn DHCP off and apply the change.',
    treeId: IAT_TREE_ID,
    goals: [
      { kind: 'value', label: 'DHCP switched off', path: 'sys.tcp.dhcp', equals: 'Off' },
      { kind: 'value', label: 'Configuration update confirmed', path: 'sys.tcp.update', equals: 'Yes' },
    ],
    optimalKeystrokes: 14,
    hints: [
      'Controller menu again — Alarm+Enter for three seconds.',
      'SETTINGS → TCP/IP SETTINGS. DHCP is On from the factory.',
    ],
    debrief:
      'DHCP is on out of the box, which is fine on a bench and a problem on a live building network ' +
      'where the lease can move the address. A fixed address is also what makes BACnet/IP and the ' +
      'controller’s own web server dependable.',
  },
]

export const SCENARIOS_BY_ID = new Map(SCENARIOS.map(s => [s.id, s]))

export type GoalResult = { goal: Goal; label: string; done: boolean }

export type ScenarioResult = {
  passed: boolean
  goals: GoalResult[]
  keystrokes: number
  optimalKeystrokes: number
  /** Presses beyond the shortest path. Never negative, never a pass condition. */
  extraKeystrokes: number
}

function goalMet(goal: Goal, state: PanelState): boolean {
  if (goal.kind === 'value') {
    const actual = state.values[goal.path]
    // Loose on numeric-vs-string because a digits field stores a number while
    // an enum stores its label; both compare cleanly once stringified.
    return typeof goal.equals === 'number'
      ? Number(actual) === goal.equals
      : String(actual) === goal.equals
  }
  if (goal.kind === 'visited') return state.visited.includes(goal.screenId)
  return state.reboots > 0
}

export function evaluateScenario(scenario: Scenario, state: PanelState): ScenarioResult {
  const goals: GoalResult[] = scenario.goals.map(goal => ({
    goal,
    label: goal.label,
    done: goalMet(goal, state),
  }))
  const keystrokes = state.keys.length
  return {
    passed: goals.every(g => g.done),
    goals,
    keystrokes,
    optimalKeystrokes: scenario.optimalKeystrokes,
    extraKeystrokes: Math.max(0, keystrokes - scenario.optimalKeystrokes),
  }
}

/** Which tree a scenario opens in. Scenarios that live in the controller's own
    menu still *start* in the IAT application, because that is where a real
    session starts — finding Alarm+Enter is part of the task. */
export function scenarioTreeId(scenario: Scenario): string {
  return scenario.treeId === SYSTEM_TREE_ID ? SYSTEM_TREE_ID : IAT_TREE_ID
}
