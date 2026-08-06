'use client'

import { Bell, ChevronDown, ChevronUp, CircleDot, CornerDownLeft, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ButtonId } from '@/lib/cpco'

/* The six buttons, laid out the way they sit on a real pGD: Alarm, Prg and Esc
   down the left of the glass, Up, Enter and Down down the right. The layout is
   part of the training — a trainee who learns "Prg is bottom-left of the three
   on the left" carries that to the panel.

   This component is deliberately dumb. It reports pointer down and up and lets
   the simulator decide what they mean, because Alarm and Enter have to be held
   together for three seconds to reach the controller's own menu, and that can
   only be worked out by watching both. */

export type KeyLabel = { id: ButtonId; label: string; hint: string; Icon: typeof Bell }

const LEFT: KeyLabel[] = [
  { id: 'alarm', label: 'Alarm', hint: 'Show active alarms. Hold with Enter for the system menu.', Icon: Bell },
  { id: 'prg', label: 'Prg', hint: 'Open the menus from the main screen.', Icon: CircleDot },
  { id: 'esc', label: 'Esc', hint: 'Go back up one level. Changes nothing.', Icon: Undo2 },
]

const RIGHT: KeyLabel[] = [
  { id: 'up', label: 'Up', hint: 'Move up a list, or increase the value under the cursor.', Icon: ChevronUp },
  { id: 'enter', label: 'Enter', hint: 'Go in, or move the cursor to the next field.', Icon: CornerDownLeft },
  { id: 'down', label: 'Down', hint: 'Move down a list, or decrease the value under the cursor.', Icon: ChevronDown },
]

const KEY_CLASS =
  'flex h-11 w-11 items-center justify-center rounded-lg border border-hairline bg-surface ' +
  'text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand active:bg-surface-strong disabled:opacity-50'

function Key({
  spec,
  held,
  disabled,
  onDown,
  onUp,
}: {
  spec: KeyLabel
  held: boolean
  disabled: boolean
  onDown: (id: ButtonId) => void
  onUp: (id: ButtonId) => void
}) {
  const { Icon } = spec
  return (
    <button
      type="button"
      title={`${spec.label} — ${spec.hint}`}
      aria-label={spec.label}
      disabled={disabled}
      className={cn(KEY_CLASS, held && 'border-brand text-ink')}
      onPointerDown={e => {
        e.preventDefault()
        onDown(spec.id)
      }}
      onPointerUp={() => onUp(spec.id)}
      onPointerLeave={() => onUp(spec.id)}
      onPointerCancel={() => onUp(spec.id)}
    >
      <Icon size={16} />
    </button>
  )
}

export default function PanelKeypad({
  children,
  held,
  disabled = false,
  onDown,
  onUp,
}: {
  /** The display goes between the two button columns. */
  children: React.ReactNode
  held: Set<ButtonId>
  disabled?: boolean
  onDown: (id: ButtonId) => void
  onUp: (id: ButtonId) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-2">
        {LEFT.map(spec => (
          <Key key={spec.id} spec={spec} held={held.has(spec.id)} disabled={disabled} onDown={onDown} onUp={onUp} />
        ))}
      </div>

      <div className="min-w-0 flex-1">{children}</div>

      <div className="flex flex-col gap-2">
        {RIGHT.map(spec => (
          <Key key={spec.id} spec={spec} held={held.has(spec.id)} disabled={disabled} onDown={onDown} onUp={onUp} />
        ))}
      </div>
    </div>
  )
}
