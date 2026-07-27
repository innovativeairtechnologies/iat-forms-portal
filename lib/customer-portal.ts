import 'server-only'
import { createHmac } from 'crypto'

/**
 * Client for provisioning accounts on the CUSTOMER portal deployment.
 *
 * This is the only outbound internal→customer call. The customer portal has its
 * own Supabase project, so a customer invited here does not automatically exist
 * there — this keeps the two in step whenever the customer lifecycle changes:
 *
 *   invite / re-invite  → provisionCustomerPortalAccount('create')
 *   remove portal access→ provisionCustomerPortalAccount('deactivate')
 *   hard delete         → provisionCustomerPortalAccount('delete')
 *
 * Calling it on removal paths is NOT optional. Deleting a customer here without
 * deleting the login there leaves an orphaned login pointing at a company that
 * no longer exists — precisely the redirect-loop bug this app already shipped a
 * fix for once.
 *
 * Signed with the same INTERNAL_BRIDGE_SECRET as the inbound bridge (one secret,
 * both directions). Returns a result rather than throwing: the caller decides
 * what to do, and every call site records the outcome in the audit log so a
 * silent divergence between the two systems is always traceable.
 */

const TIMEOUT_MS = 10_000

export type ProvisionOp = 'create' | 'deactivate' | 'delete'

export type ProvisionResult =
  | { ok: true; skipped?: false; data: Record<string, unknown> }
  | { ok: false; skipped: true; reason: 'unconfigured' }
  | { ok: false; skipped?: false; reason: string }

type ProvisionInput = {
  op: ProvisionOp
  customerId: string
  email?: string
  companyName?: string
  displayName?: string | null
  /** Only for 'create'. The same temp password the welcome email carries, so the
   *  customer's first sign-in works on the new portal too. */
  tempPassword?: string
}

export async function provisionCustomerPortalAccount(
  input: ProvisionInput
): Promise<ProvisionResult> {
  const baseUrl = process.env.CUSTOMER_PORTAL_URL
  const secret = process.env.INTERNAL_BRIDGE_SECRET
  // Not configured yet → report it and let the caller carry on. During the
  // dual-run the internal portal remains fully functional on its own.
  if (!baseUrl || !secret) return { ok: false, skipped: true, reason: 'unconfigured' }

  const path = '/api/provision'
  const timestamp = Date.now().toString()
  const payload = JSON.stringify(input)
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.POST.${path}.${payload}`)
    .digest('hex')

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-iat-timestamp': timestamp,
        'x-iat-signature': signature,
      },
      body: payload,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, reason: data?.error || `HTTP ${res.status}` }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Request failed' }
  }
}

/** Compact, log-safe summary of a provisioning attempt for audit metadata. */
export function provisionSummary(result: ProvisionResult): string {
  if (result.ok) return 'ok'
  return result.skipped ? 'skipped (not configured)' : `failed: ${result.reason}`
}
