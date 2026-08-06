'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AlarmLab from '@/components/cpco/AlarmLab'
import CpcoPanel from '@/components/cpco/CpcoPanel'
import PointExplorer from '@/components/cpco/PointExplorer'
import type { ScenarioResult } from '@/lib/cpco'

/* Turns an interactive marker in a lesson body into a real component.

   The registry lives inside a `'use client'` module on purpose. `LessonContent`
   is a Server Component, and importing a *value* out of a client module into a
   server one is a live 500 — so the server side imports this single component
   and nothing else, and the mapping from marker name to component stays behind
   the boundary.

   An unknown name renders a quiet note rather than throwing. A lesson body is
   data; a typo in a seed migration should not take the page down. */

export default function InteractiveBlockView({
  name,
  params,
  lessonId,
}: {
  name: string
  params: Record<string, string>
  lessonId?: string
}) {
  const router = useRouter()
  const posted = useRef(false)

  /* Passing a graded scenario records the run and completes the lesson.

     Both posts are fire-and-forget: the trainee already sees the pass state on
     the panel itself, and a flaky network must not take that away. The attempt
     post carries the evidence; the progress post is what feeds XP, streaks and
     the assignments compliance report — the same route the Mark-complete button
     uses, so the two can never disagree about what "complete" means. */
  const onComplete = useCallback(
    (result: ScenarioResult) => {
      if (posted.current) return
      posted.current = true

      const scenarioId = params.scenario
      void (async () => {
        try {
          if (scenarioId) {
            await fetch('/api/learn/sim-attempt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scenarioId,
                passed: result.passed,
                keystrokes: result.keystrokes,
              }),
            })
          }
          if (lessonId) {
            await fetch('/api/learn/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lessonId, completed: true }),
            })
            // The footer's completed state and the subject progress bar are
            // server-rendered; refresh so they agree with what just happened.
            router.refresh()
          }
        } catch {
          // Deliberately quiet — see above.
        }
      })()
    },
    [lessonId, params.scenario, router],
  )

  const registry: Record<string, () => React.ReactNode> = {
    'cpco-sim': () => (
      <CpcoPanel
        scenarioId={params.scenario}
        guided={params.guided === 'true'}
        onComplete={onComplete}
      />
    ),
    'cpco-points': () => <PointExplorer />,
    'cpco-alarm-lab': () => <AlarmLab />,
  }

  const render = registry[name]

  if (!render) {
    return (
      <div className="learn-prose-interactive rounded-xl border border-dashed border-hairline bg-surface px-5 py-6 text-center text-[13px] text-ink-muted">
        This lesson refers to an interactive exercise (<code>{name}</code>) that isn’t available.
      </div>
    )
  }

  // `learn-prose-interactive` switches off the reading styles inside the
  // widget. Without it `.learn-prose p`, `ul` and `li` would reach in and put
  // reading margins and disc bullets on the simulator's own chrome.
  return <div className="learn-prose-interactive">{render()}</div>
}
