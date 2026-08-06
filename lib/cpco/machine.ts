/* The pGD keypress reducer.

   This is where the panel's *editing grammar* lives, and getting it exactly
   right is what makes the simulator feel like the real thing rather than a
   slideshow. Every rule below is taken from the keystroke captions in IAT's
   "How to setup the BACnet instance" procedure, which documents a real session
   press by press:

     - On a menu, Up/Down move the inverse-video selection, Enter descends,
       Esc goes back up one level.
     - On a mask, the cursor starts *above* the first field. Enter walks it down
       field by field and then wraps back to the top — Enter is "next", not
       "confirm".
     - Up/Down change the value under the cursor.
     - A multi-digit number is entered one digit at a time: Up/Down cycle the
       digit, Enter moves to the next one.
     - Changing a value that needs a restart raises a reboot prompt when the
       cursor *leaves* the field, not when the value changes.

   Pure: no React, no timers, no Date.now(). The caller supplies timestamps so
   this stays testable without a browser. */

import { cursorableFields, digitsText } from './display'
import type { ButtonId, Effect, Field, KeyEvent, Screen, Tree, Values } from './types'

export type TreeSet = Record<string, Tree>

/** Remembering the selection per level is why Esc lands you back where you
    were rather than at the top of the parent menu. */
type StackEntry = { screenId: string; selection: number }

export type PanelState = {
  treeId: string
  screenId: string
  stack: StackEntry[]
  /** Highlighted menu item, or highlighted alarm row. */
  selection: number
  /** Index into the screen's cursorable fields; -1 means "above the first
      field", which is where a mask starts. */
  cursor: number
  /** Position within a `digits` field. */
  digit: number
  values: Values
  /** Field ids edited since the cursor entered them — drives `onCommit`. */
  changed: string[]
  booting: boolean
  /** Active alarm codes, matching BinaryInput instances in `points.ts`. */
  alarms: string[]
  /** Full keypress log, for grading a scenario. */
  keys: KeyEvent[]
  /** Every screen reached this run. Lets a scenario ask "did you find it?"
      without requiring the trainee to still be standing on it. */
  visited: string[]
  /** Restarts taken. A protocol change is not live until the panel reboots, so
      a scenario can insist the trainee actually went through with it. */
  reboots: number
}

export type PanelAction =
  | { type: 'press'; button: ButtonId; at?: number }
  /** Alarm + Enter held for 3 seconds — the CAREL system menu (manual §7.1). */
  | { type: 'systemMenu'; at?: number }
  | { type: 'bootComplete' }
  | { type: 'setAlarms'; codes: string[] }
  /** Restart the exercise. The caller supplies the state to go back to, so the
      reducer stays pure and doesn't need to know how a scenario is seeded. */
  | { type: 'reset'; to: PanelState }

/** Keeps the log bounded; a graded scenario is a few dozen presses at most. */
const MAX_KEYS = 500

function withVisit(next: PanelState, previousScreenId: string): PanelState {
  if (next.screenId === previousScreenId || next.visited.includes(next.screenId)) return next
  return { ...next, visited: [...next.visited, next.screenId] }
}

export function createInitialState(tree: Tree, values: Values): PanelState {
  return {
    treeId: tree.id,
    screenId: tree.root,
    stack: [],
    selection: 0,
    cursor: -1,
    digit: 0,
    values,
    changed: [],
    booting: false,
    alarms: [],
    keys: [],
    visited: [tree.root],
    reboots: 0,
  }
}

function screenOf(trees: TreeSet, state: PanelState): Screen | undefined {
  return trees[state.treeId]?.screens[state.screenId]
}

/** Where the cursor sits when a screen opens. Masks normally start *above*
    their first field; a mask marked `autoFocus` starts on it. */
function entryCursor(trees: TreeSet, treeId: string, screenId: string): number {
  const screen = trees[treeId]?.screens[screenId]
  return screen?.kind === 'form' && screen.autoFocus ? 0 : -1
}

/** Enters a screen, remembering where we came from. */
function push(state: PanelState, target: string, trees: TreeSet): PanelState {
  return {
    ...state,
    stack: [...state.stack, { screenId: state.screenId, selection: state.selection }],
    screenId: target,
    selection: 0,
    cursor: entryCursor(trees, state.treeId, target),
    digit: 0,
    changed: [],
  }
}

/** Enters a screen in place of the current one, leaving the stack alone. */
function replace(state: PanelState, target: string, trees: TreeSet): PanelState {
  return {
    ...state,
    screenId: target,
    selection: 0,
    cursor: entryCursor(trees, state.treeId, target),
    digit: 0,
    changed: [],
  }
}

function pop(state: PanelState): PanelState {
  if (state.stack.length === 0) return state
  const entry = state.stack[state.stack.length - 1]
  return {
    ...state,
    stack: state.stack.slice(0, -1),
    screenId: entry.screenId,
    selection: entry.selection,
    cursor: -1,
    digit: 0,
    changed: [],
  }
}

/** Jumps without stacking — used by an explicit `onEsc`. */
function jump(state: PanelState, target: string): PanelState {
  return { ...state, screenId: target, stack: [], selection: 0, cursor: -1, digit: 0, changed: [] }
}

function applyEffect(state: PanelState, effect: Effect, trees: TreeSet): PanelState {
  if (effect.kind === 'goto') return push(state, effect.screen, trees)
  if (effect.kind === 'replace') return replace(state, effect.screen, trees)

  // A restart drops everything: the panel comes back up on its main mask with
  // no navigation history.
  const tree = trees[state.treeId]
  return {
    ...state,
    booting: true,
    reboots: state.reboots + 1,
    screenId: tree?.root ?? state.screenId,
    stack: [],
    selection: 0,
    cursor: -1,
    digit: 0,
    changed: [],
  }
}

function editField(f: Field, values: Values, dir: 1 | -1, digit: number): Values {
  if (f.kind === 'enum') {
    const current = String(values[f.path] ?? f.options[0])
    const i = Math.max(0, f.options.indexOf(current))
    const next = (i + dir + f.options.length) % f.options.length
    return { ...values, [f.path]: f.options[next] }
  }

  if (f.kind === 'number') {
    const step = f.step ?? 1
    const current = Number(values[f.path] ?? f.min)
    const next = Math.min(f.max, Math.max(f.min, current + dir * step))
    return { ...values, [f.path]: next }
  }

  if (f.kind === 'digits') {
    const text = digitsText(values[f.path], f.digits)
    const d = (Number(text[digit] ?? '0') + dir + 10) % 10
    const nextText = `${text.slice(0, digit)}${d}${text.slice(digit + 1)}`
    return { ...values, [f.path]: Number(nextText) }
  }

  return values
}

/** Enter on a mask. Walks the cursor down, digit by digit through a `digits`
    field, and fires `onCommit` on the way out of a field that was changed. */
function advance(state: PanelState, screen: Screen, trees: TreeSet): PanelState {
  const fields = cursorableFields(screen)
  if (fields.length === 0) return state

  if (state.cursor < 0) return { ...state, cursor: 0, digit: 0 }

  const f = fields[state.cursor]
  if (!f) return { ...state, cursor: -1, digit: 0 }

  if (f.kind === 'digits' && state.digit < f.digits - 1) {
    return { ...state, digit: state.digit + 1 }
  }

  const shouldCommit = f.commitOn === 'exit' || state.changed.includes(f.id)
  const moved: PanelState = {
    ...state,
    cursor: state.cursor + 1 >= fields.length ? -1 : state.cursor + 1,
    digit: 0,
    changed: state.changed.filter(id => id !== f.id),
  }

  return shouldCommit && f.onCommit ? applyEffect(moved, f.onCommit, trees) : moved
}

/** `dir` is the *selection* delta: Up is -1 because it moves up a list.

    Value editing runs the other way — Up increases a number and steps forward
    through an enum — so the sign is flipped before it reaches `editField`.
    Getting this backwards makes Up count downwards, which is exactly as
    confusing on screen as it sounds. */
function nudge(state: PanelState, screen: Screen, dir: 1 | -1): PanelState {
  if (screen.kind === 'menu') {
    const last = screen.items.length - 1
    return { ...state, selection: Math.min(last, Math.max(0, state.selection + dir)) }
  }

  if (screen.kind === 'alarms') {
    const last = Math.max(0, state.alarms.length - 1)
    return { ...state, selection: Math.min(last, Math.max(0, state.selection + dir)) }
  }

  if (screen.kind === 'form' && state.cursor >= 0) {
    const f = cursorableFields(screen)[state.cursor]
    if (!f) return state
    return {
      ...state,
      values: editField(f, state.values, dir === 1 ? -1 : 1, state.digit),
      changed: state.changed.includes(f.id) ? state.changed : [...state.changed, f.id],
    }
  }

  return state
}

function press(state: PanelState, button: ButtonId, trees: TreeSet): PanelState {
  const screen = screenOf(trees, state)
  if (!screen) return state

  // The keypad is dead while the controller restarts.
  if (state.booting) return state

  switch (button) {
    case 'prg':
      return screen.onPrg ? push(state, screen.onPrg, trees) : state

    case 'esc':
      return screen.onEsc ? jump(state, screen.onEsc) : pop(state)

    case 'alarm': {
      const target = trees[state.treeId]?.alarmScreen
      return target && target !== state.screenId ? push(state, target, trees) : state
    }

    case 'up':
      return nudge(state, screen, -1)

    case 'down':
      return nudge(state, screen, 1)

    case 'enter': {
      if (screen.kind === 'menu') {
        const item = screen.items[state.selection]
        return item?.target ? push(state, item.target, trees) : state
      }
      if (screen.kind === 'form') return advance(state, screen, trees)
      if (screen.kind === 'confirm') return applyEffect(state, screen.onConfirm, trees)
      return state
    }

    default:
      return state
  }
}

export function createPanelReducer(trees: TreeSet, systemTreeId: string) {
  return function panelReducer(state: PanelState, action: PanelAction): PanelState {
    switch (action.type) {
      case 'press': {
        const next = withVisit(press(state, action.button, trees), state.screenId)
        return {
          ...next,
          keys: [...state.keys, { button: action.button, at: action.at ?? 0 }].slice(-MAX_KEYS),
        }
      }

      case 'systemMenu': {
        // Alarm+Enter crosses into the CAREL operating system's own menu, which
        // is a separate tree — it is not part of the IAT application.
        const tree = trees[systemTreeId]
        if (!tree || state.booting) return state
        const next = withVisit(
          {
            ...state,
            treeId: tree.id,
            screenId: tree.root,
            stack: [],
            selection: 0,
            cursor: -1,
            digit: 0,
            changed: [],
          },
          state.screenId,
        )
        const key: KeyEvent = { button: 'systemMenu', at: action.at ?? 0 }
        return { ...next, keys: [...state.keys, key].slice(-MAX_KEYS) }
      }

      case 'bootComplete':
        return state.booting ? { ...state, booting: false } : state

      case 'setAlarms':
        return { ...state, alarms: action.codes, selection: 0 }

      case 'reset':
        return action.to

      default:
        return state
    }
  }
}
