// Render the Gantt sales guide (HTML) → PDF, self-contained (logo inlined).
// Usage:  node docs/guides/render.mjs
// Requires the repo's existing deps (playwright, sharp).
import { chromium } from 'playwright'
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..') // iat-forms-portal/

const htmlPath = join(here, 'gantt-sales-guide.html')
const outPath = join(here, 'gantt-sales-guide.pdf')
const logoSrc = join(repo, 'public', 'iat-logo-transparent.png')

const logoBuf = await sharp(logoSrc).resize({ width: 320 }).png({ compressionLevel: 9 }).toBuffer()
const logoUri = 'data:image/png;base64,' + logoBuf.toString('base64')

const html = readFileSync(htmlPath, 'utf8').replaceAll('{{LOGO}}', logoUri)

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle' })
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: outPath,
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%; font-size:8px; color:#8A877F; padding:0 16mm; display:flex; justify-content:space-between; font-family:Segoe UI, sans-serif;">' +
    '<span>IAT Portal — Gantt Field Guide · Internal</span>' +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' +
    '</div>',
  margin: { top: '15mm', bottom: '16mm', left: '16mm', right: '16mm' },
})
await browser.close()
console.log('Wrote', outPath, '(' + (readFileSync(outPath).length / 1024).toFixed(0) + ' KB)')
