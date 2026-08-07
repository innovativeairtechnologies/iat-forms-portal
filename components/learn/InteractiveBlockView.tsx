'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AlarmLab from '@/components/cpco/AlarmLab'
import CpcoPanel from '@/components/cpco/CpcoPanel'
import PointExplorer from '@/components/cpco/PointExplorer'
import type { ScenarioResult } from '@/lib/cpco'
import type { InteractiveBlockName } from '@/lib/learn-blocks'

/* Turns an interactive marker in a lesson body into a real component.

   The registry lives inside a `'use client'` module on purpose. `LessonContent`
   is a Server Component, and importing a *value* out of a client module into a
   server one is a live 500 — so the server side imports this single component
   and nothing else, and the mapping from marker name to component stays behind
   the boundary.

   An unknown name renders a quiet note rather than throwing. A lesson body is
   data; a typo in a seed migration should not take the page down.

   The registry is typed `Record<InteractiveBlockName, …>`, so a name added to
   `lib/learn-blocks.ts` without a component here fails the build instead of
   shipping a lesson that renders the "isn't available" note. */

/* The HVAC/R widgets are loaded on demand. Several of them pull in three.js and
   react-three-fiber, which is a large bundle that must not land on the ~360
   lessons that embed nothing — and none of them can server-render usefully
   anyway (WebGL, matchMedia, canvas measurement all need a browser).

   ⚠️ Every options object below is written out literally, and it has to be.
   `next/dynamic` is compiled by SWC, which requires an OBJECT LITERAL at the
   call site — hoisting the shared `{ ssr: false }` into a const and spreading
   it fails the build with "next/dynamic options must be an object literal".
   TypeScript is perfectly happy with the spread, so this only ever shows up as
   a 500 at request time. Do not DRY these up. */
const Skeleton = () => <div className="h-[280px] animate-pulse rounded-xl bg-surface-strong" />

const CycleWidget = dynamic(() => import('@/components/hvacr/CycleWidget'), { ssr: false, loading: Skeleton })
const CompressorWidget = dynamic(() => import('@/components/hvacr/CompressorWidget'), { ssr: false, loading: Skeleton })
const TxvWidget = dynamic(() => import('@/components/hvacr/TxvWidget'), { ssr: false, loading: Skeleton })
const PhaseWidget = dynamic(() => import('@/components/hvacr/PhaseWidget'), { ssr: false, loading: Skeleton })
const MoleculeWidget = dynamic(() => import('@/components/hvacr/MoleculeWidget'), { ssr: false, loading: Skeleton })
const CoilWidget = dynamic(() => import('@/components/hvacr/CoilWidget'), { ssr: false, loading: Skeleton })
const CircuitWidget = dynamic(() => import('@/components/hvacr/CircuitWidget'), { ssr: false })

const PpeMatcher = dynamic(() => import('@/components/hvacr/ExplorerWidgets').then((m) => m.PpeMatcher), { ssr: false })
const ComponentMap = dynamic(() => import('@/components/hvacr/ExplorerWidgets').then((m) => m.ComponentMap), { ssr: false })
const ControlSequence = dynamic(() => import('@/components/hvacr/ExplorerWidgets').then((m) => m.ControlSequence), { ssr: false })
const SystemTypes = dynamic(() => import('@/components/hvacr/ExplorerWidgets').then((m) => m.SystemTypes), { ssr: false })

const TempConverter = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.TempConverter), { ssr: false })
const DiagnosticQuadrant = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.DiagnosticQuadrant), { ssr: false })
const PsychrometricChart = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.PsychrometricChart), { ssr: false })
const MicronGauge = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.MicronGauge), { ssr: false })
const PmChecklist = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.PmChecklist), { ssr: false })
const EpaTools = dynamic(() => import('@/components/hvacr/CalculatorWidgets').then((m) => m.EpaTools), { ssr: false })

const LabelExercise = dynamic(() => import('@/components/hvacr/LabelExercise'), { ssr: false })
const SequenceExercise = dynamic(() => import('@/components/hvacr/SequenceExercise'), { ssr: false })
const ClassifyExercise = dynamic(() => import('@/components/hvacr/ClassifyExercise'), { ssr: false })
const CalcClassifyExercise = dynamic(() => import('@/components/hvacr/CalcClassifyExercise'), { ssr: false })
const BranchSim = dynamic(() => import('@/components/hvacr/BranchSim'), { ssr: false })
const Flashcards = dynamic(() => import('@/components/hvacr/Flashcards'), { ssr: false })
const Certificate = dynamic(() => import('@/components/hvacr/Certificate'), { ssr: false })

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
     uses, so the two can never disagree about what "complete" means.

     Only the c.pCO scenarios are graded. The HVAC/R drills are rehearsal: they
     show their own answer key on a wrong attempt, which is exactly why they must
     not write to anyone's record. The graded assessment for that course is its
     `learn_quizzes` knowledge check, whose key never reaches the browser. */
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

  const registry: Record<InteractiveBlockName, () => React.ReactNode> = {
    'cpco-sim': () => (
      <CpcoPanel
        scenarioId={params.scenario}
        guided={params.guided === 'true'}
        onComplete={onComplete}
      />
    ),
    'cpco-points': () => <PointExplorer />,
    'cpco-alarm-lab': () => <AlarmLab />,

    'hvacr-cycle-3d': () => <CycleWidget />,
    'hvacr-compressor-3d': () => <CompressorWidget />,
    'hvacr-txv-3d': () => <TxvWidget />,
    'hvacr-phase-particles': () => <PhaseWidget />,
    'hvacr-molecule-3d': () => <MoleculeWidget />,
    'hvacr-coil-3d': () => <CoilWidget coil={params.coil} />,

    'hvacr-ppe-matcher': () => <PpeMatcher />,
    'hvacr-component-map': () => <ComponentMap />,
    'hvacr-control-circuit': () => <CircuitWidget />,
    'hvacr-control-sequence': () => <ControlSequence />,
    'hvacr-system-types': () => <SystemTypes />,

    'hvacr-temp-converter': () => <TempConverter />,
    'hvacr-diagnostic-quadrant': () => <DiagnosticQuadrant />,
    'hvacr-psychrometric-chart': () => <PsychrometricChart />,
    'hvacr-micron-gauge': () => <MicronGauge />,
    'hvacr-pm-checklist': () => <PmChecklist />,
    'hvacr-epa-tools': () => <EpaTools />,

    'hvacr-label': () => <LabelExercise set={params.set} />,
    'hvacr-sequence': () => <SequenceExercise set={params.set} />,
    'hvacr-classify': () => <ClassifyExercise set={params.set} />,
    'hvacr-calc-classify': () => <CalcClassifyExercise set={params.set} />,
    'hvacr-branch': () => <BranchSim />,
    'hvacr-flashcards': () => <Flashcards module={params.module} />,
    'hvacr-certificate': () => <Certificate />,
  }

  const render = registry[name as InteractiveBlockName]

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
