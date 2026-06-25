import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCustomerUser } from '@/lib/customer-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { effectiveWarrantyEnd, warrantyState, daysUntilWarrantyEnd } from '@/lib/equipment'
import { milestoneProgress } from '@/lib/customer'
import type { Equipment, EquipmentMilestone } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Read-only customer assistant. Grounded server-side in THIS customer's equipment
// + IAT's published KB; it can answer questions but cannot take any action.
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

  const { customerId, customer } = session

  // ── Ground in this customer's equipment + milestones + the KB ──────────────
  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
  const units = (equipmentData || []) as Equipment[]
  const unitIds = units.map((u) => u.id)

  const msByUnit: Record<string, EquipmentMilestone[]> = {}
  if (unitIds.length) {
    const { data: ms } = await supabaseAdmin
      .from('equipment_milestones')
      .select('*')
      .in('equipment_id', unitIds)
      .order('sort_order', { ascending: true })
    for (const m of (ms || []) as EquipmentMilestone[]) (msByUnit[m.equipment_id] ||= []).push(m)
  }

  const { data: kb } = await supabaseAdmin
    .from('kb_articles')
    .select('title, excerpt, category')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(24)

  const unitLines = units.length
    ? units
        .map((u) => {
          const w = warrantyState(u)
          const end = effectiveWarrantyEnd(u)
          const days = daysUntilWarrantyEnd(u)
          const prog = milestoneProgress(msByUnit[u.id] || [])
          const stages = (msByUnit[u.id] || []).map((m) => `${m.stage}=${m.status}`).join(', ') || 'no tracker'
          return `- Serial ${u.serial_number} | model ${u.model_number || '—'} | ${u.voltage || ''} | location ${u.location || '—'} | ship ${u.ship_date || '—'} | warranty ${w}${end ? ` (through ${end}${days != null ? `, ${days}d left` : ''})` : ''} | build/ship: ${prog.currentStage || '—'} (${prog.percent}%) [${stages}]`
        })
        .join('\n')
    : '(no equipment on file)'

  const kbLines = (kb || []).map((a) => `- ${a.title}${a.excerpt ? `: ${a.excerpt}` : ''}`).join('\n') || '(none)'

  const system = `You are the IAT Assistant, a friendly customer-support assistant for Innovative Air Technologies (IAT), a manufacturer of industrial desiccant dehumidifiers. You are speaking with a representative of ${customer.company_name}.

Answer using ONLY the information below plus general, non-specific dehumidifier guidance. Be concise, warm, and helpful.

Rules:
- You are READ-ONLY. You cannot open tickets, change orders, schedule service, or take any action. If the customer wants something actionable (service, parts, a warranty claim, a complaint), point them to "Submit a request" / "Check status" in their portal, or the Contact Us form on their dashboard.
- Never invent serial numbers, dates, warranty terms, model specs, or shipping status. If a detail isn't in the data below, say you don't have it and suggest contacting IAT.
- Do not discuss other customers, pricing, or internal IAT matters.
- Keep answers short — a few sentences. Plain text, no markdown headings.

THIS CUSTOMER'S EQUIPMENT:
${unitLines}

IAT KNOWLEDGE BASE (titles / summaries):
${kbLines}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    })
    const reply = message.content[0]?.type === 'text' ? message.content[0].text : ''
    return NextResponse.json({
      reply: reply || "Sorry — I couldn't put together an answer. Please try again, or use Contact Us.",
    })
  } catch (e) {
    console.error('[customer/assistant] error:', e)
    return NextResponse.json({ error: 'The assistant is unavailable right now. Please try again shortly.' }, { status: 500 })
  }
}
