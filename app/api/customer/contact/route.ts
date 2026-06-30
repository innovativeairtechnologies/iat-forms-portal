import { NextRequest, NextResponse } from 'next/server'
import { getCustomerUser } from '@/lib/customer-auth'
import { sendCustomerContactEmail } from '@/lib/resend-customer'

// A logged-in customer's "Contact Us" message → emailed to the IAT team.
// Identity (company / contact / email) is taken from the session, never trusted
// from the client.
export async function POST(req: NextRequest) {
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, department } = (await req.json().catch(() => ({}))) as { message?: string; department?: string }
  const text = (message || '').trim()
  if (!text) return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: 'That message is too long.' }, { status: 400 })

  // Normalize to a known department; unknown/missing falls back to Customer Service.
  const DEPARTMENTS = ['Sales', 'Customer Service', 'Engineering', 'Billing']
  const dept = DEPARTMENTS.includes((department || '').trim()) ? (department as string).trim() : 'Customer Service'

  const { customer, displayName, user } = session
  try {
    const res = await sendCustomerContactEmail({
      companyName: customer.company_name,
      contactName: displayName,
      contactEmail: (user.email || customer.contact_email || '').toLowerCase(),
      department: dept,
      message: text,
    })
    if (res.error) return NextResponse.json({ error: 'Could not send your message.' }, { status: 502 })
  } catch (e) {
    console.error('[customer/contact] email threw:', e)
    return NextResponse.json({ error: 'Could not send your message.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
