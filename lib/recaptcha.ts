const SCORE_THRESHOLD = 0.5

type SiteVerifyResponse = {
  success: boolean
  score?: number
  action?: string
  'error-codes'?: string[]
}

export type RecaptchaOptions = {
  /**
   * Reject instead of allowing when verification cannot be performed at all —
   * no secret configured, or Google unreachable.
   *
   * Default (false) is right for customer-facing SUBMISSIONS: a missing env var
   * or a bad day at Google must never be the reason a real customer cannot reach
   * us. Losing a support ticket is worse than admitting a bot.
   *
   * Set true for anonymous WRITES into existing records, where reCAPTCHA is the
   * load-bearing control rather than a nicety. There, failing open would mean one
   * missing env var silently turns the endpoint into an open door — and unlike a
   * lost submission, nobody would notice.
   */
  failClosed?: boolean
  /** Override the 0.5 default. Higher = stricter. */
  minScore?: number
}

/**
 * Verifies a reCAPTCHA v3 token against Google's siteverify endpoint.
 *
 * Fails OPEN by default — same philosophy as lib/rate-limit.ts — so a missing env
 * var, a network hiccup, or an outage at Google never blocks a real customer from
 * submitting. Only an explicit failure/low-score verdict from Google blocks.
 *
 * Pass `failClosed: true` to invert that for endpoints where this check is the
 * only thing standing between a stranger and a write.
 */
export async function verifyRecaptcha(
  token: string | undefined,
  action: string,
  options: RecaptchaOptions = {},
): Promise<{ ok: boolean; reason?: string }> {
  const { failClosed = false, minScore = SCORE_THRESHOLD } = options
  const secret = process.env.RECAPTCHA_SECRET_KEY

  if (!secret) {
    if (failClosed) {
      console.error('[recaptcha] RECAPTCHA_SECRET_KEY not set — REJECTING (fail-closed endpoint)')
      return { ok: false, reason: 'verification unavailable' }
    }
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
    if (typeof json.score === 'number' && json.score < minScore) {
      return { ok: false, reason: `low score (${json.score} < ${minScore})` }
    }

    return { ok: true }
  } catch (e) {
    console.error('[recaptcha] siteverify request failed:', e)
    if (failClosed) return { ok: false, reason: 'verification unavailable' }
    return { ok: true } // fail open — never block a real customer over a network hiccup to Google
  }
}
