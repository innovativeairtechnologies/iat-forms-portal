import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { sendTicketConfirmationToCustomer, sendTicketNotificationToAdmins } from '@/lib/resend-tickets'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(body: Record<string, unknown>): string {
  const yn = (v: unknown) => v === true ? 'Yes' : v === false ? 'No' : 'Not reported'

  const preCooling = body.pre_cooling === null
    ? 'Not reported'
    : body.pre_cooling
      ? `Installed — Type: ${body.pre_cooling_type || 'unspecified'}, Working: ${yn(body.pre_cooling_working)}`
      : 'Not installed'

  const postCooling = body.post_cooling === null
    ? 'Not reported'
    : body.post_cooling
      ? `Installed — Type: ${body.post_cooling_type || 'unspecified'}, Working: ${yn(body.post_cooling_working)}`
      : 'Not installed'

  const airflow = body.airflow_balanced === false
    ? `Unbalanced — Process: ${body.process_airflow_cfm || '?'} CFM, React: ${body.react_airflow_cfm || '?'} CFM`
    : yn(body.airflow_balanced)

  const heat = body.react_heat_working === true
    ? `Working — Maintaining 285°F setpoint: ${yn(body.react_heat_setpoint)}`
    : yn(body.react_heat_working)

  return `You are a technical support assistant for IAT (Innovative Air Technologies), a manufacturer of industrial heat-sealing systems.

A customer submitted a support ticket. Based on their system data, provide 1-3 concise troubleshooting steps they can safely attempt while waiting for a service technician.

Equipment: Model ${body.model_number} | Serial ${body.serial_number} | Voltage ${body.voltage}
Problem: ${body.problem_description}
Pre-cooling: ${preCooling}
Post-cooling: ${postCooling}
Airflow balance: ${airflow}
React heat: ${heat}
Seals: ${yn(body.seals_good)}

Respond with ONLY a raw JSON array of 1–3 strings. Each string is one actionable step (1–2 sentences, specific to the reported issue). No markdown, no explanation — raw JSON array only.`
}

export async function POST(req: NextRequest) {
  // Tight window: each ticket is a DB insert + a Claude call + two emails.
  const limited = await rateLimit(req, { name: 'tickets', max: 5, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

    const ts = Date.now().toString().slice(-6)
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const ticket_number = `TKT-${ts}-${rand}`

    const { data: ticket, error: insertError } = await supabaseAdmin
      .from('tickets')
      .insert({
        ticket_number,
        customer_name: body.customer_name,
        customer_company: body.customer_company || null,
        customer_email: body.customer_email,
        customer_phone: body.customer_phone || null,
        serial_number: body.serial_number,
        model_number: body.model_number,
        voltage: body.voltage,
        problem_description: body.problem_description,
        pre_cooling: body.pre_cooling ?? null,
        pre_cooling_type: body.pre_cooling_type || null,
        pre_cooling_working: body.pre_cooling_working ?? null,
        post_cooling: body.post_cooling ?? null,
        post_cooling_type: body.post_cooling_type || null,
        post_cooling_working: body.post_cooling_working ?? null,
        airflow_balanced: body.airflow_balanced ?? null,
        process_airflow_cfm: body.process_airflow_cfm || null,
        react_airflow_cfm: body.react_airflow_cfm || null,
        react_heat_working: body.react_heat_working ?? null,
        react_heat_setpoint: body.react_heat_setpoint ?? null,
        seals_good: body.seals_good ?? null,
        photo_urls: body.photo_urls?.length ? body.photo_urls : null,
        status: 'open',
        priority: 'med',
      })
      .select()
      .single()

    if (insertError || !ticket) {
      console.error('Ticket insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    let ai_recommendations: string[] = []
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: buildPrompt(body) }],
      })
      const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) ai_recommendations = parsed.slice(0, 3)
    } catch (aiErr) {
      console.error('AI recommendations error:', aiErr)
    }

    if (ai_recommendations.length > 0) {
      await supabaseAdmin
        .from('tickets')
        .update({ ai_recommendations })
        .eq('id', ticket.id)
    }

    // Email loop — customer confirmation + staff notification. Awaited so
    // Vercel doesn't kill the function before Resend fires; failures are
    // logged but never fail the ticket.
    const fullTicket = { ...ticket, ai_recommendations: ai_recommendations.length ? ai_recommendations : null }

    const { data: admins } = await supabaseAdmin
      .from('employees')
      .select('email')
      .eq('is_admin', true)
    const adminEmails = admins?.map(a => a.email) ?? []
    const fallback = process.env.ADMIN_NOTIFICATION_EMAIL
    if (fallback && !adminEmails.includes(fallback)) adminEmails.push(fallback)

    await Promise.all([
      sendTicketConfirmationToCustomer(fullTicket).catch(console.error),
      adminEmails.length
        ? sendTicketNotificationToAdmins(fullTicket, adminEmails).catch(console.error)
        : Promise.resolve(console.log('[tickets] no admin recipients configured — staff notification skipped')),
    ])

    return NextResponse.json({ success: true, ticket_number, ai_recommendations })
  } catch (err) {
    console.error('Ticket route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
