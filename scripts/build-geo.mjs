// ─────────────────────────────────────────────────────────────────────────────
// build-geo.mjs — generate the committed boundary files for the territory map
// (/admin/territories). Run manually, once (or to refresh): `node scripts/build-geo.mjs`.
// Outputs are COMMITTED to public/geo/ — unlike sync-zxing-wasm.mjs this is not
// a prebuild step, because boundaries don't drift with npm install.
//
// Why not us-atlas? Its TopoJSON is PRE-PROJECTED (d3.geoAlbersUsa, a composite
// projection that relocates Alaska/Hawaii into a 975×610 viewport) — MapLibre
// needs real lon/lat. So we pull:
//   • US states + Canadian provinces — Natural Earth 1:50m admin-1 (lon/lat,
//     public domain). properties kept: { code, name } where code is the USPS
//     state code ('TX') / Canadian postal province code ('ON') — the same codes
//     stored in company_territories.code.
//   • US counties — the Census 2010 1:20m cartographic boundaries (lon/lat,
//     public domain, via the widely-mirrored plotly/datasets copy). Feature id
//     is the 5-digit county FIPS — the code stored for level='county'.
//     Territories (AS/GU/MP/PR/VI, STATE fips > 56) are dropped: the state
//     layer has no matching feature, so a county there could never render.
//
// Both are converted to quantized, topology-aware-simplified TopoJSON so the
// shipped files stay small (counties: ~2.4MB GeoJSON → ~600KB TopoJSON). The
// client converts back to GeoJSON with topojson-client at load time.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'
import { presimplify, simplify, quantile } from 'topojson-simplify'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'geo')

const NE_ADMIN1 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
const COUNTIES =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'

async function fetchJson(url) {
  console.log(`fetching ${url} …`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

/** topology → presimplify → keep the strongest (1-p) share of points → out. */
function toTopo(objects, { simplifyQuantile = 0, quantization = 1e5 } = {}) {
  let topo = topology(objects, quantization)
  if (simplifyQuantile > 0) {
    topo = presimplify(topo)
    topo = simplify(topo, quantile(topo, simplifyQuantile))
  }
  return topo
}

async function write(name, topo) {
  const json = JSON.stringify(topo)
  await writeFile(path.join(OUT, name), json)
  console.log(`  wrote public/geo/${name} (${(json.length / 1024).toFixed(0)}KB)`)
}

await mkdir(OUT, { recursive: true })

// ── US states + Canadian provinces (one Natural Earth download) ──────────────
const admin1 = await fetchJson(NE_ADMIN1)

const pick = (adm0) =>
  admin1.features
    .filter((f) => f.properties?.adm0_a3 === adm0 && f.properties?.postal)
    .map((f) => ({
      type: 'Feature',
      id: f.properties.postal,
      properties: { code: f.properties.postal, name: f.properties.name },
      geometry: f.geometry,
    }))

const usStates = pick('USA')
const caProvinces = pick('CAN')
console.log(`US states: ${usStates.length} features, CA provinces: ${caProvinces.length} features`)

await write('us-states.json', toTopo({ states: { type: 'FeatureCollection', features: usStates } }, { simplifyQuantile: 0.4 }))
// Canada's arctic coastline is coordinate-dense at 1:50m — simplify harder.
await write('ca-provinces.json', toTopo({ provinces: { type: 'FeatureCollection', features: caProvinces } }, { simplifyQuantile: 0.6 }))

// ── US counties ──────────────────────────────────────────────────────────────
const countiesRaw = await fetchJson(COUNTIES)
const counties = countiesRaw.features
  .filter((f) => String(f.properties?.STATE ?? f.id?.slice(0, 2)) <= '56')
  .map((f) => ({
    type: 'Feature',
    id: String(f.id),
    properties: { name: f.properties?.NAME ?? '', state: String(f.properties?.STATE ?? String(f.id).slice(0, 2)) },
    geometry: f.geometry,
  }))
console.log(`US counties: ${counties.length} features`)

await write('us-counties.json', toTopo({ counties: { type: 'FeatureCollection', features: counties } }, { simplifyQuantile: 0.3 }))

console.log('done.')
