'use client'

/* The 24V control circuit, energised and de-energised.
 *
 * The idea a first-year technician needs is that a low-voltage circuit does not
 * run the compressor — it runs a coil, and the coil closes contacts that run the
 * compressor. Flipping the switch here moves the contacts on screen, so the two
 * circuits stay visibly separate.
 *
 * Drawn as JSX rather than a markup string because the geometry changes with
 * state, and a diff of moving parts should be readable.
 */

import { useState } from 'react'
import { SVG, SVG_WASH } from '@/lib/hvacr/palette'
import { ToggleButton, WidgetBody, WidgetFrame } from './WidgetFrame'
import { ResultNote } from './WidgetFrame'

export default function CircuitWidget() {
  const [on, setOn] = useState(false)

  const wire = on ? SVG.wireLive : SVG.neutral

  return (
    <WidgetFrame caption="Flip the thermostat call and watch what actually happens: the control circuit energises a coil, and the coil closes the contacts that feed the compressor.">
      <WidgetBody>
        <div className="mx-auto w-full" style={{ maxWidth: 480 }}>
          <svg viewBox="0 0 480 220" xmlns="http://www.w3.org/2000/svg" className="block w-full">
            <title>24 volt control circuit</title>

            {/* Control circuit — the low-voltage loop */}
            <rect x="20" y="20" width="30" height="60" fill="none" stroke={SVG.wire} strokeWidth="3" />
            <text x="35" y="95" fontSize="11" textAnchor="middle" fill={SVG.wire}>
              Transformer
            </text>

            <line x1="50" y1="30" x2="150" y2="30" stroke={wire} strokeWidth="3" strokeDasharray="6 5" />
            <rect
              x="150"
              y="15"
              width="40"
              height="30"
              fill={SVG_WASH.live}
              stroke={SVG.wireLive}
              strokeWidth="2"
            />
            <text x="170" y="60" fontSize="11" textAnchor="middle" fill={SVG.wireLive}>
              Thermostat
            </text>

            <line x1="190" y1="30" x2="290" y2="30" stroke={wire} strokeWidth="3" strokeDasharray="6 5" />
            <circle
              cx="310"
              cy="30"
              r="20"
              fill={on ? 'rgba(74,58,167,.35)' : 'none'}
              stroke={SVG.metering}
              strokeWidth="3"
            />
            <text x="310" y="65" fontSize="11" textAnchor="middle" fill={SVG.metering}>
              Contactor coil
            </text>

            <line x1="50" y1="70" x2="330" y2="70" stroke={SVG.wire} strokeWidth="3" />
            <line x1="330" y1="30" x2="330" y2="70" stroke={SVG.wire} strokeWidth="3" />

            {/* Load circuit — line voltage, opened and closed by the contacts */}
            <rect
              x="150"
              y={on ? 66 : 120}
              width="40"
              height="16"
              fill={on ? SVG.evaporator : SVG.condenser}
              style={{ transition: 'y 200ms ease-out, fill 200ms ease-out' }}
            />
            <text x="170" y="155" fontSize="11" textAnchor="middle" fill={SVG.condenser}>
              Contacts
            </text>

            <line x1="60" y1="128" x2="150" y2="128" stroke={SVG.wire} strokeWidth="3" />
            <line x1="190" y1="128" x2="280" y2="128" stroke={SVG.wire} strokeWidth="3" />
            <circle
              cx="320"
              cy="128"
              r="26"
              fill={on ? 'rgba(208,59,59,.4)' : 'rgba(208,59,59,.15)'}
              stroke={SVG.compressor}
              strokeWidth="3"
            />
            <text x="320" y="165" fontSize="11" textAnchor="middle" fill={SVG.compressor}>
              Compressor
            </text>
            <line x1="60" y1="60" x2="60" y2="128" stroke={SVG.wire} strokeWidth="3" />
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ToggleButton active={on} onClick={() => setOn((v) => !v)}>
            Call for cooling: {on ? 'ON' : 'OFF'}
          </ToggleButton>
        </div>

        <div className="mt-3">
          <ResultNote tone={on ? 'correct' : 'neutral'}>
            {on
              ? 'Energised — the coil pulls the contacts closed, and line voltage reaches the compressor. Note that the thermostat never carried the compressor current itself.'
              : 'De-energised — the contacts are open and the compressor is off. The control circuit is the only part carrying voltage when the thermostat is satisfied.'}
          </ResultNote>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}
