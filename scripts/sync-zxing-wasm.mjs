#!/usr/bin/env node
/* Copies the ZXing reader .wasm out of node_modules into public/wasm/ so the
   Tool Crib scanner serves it from our own origin.
 *
 * WHY THIS EXISTS: zxing-wasm hardcodes a jsDelivr CDN URL as the default
 * location for its .wasm binary (grep 'fastly.jsdelivr.net' in
 * node_modules/zxing-wasm/dist/es/share.js). Left alone, every barcode scan in
 * the warehouse would depend on a third-party CDN being reachable from the shop
 * floor — and it would fail at the point of use, on someone's phone, holding a
 * drill. lib/tool-crib-scanner.ts points locateFile at the copy this makes.
 *
 * The copy is committed so a missing postinstall can never ship a broken
 * scanner. This script runs on prebuild to re-sync it, so bumping zxing-wasm
 * can't silently leave a stale binary behind: a wasm/JS version mismatch fails
 * at runtime, not at build, which is the worst place to find out.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm')
const destDir = join(root, 'public', 'wasm')
const dest = join(destDir, 'zxing_reader.wasm')

if (!existsSync(src)) {
  console.error('[sync-zxing-wasm] zxing-wasm not installed — run npm install first.')
  process.exit(1)
}

const bytes = readFileSync(src)
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12)

if (existsSync(dest) && sha(readFileSync(dest)) === sha(bytes)) {
  console.log('[sync-zxing-wasm] public/wasm/zxing_reader.wasm is current.')
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })
writeFileSync(dest, bytes)

const version = JSON.parse(
  readFileSync(join(root, 'node_modules', 'zxing-wasm', 'package.json'), 'utf8')
).version

console.log(
  `[sync-zxing-wasm] wrote public/wasm/zxing_reader.wasm ` +
  `(zxing-wasm ${version}, ${(bytes.length / 1024 / 1024).toFixed(2)}MB, sha ${sha(bytes)}) — commit it.`
)
