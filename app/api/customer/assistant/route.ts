import { NextRequest, NextResponse } from 'next/server'
import { getCustomerUser } from '@/lib/customer-auth'
import { answerCustomerJerry, type ChatMsg } from '@/lib/customer-jerry'

// Read-only customer assistant (Jerry). Resolves the signed-in customer, then
// hands off to the shared answerCustomerJerry helper (also used, under admin
// auth, by /api/admin/customer-jerry for internal QA). Grounded server-side in
// THIS customer's equipment + IAT's published KB; it can answer but not act.
export async function POST(req: NextRequest) {
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] }
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .slice(-12)
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Ask a question.' }, { status: 400 })
  }

  try {
    const result = await answerCustomerJerry({
      customerId: session.customerId,
      companyName: session.customer.company_name,
      history,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[customer/assistant] error:', e)
    return NextResponse.json({ error: 'The assistant is unavailable right now. Please try again shortly.' }, { status: 500 })
  }
}
