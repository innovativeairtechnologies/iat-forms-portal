/* Renders the REAL PsychroChart component to a static HTML page for visual review.
 *
 * The Sizing Studio lives behind the admin auth gate, and SVG geometry fails
 * silently — a bad coordinate transform typechecks and builds perfectly while
 * drawing nonsense. This server-renders the actual component (not a mock-up of it)
 * against real sizing results, wrapped in the real Quiet Precision tokens, so the
 * curves and markers can be eyeballed in both themes.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/preview-psychro-chart.mjs
 * Output: ../claude-design/psychro-chart-preview.html
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import PsychroChart from '../app/admin/sizing-studio/PsychroChart.tsx'
import { calculateSizing, DEFAULT_SIZING_INPUTS } from '../lib/sizing.ts'

const SCENARIOS = [
  {
    title: 'Baseline — 2,000 CFM, 75 °F/60% in, 70 °F/35% target, 10% OA',
    inputs: DEFAULT_SIZING_INPUTS,
  },
  {
    title: 'Deep dry — 8 gr/lb target, forces the high-capacity wheel',
    inputs: { ...DEFAULT_SIZING_INPUTS, target: { tempF: 70, mode: 'grains', grains: 8 } },
  },
  {
    title: 'Heavy ventilation — 50% outside air at 95 °F/60%',
    inputs: { ...DEFAULT_SIZING_INPUTS, freshAirPercent: 50 },
  },
  {
    title: 'Altitude — Denver, 5,280 ft (curves shift with barometric pressure)',
    inputs: { ...DEFAULT_SIZING_INPUTS, altitudeFt: 5280, internalLoadLbPerHour: 200 },
  },
  {
    title: 'Cold / dry entering air — 45 °F, 40% RH (sub-freezing dew points)',
    inputs: {
      ...DEFAULT_SIZING_INPUTS,
      entering: { tempF: 45, mode: 'rh', rh: 40 },
      target: { tempF: 45, mode: 'grains', grains: 6 },
      outsideAir: { tempF: 20, mode: 'rh', rh: 70 },
    },
  },
]

const TOKENS_LIGHT = `
  --canvas:#f7f6f3; --surface:#ffffff; --surface-soft:#fbfaf8; --surface-strong:#efede8;
  --hairline:#e8e6e1; --hairline-soft:#f0eee9; --hairline-strong:#d6d3cc;
  --ink:#1f1e1b; --ink-secondary:#57544d; --ink-muted:#8a867c; --ink-faint:#b3afa5;
  --brand:#089447; --brand-hover:#077a3c; --brand-soft:#e9f6ee; --brand-ink:#0b6b36;
`
const TOKENS_DARK = `
  --canvas:#101215; --surface:#1c2026; --surface-soft:#16191e; --surface-strong:#262b32;
  --hairline:#2a2f37; --hairline-soft:#21252c; --hairline-strong:#3a404a;
  --ink:#f1f3f7; --ink-secondary:#aeb4bd; --ink-muted:#7f858f; --ink-faint:#565c66;
  --brand:#1fb668; --brand-hover:#2bc474; --brand-soft:rgba(31,182,104,.12); --brand-ink:#4ed292;
`

function panel(scenario) {
  const result = calculateSizing(scenario.inputs)
  const svg = renderToStaticMarkup(createElement(PsychroChart, { result }))
  const s = (x) => `${x.tempF.toFixed(1)}°F · ${x.grains.toFixed(1)} gr/lb · ${x.rh.toFixed(0)}% RH`
  return `
  <section class="card">
    <header>
      <p class="overline">${escapeHtml(result.selection.model)}</p>
      <h2>${escapeHtml(scenario.title)}</h2>
      <dl>
        <div><dt>Entering</dt><dd>${s(result.entering)}</dd></div>
        <div><dt>Leaving</dt><dd>${s(result.leaving)}</dd></div>
        <div><dt>Target</dt><dd>${s(result.target)}</dd></div>
        <div><dt>Pressure</dt><dd>${result.pressure.toFixed(2)} psia</dd></div>
      </dl>
    </header>
    <div class="chart">${svg}</div>
  </section>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

const panels = SCENARIOS.map(panel).join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Psychrometric chart — visual check</title>
<style>
  :root { ${TOKENS_LIGHT} }
  html[data-theme="dark"] { ${TOKENS_DARK} }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    background: var(--canvas); color: var(--ink);
    font-family: "Nunito Sans", system-ui, sans-serif;
    font-size: 14px;
  }
  .bar { display:flex; align-items:center; justify-content:space-between; max-width:1100px; margin:0 auto 24px; }
  h1 { font-size:24px; font-weight:650; letter-spacing:-0.02em; margin:0; }
  .sub { color: var(--ink-muted); font-size:13px; margin:4px 0 0; }
  button {
    height:36px; padding:0 14px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:500;
    background: var(--surface); color: var(--ink-secondary); border:1px solid var(--hairline-strong);
    font-family: inherit;
  }
  .card {
    max-width:1100px; margin:0 auto 24px; background:var(--surface);
    border:1px solid var(--hairline); border-radius:12px; overflow:hidden;
  }
  .card > header { padding:16px 20px; border-bottom:1px solid var(--hairline); }
  .overline { font-size:11px; font-weight:650; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-muted); margin:0; }
  .card h2 { font-size:16px; font-weight:600; letter-spacing:-0.011em; margin:4px 0 12px; }
  dl { display:flex; flex-wrap:wrap; gap:8px 28px; margin:0; }
  dl div { display:flex; gap:8px; align-items:baseline; }
  dt { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-muted); }
  dd { margin:0; font-size:13px; font-variant-numeric: tabular-nums; color:var(--ink-secondary); }
  .chart { padding:16px 20px 20px; }
  figcaption { margin-top:8px; font-size:11px; color:var(--ink-muted); display:flex; flex-wrap:wrap; gap:4px 16px; align-items:center; }
  figcaption > span { display:inline-flex; align-items:center; gap:6px; }
  figure { margin:0; }
</style>
</head>
<body>
  <div class="bar">
    <div>
      <h1>Psychrometric chart — visual check</h1>
      <p class="sub">The real <code>PsychroChart</code> component, server-rendered against live sizing results.</p>
    </div>
    <button onclick="document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'">Toggle theme</button>
  </div>
  ${panels}
</body>
</html>`

const outDir = resolve(import.meta.dirname, '../../claude-design')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'psychro-chart-preview.html')
writeFileSync(outPath, html, 'utf8')
console.log(`Wrote ${outPath}`)
console.log(`${SCENARIOS.length} scenarios rendered.`)
