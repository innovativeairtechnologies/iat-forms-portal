import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { answerCustomerJerry, type ChatMsg } from '@/lib/customer-jerry'

export const dynamic = 'force-dynamic'

// Keep the conversation bounded: enough for context, small enough to cap cost
// and to stop a caller pushing an arbitrarily long transcript at the model.
const MAX_TURNS = 12
const MAX_CHARS = 4000

/**
 * Bridge: ask the customer-facing Jerry.
 *
 * Jerry runs ENTIRELY on this side and returns only the finished answer. That is
 * the whole point: the Anthropic key, the RAG pool (kb_documents / kb_chunks),
 * the `is_internal` exclusion, and the competitor scrub never leave the internal
 * deployment. Re-hosting Jerry on the customer side would mean reproducing all
 * four faithfully — and a mistake in any of them leaks internal docs or names a
 * competitor.
 *
 * Reuses answerCustomerJerry verbatim, so the split portal, the live internal
 * customer route, and the admin preview all produce byte-identical behavior.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/jerry')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  // Validate the transcript shape rather than trusting it — this is model input.
  const raw = Array.isArray(auth.body.history) ? auth.body.history : []
  const history: ChatMsg[] = raw
    .filter(
      (m): m is ChatMsg =>
        !!m &&
        typeof m === 'object' &&
        ((m as ChatMsg).role === 'user' || (m as ChatMsg).role === 'assistant') &&
        typeof (m as ChatMsg).content === 'string' &&
        !!(m as ChatMsg).content.trim()
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))

  // The Messages API requires the transcript to end on a user turn.
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'History must end with a user message' }, { status: 400 })
  }

  // Company name is looked up here, not accepted from the caller — it goes into
  // the system prompt, so letting the caller set it is a prompt-injection seam.
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_name')
    .eq('id', customerId)
    .maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Unknown customer' }, { status: 404 })

  try {
    const { reply, sources } = await answerCustomerJerry({
      customerId,
      companyName: customer.company_name,
      history,
    })
    return NextResponse.json({ reply, sources })
  } catch (e) {
    console.error('[bridge/jerry] failed:', e)
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 })
  }
}
