/* Shared types for the c.pCO panel simulator.
   Pure and client-safe — no I/O, no React, no `server-only`. The whole point of
   this module is that a screen captured off a real panel becomes a data entry
   here with no code change, so keep behaviour in `machine.ts` and shape here.

   Terminology follows CAREL's, because that is what the manual and the field
   use: a "mask" is a screen, the pGD is the display+keypad terminal, and a
   "tree" is one navigable menu structure (the IAT application has one, the
   CAREL operating system has another reached with Alarm+Enter). */

/** The six physical buttons on the pGD keypad. */
export type ButtonId = 'alarm' | 'prg' | 'esc' | 'up' | 'enter' | 'down'

/** Dot-path into the panel's value store, e.g. `bacnet.deviceInstance`. */
export type ValuePath = string

export type Values = Record<string, string | number | boolean>

/** How a readout is formatted into its 22-column row. */
export type Format = 'int' | 'temp1' | 'raw'

/** Fired when the cursor leaves a field whose value was changed. */
export type Effect =
  | { kind: 'reboot' }
  | { kind: 'goto'; screen: string }
  /** Like `goto`, but does not stack — the screen you came from is replaced.
      The login mask uses this so Esc from the Main Menu returns to the main
      mask rather than dropping you back on the password prompt. */
  | { kind: 'replace'; screen: string }

type FieldBase = {
  id: string
  label: string
  path: ValuePath
  /** `inline` puts label and value on one row; `stacked` right-aligns the value
      on the row below (how the pGD renders Device Instance). */
  layout?: 'inline' | 'stacked'
  onCommit?: Effect
  /** When `onCommit` fires as the cursor leaves the field.

      `change` (the default) is the panel's normal behaviour: cursoring past a
      value you didn't touch does nothing, which is why merely looking at the
      BMS2 mask doesn't prompt you to reboot.

      `exit` fires every time. The login needs it — pressing Enter past the last
      digit has to submit whether or not you retyped the password. */
  commitOn?: 'change' | 'exit'
  /** Present only on some units — rendered but marked. See "standard core,
      job-specific options" in the plan. */
  optional?: boolean
}

export type Field =
  | (FieldBase & { kind: 'enum'; options: string[] })
  | (FieldBase & { kind: 'digits'; digits: number })
  | (FieldBase & { kind: 'number'; min: number; max: number; step?: number })
  /** Not cursorable — the cursor skips it entirely. */
  | (FieldBase & { kind: 'readout'; format?: Format })

export type MenuItem = {
  id: string
  label: string
  /** Stand-in for the pGD's bitmap icons. A short glyph, rendered in the gutter. */
  icon?: string
  target?: string
  optional?: boolean
}

/** A row on a `static` mask. `text` may contain `{path}` tokens, resolved
    against the value store at render time. */
export type RowSpec =
  | { kind: 'blank' }
  | { kind: 'text'; text: string; inverse?: boolean; align?: 'left' | 'right'; scale?: 1 | 2 }
  | { kind: 'pair'; left: string; path: ValuePath; format?: Format }

type ScreenBase = {
  id: string
  /** Where Prg goes from here. On the main mask this is the login. */
  onPrg?: string
  /** Where Esc goes, when it should not simply pop the navigation stack. */
  onEsc?: string
  optional?: boolean
}

/** One active alarm, as the panel lists it. Codes match the BACnet BinaryInput
    instances in `points.ts` so a fault injected on the schematic surfaces here
    and on the bus at the same time. */
export type AlarmLine = { code: string; label: string }

export type Screen =
  | (ScreenBase & {
      kind: 'menu'
      /** Empty string renders no header row — the CAREL system menu has none. */
      header: string
      /** Second line under the header — the Main Menu shows the access level here. */
      subheader?: string
      items: MenuItem[]
      /** `icons` is the IAT application's style: three double-height rows, the
          selection shown as a full-width inverse bar. `caret` is how the CAREL
          operating system draws its own menu: six body-font rows with a `>`
          against the selected one. */
      style?: 'icons' | 'caret'
      /** How many items fit at once. Defaults to 3 for `icons`, 6 for `caret`. */
      visible?: number
    })
  | (ScreenBase & {
      kind: 'form'
      header: string
      fields: Field[]
      /** Put the cursor on the first field on entry instead of above it. The
          login mask does this — its screenshot shows the block already sitting
          on the first digit. */
      autoFocus?: boolean
    })
  | (ScreenBase & { kind: 'static'; rows: RowSpec[] })
  | (ScreenBase & {
      kind: 'confirm'
      header: string
      body: string[]
      footer?: string[]
      onConfirm: Effect
    })
  /** Lists whatever is currently in alarm. Content comes from panel state, not
      from the tree, which is why it is its own kind rather than a `static`. */
  | (ScreenBase & { kind: 'alarms'; header: string; empty: string })

export type Tree = {
  id: string
  label: string
  /** Screen shown on entry. */
  root: string
  /** Where the Alarm button goes from anywhere in this tree. */
  alarmScreen?: string
  screens: Record<string, Screen>
}

/** One rendered character on the LCD. */
export type RenderedCell = {
  ch: string
  inverse: boolean
  cursor: boolean
}

/** One rendered row. Double-height rows consume two of the eight row slots and
    fit half as many characters. */
export type RenderedRow = {
  cells: RenderedCell[]
  scale: 1 | 2
}

/** A keypress, kept for grading. */
export type KeyEvent = { button: ButtonId | 'systemMenu'; at: number }
