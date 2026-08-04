'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  solveDuct,
  secondsPerRevolution,
  sectorDwellSeconds,
  rphFromSeconds,
  coilWidthForRows,
  COIL_WIDTHS_IN,
  bypassCfm,
  btuhToKw,
  kwToBtuh,
  roundDuctAreaFt2,
  velocityFpm,
  diameterForVelocityIn,
} from '@/lib/hvac-calcs'

/* The standalone calculators, ported from DryWare's suite (lib/hvac-calcs.ts).
 *
 * These sit under the sizing result rather than in the main form because they are
 * reference tools a rep reaches for mid-job, not inputs to the selection. All pure
 * client-side maths — nothing here reads or writes anything. */

export default function Calculators() {
  const [open, setOpen] = useState<string>('duct')
  const tabs = [
    { key: 'duct', label: 'Duct' },
    { key: 'velocity', label: 'Velocity / CFM' },
    { key: 'rph', label: 'RPH / time' },
    { key: 'bypass', label: 'Bypass' },
    { key: 'coil', label: 'Coil widths' },
    { key: 'energy', label: 'BTU / kW' },
  ]

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-3.5">
        <h2 className="text-[16px] font-semibold tracking-[-0.011em] text-ink">Calculators</h2>
        <p className="text-[12px] text-ink-muted">Reference tools — independent of the sizing above</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-hairline px-5 pt-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setOpen(t.key)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              open === t.key
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {open === 'duct' && <DuctCalc />}
        {open === 'velocity' && <VelocityCalc />}
        {open === 'rph' && <RphCalc />}
        {open === 'bypass' && <BypassCalc />}
        {open === 'coil' && <CoilCalc />}
        {open === 'energy' && <EnergyCalc />}
      </div>
    </div>
  )
}

// ─── Duct ────────────────────────────────────────────────────────────────────

function DuctCalc() {
  const [cfm, setCfm] = useState<number | ''>(2000)
  const [friction, setFriction] = useState<number | ''>(0.1)
  const [runFt, setRunFt] = useState<number | ''>(100)

  const sol = useMemo(
    () => (cfm && friction ? solveDuct({ cfm: n(cfm), frictionPer100ft: n(friction) }, n(runFt) || 100) : null),
    [cfm, friction, runFt],
  )

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-ink-muted">
        Round galvanised duct. 0.1 in.wg/100 ft is the usual design friction rate — at that rate
        1,000 CFM lands on ~14 in.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Num label="Airflow" unit="CFM" value={cfm} onChange={setCfm} />
        <Num label="Friction" unit="in/100ft" value={friction} onChange={setFriction} step={0.01} />
        <Num label="Run length" unit="ft" value={runFt} onChange={setRunFt} step={10} />
      </div>
      {sol && (
        <Out
          rows={[
            ['Diameter', `${sol.diameterIn.toFixed(1)} in`],
            ['Velocity', `${sol.velocityFpm.toFixed(0)} fpm`],
            ['Friction', `${sol.frictionPer100ft.toFixed(3)} in.wg / 100 ft`],
            [`Total over ${n(runFt) || 100} ft`, `${sol.totalLoss.toFixed(3)} in.wg`],
          ]}
        />
      )}
    </div>
  )
}

// ─── Velocity / CFM ──────────────────────────────────────────────────────────

function VelocityCalc() {
  const [cfm, setCfm] = useState<number | ''>(2000)
  const [dia, setDia] = useState<number | ''>(14)
  const area = dia ? roundDuctAreaFt2(n(dia)) : 0
  const vel = cfm && area ? velocityFpm(n(cfm), area) : 0
  const [targetV, setTargetV] = useState<number | ''>(1500)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Num label="Airflow" unit="CFM" value={cfm} onChange={setCfm} />
        <Num label="Diameter" unit="in" value={dia} onChange={setDia} step={0.5} />
        <Num label="Target velocity" unit="fpm" value={targetV} onChange={setTargetV} step={50} />
      </div>
      <Out
        rows={[
          ['Face area', `${area.toFixed(3)} ft²`],
          ['Velocity', `${vel.toFixed(0)} fpm`],
          [
            'Diameter for target',
            cfm && targetV ? `${diameterForVelocityIn(n(cfm), n(targetV)).toFixed(1)} in` : '—',
          ],
        ]}
      />
    </div>
  )
}

// ─── RPH ─────────────────────────────────────────────────────────────────────

function RphCalc() {
  const [rph, setRph] = useState<number | ''>(20)
  const [procDeg, setProcDeg] = useState<number | ''>(270)
  const [secs, setSecs] = useState<number | ''>('')

  const revSec = rph ? secondsPerRevolution(n(rph)) : 0
  const reactDeg = 360 - (n(procDeg) || 0)

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-ink-muted">
        Dwell is why RPH has an optimum rather than &ldquo;faster is better&rdquo;: too fast and
        the desiccant never saturates or never fully regenerates, too slow and it saturates and
        rides through.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Num label="Rotation" unit="RPH" value={rph} onChange={setRph} step={1} />
        <Num label="Process sector" unit="°" value={procDeg} onChange={setProcDeg} step={5} />
        <Num label="Or: seconds/rev" unit="s" value={secs} onChange={setSecs} step={5} />
      </div>
      <Out
        rows={[
          ['Seconds per revolution', revSec ? `${revSec.toFixed(1)} s` : '—'],
          ['Process dwell', rph ? `${sectorDwellSeconds(n(rph), n(procDeg) || 0).toFixed(1)} s` : '—'],
          [`React dwell (${reactDeg}°)`, rph ? `${sectorDwellSeconds(n(rph), reactDeg).toFixed(1)} s` : '—'],
          ['RPH from seconds/rev', secs ? `${rphFromSeconds(n(secs)).toFixed(1)} RPH` : '—'],
        ]}
      />
    </div>
  )
}

// ─── Bypass ──────────────────────────────────────────────────────────────────

function BypassCalc() {
  const [total, setTotal] = useState<number | ''>(2000)
  const [inlet, setInlet] = useState<number | ''>(80)
  const [outlet, setOutlet] = useState<number | ''>(10)
  const [target, setTarget] = useState<number | ''>(45)

  const r = useMemo(
    () => bypassCfm(n(total), n(inlet), n(outlet), n(target)),
    [total, inlet, outlet, target],
  )

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-ink-muted">
        A wheel dries well below most targets, so running the whole airstream through it
        over-dries and wastes reactivation heat. Bypass part of it and remix.
      </p>
      <div className="grid grid-cols-4 gap-3">
        <Num label="Total air" unit="CFM" value={total} onChange={setTotal} />
        <Num label="Inlet" unit="gr/lb" value={inlet} onChange={setInlet} />
        <Num label="Wheel outlet" unit="gr/lb" value={outlet} onChange={setOutlet} />
        <Num label="Target" unit="gr/lb" value={target} onChange={setTarget} />
      </div>
      {r.unreachable ? (
        <p className="text-[13px] text-amber-600 dark:text-amber-400">
          Target isn&rsquo;t reachable by bypassing — it must sit between the wheel outlet and the
          untreated inlet.
        </p>
      ) : (
        <Out
          rows={[
            ['Bypass', `${(r.bypassFraction * 100).toFixed(1)} %`],
            ['Bypassed air', `${r.bypassCfm.toFixed(0)} CFM`],
            ['Through the wheel', `${r.throughWheelCfm.toFixed(0)} CFM`],
          ]}
        />
      )}
    </div>
  )
}

// ─── Coil widths ─────────────────────────────────────────────────────────────

function CoilCalc() {
  const [rows, setRows] = useState<number | ''>(4)
  const w = rows ? coilWidthForRows(n(rows)) : null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Num label="Coil rows" unit="rows" value={rows} onChange={setRows} step={1} />
      </div>
      <Out rows={[['Casing width', w == null ? 'Not an offered row count' : `${w} in`]]} />
      <table className="w-full max-w-xs border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-surface-soft">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Rows</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Width</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline-soft">
          {COIL_WIDTHS_IN.map((c) => (
            <tr key={c.rows} className={n(rows) === c.rows ? 'bg-brand-soft' : ''}>
              <td className="px-3 py-2 tabular-nums text-ink-secondary">{c.rows}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">{c.widthIn}&quot;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Energy ──────────────────────────────────────────────────────────────────

function EnergyCalc() {
  const [btuh, setBtuh] = useState<number | ''>(100000)
  const [kw, setKw] = useState<number | ''>('')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Num label="Heat" unit="BTU/hr" value={btuh} onChange={setBtuh} step={1000} />
        <Num label="Or: power" unit="kW" value={kw} onChange={setKw} step={1} />
      </div>
      <Out
        rows={[
          ['BTU/hr → kW', btuh ? `${btuhToKw(n(btuh)).toFixed(2)} kW` : '—'],
          ['kW → BTU/hr', kw ? `${kwToBtuh(n(kw)).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTU/hr` : '—'],
        ]}
      />
    </div>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function n(v: number | ''): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function Num({
  label,
  unit,
  value,
  onChange,
  step = 1,
}: {
  label: string
  unit: string
  value: number | ''
  onChange: (v: number | '') => void
  step?: number
}) {
  const id = `c-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 pr-16 text-[13px] tabular-nums text-ink transition-colors hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">
          {unit}
        </span>
      </div>
    </div>
  )
}

function Out({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft px-4 py-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-hairline-soft py-2 last:border-0">
          <span className="text-[13px] text-ink-muted">{k}</span>
          <span className="text-[13px] font-medium tabular-nums text-ink">{v}</span>
        </div>
      ))}
    </div>
  )
}
