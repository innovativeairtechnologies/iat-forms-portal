import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Builds the prompt for the Troubleshooting Checklist AI tips, grounded in the
// desiccant "Five Fundamentals" so the advice is on-brand and safe. Reads the
// same field names the wizard collects / the troubleshooting_intakes row stores.
export function buildTroubleshootingPrompt(d: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  const yn = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : 'Not reported')
  const tri = (v: unknown) =>
    v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'unsure' ? 'Unsure' : 'Not reported'
  const onset =
    d.onset === 'sudden' ? 'Sudden' : d.onset === 'gradual' ? 'Gradual' : d.onset === 'unsure' ? 'Unsure' : 'Not reported'
  const factors =
    Array.isArray(d.external_factors) && d.external_factors.length
      ? (d.external_factors as unknown[]).filter(f => typeof f === 'string').join(', ')
      : 'None reported'
  const changed = s(d.what_changed)
  const alarms = s(d.alarm_details)

  return `You are a senior technical support engineer at IAT (Innovative Air Technologies), a manufacturer of industrial desiccant dehumidifiers.

A customer is troubleshooting a unit. From their answers below, give 1-3 concise, SAFE steps they can check or try right now while waiting for an IAT engineer. Ground your advice in the desiccant fundamentals: desiccant wheel condition, wheel rotation, process/react airflow balance (typical ratios ~3:1, up to 6-7:1 for very low grain), reactivation heat (~285°F design target; sustained readings above ~320°F usually indicate an airflow problem), and rotor seal integrity (light leakage = air bypassing the wheel). A SUDDEN drop points to electrical/mechanical/control faults (heater, fan, VFD, sensor, power outage); GRADUAL loss points to dirty filters, wheel aging, airflow drift, seal wear, coil fouling, or a changed room/process load. Do not suggest anything requiring opening high-voltage panels or voiding warranty.

Equipment: Model ${s(d.model_number) || '?'} | Serial ${s(d.serial_number) || '?'} | Voltage ${s(d.voltage) || '?'}
Problem: ${s(d.problem_description) || '(none given)'}
Started: ${s(d.problem_started) || 'Not reported'}
Onset: ${onset}${changed ? ` | Changed just before: ${changed}` : ''}
Unit currently running: ${yn(d.unit_running)} | Active alarms: ${yn(d.has_alarms)}${alarms ? ` (${alarms})` : ''}
Process airflow: ${s(d.process_airflow_cfm) || '?'} CFM | React airflow: ${s(d.react_airflow_cfm) || '?'} CFM | Reactivation temp: ${s(d.react_temp_f) || '?'} °F
Wheel rotating: ${tri(d.wheel_rotating)} | Visible seal light leakage: ${tri(d.seal_light_leakage)}
External factors noted: ${factors}

Respond with ONLY a raw JSON array of 1-3 strings. Each string is one specific, safe-to-try step (1-2 sentences). No markdown, no preamble — raw JSON array only.`
}

// Generates up to 3 troubleshooting tips. Non-fatal: returns [] on any error so a
// model hiccup never blocks the customer's submission.
export async function generateTroubleshootingTips(d: Record<string, unknown>): Promise<string[]> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: buildTroubleshootingPrompt(d) }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 3)
    }
  } catch (err) {
    console.error('[troubleshooting-ai] tip generation failed:', err)
  }
  return []
}
