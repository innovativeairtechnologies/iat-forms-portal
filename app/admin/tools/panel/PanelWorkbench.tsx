'use client'

import { useState } from 'react'
import AlarmLab from '@/components/cpco/AlarmLab'
import CpcoPanel from '@/components/cpco/CpcoPanel'
import PointExplorer from '@/components/cpco/PointExplorer'
import { SCENARIOS } from '@/lib/cpco'
import { cn } from '@/lib/utils'

/* Scenario picker around the simulator. This is the surface the simulator gets
   driven and checked on; in the course each scenario is embedded in its own
   lesson instead, so a trainee never picks from a list. */

const FREE_PLAY = 'free'

export default function PanelWorkbench() {
  const [selected, setSelected] = useState<string>('bacnet-instance')

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-ink-faint">Training</p>
        <h1 className="mt-1 text-[22px] font-medium text-ink">Control Panel Simulator</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">
          A working copy of the pGD terminal on our control panel. The buttons behave the way the
          real ones do — Enter moves the cursor to the next field rather than confirming, Up and
          Down change the value under it, and a multi-digit number is entered one digit at a time.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(FREE_PLAY)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            selected === FREE_PLAY
              ? 'border-brand bg-brand text-white'
              : 'border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink',
          )}
        >
          Free play
        </button>
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected === s.id
                ? 'border-brand bg-brand text-white'
                : 'border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink',
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Remounting on change resets the panel — a scenario must always start
          from its own seeded state, never inherit the last one's. */}
      <CpcoPanel
        key={selected}
        scenarioId={selected === FREE_PLAY ? undefined : selected}
      />

      <div className="mt-8 space-y-8">
        <AlarmLab />
        <PointExplorer />
      </div>
    </div>
  )
}
