'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Check, Keyboard, Lightbulb, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import PanelDisplay from './PanelDisplay'
import PanelKeypad from './PanelKeypad'
import {
  alarmLabel,
  createPanel,
  evaluateScenario,
  panelReducer,
  renderScreen,
  scenarioById,
  TREES,
  type ButtonId,
  type ScenarioResult,
} from '@/lib/cpco'

/* The simulator: a working pGD a trainee can actually drive.

   Three behaviours here are worth understanding before changing anything.

   1. Alarm and Enter fire on RELEASE, not on press. Every other button fires on
      press. That asymmetry exists because holding those two together for three
      seconds is how you reach the controller's own menu — if they fired on
      press, arming the combo would also trip the alarm mask.

   2. Up and Down auto-repeat when held. A numeric field on a real panel steps
      by one, and some of them run to 65535; without repeat the simulator would
      be honest and unusable at the same time.

   3. Keyboard input is scoped to the panel, not the window. The simulator is
      embedded in lesson pages, and a global Escape or Enter listener would
      quietly eat keys the rest of the page wants. */

const HOLD_MS = 3000
const REPEAT_DELAY_MS = 400
const REPEAT_MS = 90
const BOOT_MS = 1400

const KEYS: Record<string, ButtonId> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'enter',
  Escape: 'esc',
  p: 'prg',
  P: 'prg',
  a: 'alarm',
  A: 'alarm',
}

export default function CpcoPanel({
  scenarioId,
  guided = false,
  onComplete,
  className,
}: {
  /** Omit for free play — no brief, no goals, nothing to pass. */
  scenarioId?: string
  /** Show every hint up front, for a walk-me-through lesson. */
  guided?: boolean
  onComplete?: (result: ScenarioResult) => void
  className?: string
}) {
  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId])
  const [state, dispatch] = useReducer(panelReducer, scenario, createPanel)
  const [heldView, setHeldView] = useState<ButtonId[]>([])
  const [arming, setArming] = useState(false)
  const [hintsShown, setHintsShown] = useState(guided ? Number.MAX_SAFE_INTEGER : 0)
  const [focused, setFocused] = useState(false)

  const held = useRef<Set<ButtonId>>(new Set())
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comboFired = useRef(false)
  const repeatDelay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTick = useRef<ReturnType<typeof setInterval> | null>(null)
  const reported = useRef(false)

  const screen = TREES[state.treeId]?.screens[state.screenId]

  const rows = useMemo(() => {
    if (!screen) return []
    return renderScreen(screen, {
      values: state.values,
      cursor: state.cursor,
      digit: state.digit,
      selection: state.selection,
      alarms: state.alarms.map(code => ({ code: `BI${code}`, label: alarmLabel(Number(code)) })),
    })
  }, [screen, state.values, state.cursor, state.digit, state.selection, state.alarms])

  const result = useMemo(
    () => (scenario ? evaluateScenario(scenario, state) : null),
    [scenario, state],
  )

  const fire = useCallback((button: ButtonId) => {
    dispatch({ type: 'press', button, at: Date.now() })
  }, [])

  const stopRepeat = useCallback(() => {
    if (repeatDelay.current) clearTimeout(repeatDelay.current)
    if (repeatTick.current) clearInterval(repeatTick.current)
    repeatDelay.current = null
    repeatTick.current = null
  }, [])

  const cancelCombo = useCallback(() => {
    if (comboTimer.current) clearTimeout(comboTimer.current)
    comboTimer.current = null
    setArming(false)
  }, [])

  const onDown = useCallback(
    (id: ButtonId) => {
      if (held.current.has(id)) return
      held.current.add(id)
      setHeldView([...held.current])

      if (id === 'up' || id === 'down') {
        fire(id)
        stopRepeat()
        repeatDelay.current = setTimeout(() => {
          repeatTick.current = setInterval(() => fire(id), REPEAT_MS)
        }, REPEAT_DELAY_MS)
      } else if (id === 'prg' || id === 'esc') {
        fire(id)
      }
      // Alarm and Enter deliberately do nothing yet — see the note above.

      if (held.current.has('alarm') && held.current.has('enter') && !comboTimer.current) {
        setArming(true)
        comboTimer.current = setTimeout(() => {
          comboFired.current = true
          comboTimer.current = null
          setArming(false)
          dispatch({ type: 'systemMenu', at: Date.now() })
        }, HOLD_MS)
      }
    },
    [fire, stopRepeat],
  )

  const onUp = useCallback(
    (id: ButtonId) => {
      if (!held.current.has(id)) return
      held.current.delete(id)
      setHeldView([...held.current])

      if (id === 'up' || id === 'down') stopRepeat()
      cancelCombo()

      // A press that was part of a completed combo is swallowed, so reaching
      // the system menu doesn't also leave you on the alarm mask.
      if ((id === 'alarm' || id === 'enter') && !comboFired.current) fire(id)

      if (!held.current.has('alarm') && !held.current.has('enter')) comboFired.current = false
    },
    [cancelCombo, fire, stopRepeat],
  )

  // The keypad is dead while the controller restarts; bring it back after a
  // beat so the restart reads as a real event rather than a flicker.
  useEffect(() => {
    if (!state.booting) return
    const t = setTimeout(() => dispatch({ type: 'bootComplete' }), BOOT_MS)
    return () => clearTimeout(t)
  }, [state.booting])

  useEffect(() => () => {
    if (comboTimer.current) clearTimeout(comboTimer.current)
    if (repeatDelay.current) clearTimeout(repeatDelay.current)
    if (repeatTick.current) clearInterval(repeatTick.current)
  }, [])

  useEffect(() => {
    if (!result?.passed || reported.current) return
    reported.current = true
    onComplete?.(result)
  }, [result, onComplete])

  const reset = useCallback(() => {
    stopRepeat()
    cancelCombo()
    held.current.clear()
    comboFired.current = false
    reported.current = false
    setHeldView([])
    setHintsShown(guided ? Number.MAX_SAFE_INTEGER : 0)
    dispatch({ type: 'reset', to: createPanel(scenario) })
  }, [cancelCombo, guided, scenario, stopRepeat])

  const hints = scenario?.hints ?? []
  const visibleHints = hints.slice(0, hintsShown)
  const passed = result?.passed ?? false

  return (
    <div className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
      {scenario && (
        <div className="border-b border-hairline px-5 py-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Your task</p>
          {/* Type goes on the span, not the h3: `.learn-prose-interactive h3` in
              globals.css resets font-size/weight/letter-spacing to `inherit` at
              specificity (0,1,1), which beats a Tailwind utility (0,1,0). */}
          <h3 className="mt-1">
            <span className="text-[15px] font-medium text-ink">{scenario.title}</span>
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">{scenario.brief}</p>
        </div>
      )}

      <div
        tabIndex={0}
        role="application"
        aria-label="c.pCO control panel simulator"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          held.current.clear()
          setHeldView([])
          stopRepeat()
          cancelCombo()
        }}
        onKeyDown={e => {
          const button = KEYS[e.key]
          if (!button) return
          e.preventDefault()
          if (e.repeat) return // we run our own repeat, at the panel's cadence
          onDown(button)
        }}
        onKeyUp={e => {
          const button = KEYS[e.key]
          if (!button) return
          e.preventDefault()
          onUp(button)
        }}
        className={cn(
          'px-5 py-5 outline-none',
          focused && 'ring-2 ring-inset ring-brand',
        )}
      >
        <div className="mx-auto max-w-md">
          <PanelKeypad held={new Set(heldView)} disabled={false} onDown={onDown} onUp={onUp}>
            <PanelDisplay rows={rows} off={state.booting} />
          </PanelKeypad>
        </div>

        <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <Keyboard size={12} />
            {focused ? 'Arrows, Enter, Esc, P, A' : 'Click the panel to use your keyboard'}
          </span>
          <span className="tabular-nums">{state.keys.length} presses</span>
          {arming && <span className="text-ink-secondary">Hold for the system menu…</span>}
          {state.booting && <span className="text-ink-secondary">Restarting…</span>}
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2 py-1 text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <RotateCcw size={11} />
            Start over
          </button>
        </div>
      </div>

      {scenario && result && (
        <div className="border-t border-hairline px-5 py-4">
          <ul className="space-y-2">
            {result.goals.map(goal => (
              <li key={goal.label} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={cn(
                    'mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    goal.done
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-hairline-strong',
                  )}
                >
                  {goal.done && <Check size={10} strokeWidth={3} />}
                </span>
                <span className={goal.done ? 'text-ink' : 'text-ink-muted'}>{goal.label}</span>
              </li>
            ))}
          </ul>

          {passed ? (
            <div className="mt-4 rounded-lg border border-hairline bg-surface-soft px-4 py-3">
              <p className="text-[13px] font-medium text-ink">
                Done — {result.keystrokes} presses
                {result.extraKeystrokes > 0
                  ? ` (${result.extraKeystrokes} more than the short way)`
                  : ', the short way'}
                .
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{scenario.debrief}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {visibleHints.map((hint, i) => (
                <p key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-secondary">
                  <Lightbulb size={12} className="mt-0.5 shrink-0 text-ink-faint" />
                  {hint}
                </p>
              ))}
              {hintsShown < hints.length && (
                <button
                  type="button"
                  onClick={() => setHintsShown(n => n + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Lightbulb size={11} />
                  {hintsShown === 0 ? 'Stuck? Get a hint' : 'Another hint'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
