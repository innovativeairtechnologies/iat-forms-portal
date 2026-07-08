import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { answerCustomerJerry, type ChatMsg } from '@/lib/customer-jerry'

// Admin-only PREVIEW of the exact customer-facing Jerry, for internal QA. Gated
// to full admins (getAdminUser is strict; the 'customer_jerry' perm is
// non-delegatable). The admin picks which customer to "preview as" via the
// ?customerId query param so answers use that customer's real equipment
// grounding; with no customerId it runs ungrounded ("no equipment on file").
// Reuses answerCustomerJerry so it's byte-for-byte the customer experience.
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const customerId = req.nextUrl.searchParams.get('customerId') || null

  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] }
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .slice(-12)
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Ask a question.' }, { status: 400 })
  }

  let companyName = 'a customer'
  if (customerId) {
    const { data: c } = await supabaseAdmin
      .from('customers')
      .select('company_name')
      .eq('id', customerId)
      .maybeSingle()
    if (c?.company_name) companyName = c.company_name
  }

  try {
    const result = await answerCustomerJerry({ customerId, companyName, history })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[admin/customer-jerry] error:', e)
    return NextResponse.json({ error: 'The assistant is unavailable right now. Please try again shortly.' }, { status: 500 })
  }
}
