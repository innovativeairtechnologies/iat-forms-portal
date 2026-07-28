/* Lets the `verify-*.mjs` scripts import the app's TypeScript modules directly.
 *
 * Node ≥22.18 strips TypeScript types on its own, but its ESM resolver still demands
 * an explicit file extension. Everything under lib/ imports extensionless
 * (`from './psychro'`) because that's what the Next.js/TS bundler resolution expects
 * — so rather than making the app code non-idiomatic to suit a dev script, this hook
 * teaches Node the same resolution rule.
 *
 * Usage:  node --import ./scripts/ts-resolve.mjs scripts/verify-sizing.mjs
 */

import { registerHooks, createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// Mirror the tsconfig `@/*` → project-root alias.
const ROOT = pathToFileURL(resolvePath(import.meta.dirname, '..')).href + '/'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      specifier = ROOT + specifier.slice(2)
    }
    // Only relative/aliased, extensionless specifiers — leave bare packages alone.
    if ((specifier.startsWith('.') || specifier.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try {
          return nextResolve(specifier + ext, context)
        } catch {
          // Try the next candidate.
        }
      }
    }
    return nextResolve(specifier, context)
  },

  // Node strips TypeScript *types* on its own but cannot transform JSX, so .tsx
  // files need a real transpile. Uses the repo's own TypeScript install.
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx')) {
      const ts = require('typescript')
      const source = readFileSync(fileURLToPath(url), 'utf8')
      const { outputText } = ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      })
      return { format: 'module', source: outputText, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
