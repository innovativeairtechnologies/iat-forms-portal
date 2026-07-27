#!/usr/bin/env node
/* Copies MapLibre's web-worker module (plus the shared chunk it imports) out of
   node_modules into public/maplibre/ so the territory map serves it from our
   own origin.
 *
 * WHY THIS EXISTS: maplibre-gl v6 is ESM-only and locates its worker via
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Webpack (Next 15
 * production build) does NOT rewrite that into an emitted asset — it inlines
 * import.meta.url as a literal file:/// path from the build machine (grep
 * 'file:///' in the built maplibre chunk). At runtime the worker can't load,
 * MapLibre's relative fallback gets 307'd to /login by middleware ("module
 * script ... text/html" console error), and the map renders a silent blank
 * canvas. MapCanvas.tsx calls maplibregl.setWorkerUrl() pointing at the copy
 * this makes, bypassing bundler worker-resolution entirely.
 *
 * BOTH files must ship: maplibre-gl-worker.mjs imports ./maplibre-gl-shared.mjs
 * relative to its own URL. /maplibre/* is outside the middleware matcher, so
 * the worker fetch is never auth-gated. The copies are committed; this runs on
 * prebuild so bumping maplibre-gl can't leave a stale (mismatched) worker —
 * a main/worker version skew fails at runtime, the worst place to find out.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'node_modules', 'maplibre-gl', 'dist')
const destDir = join(root, 'public', 'maplibre')
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12)
const version = JSON.parse(readFileSync(join(root, 'node_modules', 'maplibre-gl', 'package.json'), 'utf8')).version

let wrote = 0
for (const name of FILES) {
  const src = join(srcDir, name)
  if (!existsSync(src)) {
    console.error(`[sync-maplibre-worker] ${name} missing from maplibre-gl ${version} — the dist layout changed; update this script and MapCanvas.setWorkerUrl.`)
    process.exit(1)
  }
  const bytes = readFileSync(src)
  const dest = join(destDir, name)
  if (existsSync(dest) && sha(readFileSync(dest)) === sha(bytes)) continue
  mkdirSync(destDir, { recursive: true })
  writeFileSync(dest, bytes)
  wrote++
  console.log(`[sync-maplibre-worker] wrote public/maplibre/${name} (maplibre-gl ${version}, ${(bytes.length / 1024).toFixed(0)}KB, sha ${sha(bytes)}) — commit it.`)
}
if (!wrote) console.log(`[sync-maplibre-worker] public/maplibre/ is current (maplibre-gl ${version}).`)
