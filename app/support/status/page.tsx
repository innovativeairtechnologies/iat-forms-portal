import StatusClient from './StatusClient'
import { getStatusCustomerContext } from '@/lib/support-context'

// Session-aware: a signed-in portal customer gets their email prefilled + a quick
// picker of their own requests. Anonymous visitors get the plain public lookup —
// /support/status is NOT gated. Renders per-request.
export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const customerContext = await getStatusCustomerContext()
  return <StatusClient customerContext={customerContext} />
}
