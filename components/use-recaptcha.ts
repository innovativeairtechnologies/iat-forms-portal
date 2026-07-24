/* Shared reCAPTCHA v3 client helper — a plain async token-getter callable from
   any submit/handler (no hook, no placement rules). Lazily loads Google's api.js
   on first use (deduped against any existing loader, incl. the support form's
   inline <Script>), waits briefly for it, then returns a token for `action`.

   Fail-open everywhere: no site key, a blocked/slow script, or a timeout returns
   `undefined` — and the server verifier (lib/recaptcha.ts) also fails open on a
   missing secret or a Google outage — so reCAPTCHA never blocks a real user; it
   only adds a bot-score signal when it's available. Accesses window.grecaptcha
   via a local cast (no `declare global`) so it can't clash with other modules'
   ambient Window augmentations. */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

type Grecaptcha = {
  ready: (cb: () => void) => void
  execute: (siteKey: string, opts: { action: string }) => Promise<string>
}
const gre = (): Grecaptcha | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha

function ensureScript() {
  if (!SITE_KEY || typeof document === 'undefined') return
  if (document.querySelector('script[src*="recaptcha/api.js"]')) return
  const s = document.createElement('script')
  s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
  s.async = true
  s.defer = true
  document.head.appendChild(s)
}

// The token may be requested mid-flow (e.g. a photo-OCR call) shortly after the
// async script is injected — wait briefly, then fail open rather than hang.
async function waitForReady(timeoutMs = 5000): Promise<boolean> {
  const start = Date.now()
  while (!gre()) {
    if (Date.now() - start > timeoutMs) return false
    await new Promise((r) => setTimeout(r, 80))
  }
  return true
}

/** A reCAPTCHA v3 token for `action`, or undefined (fail-open — never throws). */
export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === 'undefined') return undefined
  ensureScript()
  if (!(await waitForReady())) return undefined
  const g = gre()
  if (!g) return undefined
  try {
    await new Promise<void>((resolve) => g.ready(() => resolve()))
    return await g.execute(SITE_KEY, { action })
  } catch (e) {
    console.error('[recaptcha] token fetch failed:', e)
    return undefined
  }
}
