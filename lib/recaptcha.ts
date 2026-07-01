const SCORE_THRESHOLD = 0.5

type SiteVerifyResponse = {
  success: boolean
  score?: number
  action?: string
  'error-codes'?: string[]
}

/**
 * Verifies a reCAPTCHA v3 token against Google's siteverify endpoint. Fails
 * OPEN — same philosophy as lib/rate-limit.ts — so a missing env var, a
 * network hiccup, or an outage at Google never blocks a real customer from
 * submitting. Only an explicit failure/low-score verdict from Google blocks.
 */
export async function verifyRecaptcha(token: string | undefined, action: string): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) {
    console.warn('[recaptcha] RECAPTCHA_SECRET_KEY not set — skipping verification')
    return { ok: true }
  }

  if (!token) return { ok: false, reason: 'missing token' }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const json = (await res.json()) as SiteVerifyResponse

    if (!json.success) return { ok: false, reason: 'verification failed' }
    if (json.action !== action) return { ok: false, reason: 'action mismatch' }
    if (typeof json.score === 'number' && json.score < SCORE_THRESHOLD) return { ok: false, reason: `low score (${json.score})` }

    return { ok: true }
  } catch (e) {
    console.error('[recaptcha] siteverify request failed:', e)
    return { ok: true } // fail open — never block a real customer over a network hiccup to Google
  }
}
