/**
 * IAT Forms Portal — Electrical Controls Engineer Evaluation Test
 * Run with: node scripts/seed-engineer-eval.mjs
 * Requires .env.local to be populated with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const ta = (label, placeholder, required = true, order = 0) => ({
  label, field_type: 'textarea', placeholder, is_required: required, sort_order: order, options: null,
})
const t = (label, placeholder, required = true, order = 0) => ({
  label, field_type: 'text', placeholder, is_required: required, sort_order: order, options: null,
})
const em = (label, placeholder, required = true, order = 0) => ({
  label, field_type: 'email', placeholder, is_required: required, sort_order: order, options: null,
})

const FORM = {
  category: 'Applications',
  title: 'Electrical Controls Engineer Evaluation Test',
  slug: 'electrical-controls-engineer-evaluation',
  description: 'A comprehensive engineering aptitude test for Electrical Controls Engineer candidates covering Hardware & PLC Fundamentals, Signals & Instrumentation, Communication Protocols, NEC/UL/Safety, Drawings & Documentation, PLC Programming, and Practical Engineering Assessment.',
  successMessage: 'Thank you for completing the Electrical Controls Engineer Evaluation Test. Your responses have been received and will be reviewed by the engineering team.',
  fields: [
    // Candidate info
    t('Candidate Name',  'Your full name', true, 0),
    em('Candidate Email', 'your@email.com', true, 1),

    // ── Section 1: Hardware & PLC Fundamentals (30 Points) ───────────────────
    ta('Q1. PLC System Components',
      'List the basic components of a PLC system.',
      true, 2),

    ta('Q2. Sinking vs. Sourcing I/O',
      'Explain the difference between Sinking Inputs, Sourcing Inputs, NPN devices, and PNP devices. Include examples of where each is commonly used.',
      true, 3),

    ta('Q3. Human Machine Interface (HMI)',
      'Describe the role of an HMI in an industrial automation system. Include: Typical operator functions, Alarm management, Data visualization, Diagnostics.',
      true, 4),

    ta('Q4. Control Voltage',
      'Why do industrial control systems commonly use 24VDC instead of 120VAC?',
      true, 5),

    ta("Q5. Ohm's Law",
      'A 24VDC circuit contains a 120Ω resistor. a) What is the current draw? b) What is the power dissipation? c) If the voltage drops to 18VDC, what happens to current?',
      true, 6),

    ta('Q6. AC Power',
      'A 3-phase motor operates at 460VAC, 18A, Power Factor = 0.86. a) Calculate approximate kW. b) Why is power factor important? c) What problems can low PF cause in industrial facilities?',
      true, 7),

    ta('Q7. Electrical Theory',
      'Explain in practical industrial terms: Inductive Load, Inrush Current, Harmonics, Ground Loops.',
      true, 8),

    // ── Section 2: Signals & Instrumentation (25 Points) ────────────────────
    ta('Q8. Industrial Analog Signals',
      'What are the most common voltage and current ranges used for analog signals in industrial automation? Include current signals and voltage signals.',
      true, 9),

    ta('Q9. Digital vs. Analog I/O',
      'What is the difference between Digital Inputs, Digital Outputs, Analog Inputs, and Analog Outputs?',
      true, 10),

    ta('Q10. Digital I/O Devices',
      'Give five examples of digital input devices and five examples of digital output devices.',
      true, 11),

    ta('Q11. Analog I/O Devices',
      'Give five examples of analog input devices and five examples of analog output devices.',
      true, 12),

    ta('Q12. Analog Signal Scaling',
      'A transmitter outputs 4–20mA representing 0–100% RH. a) What RH corresponds to 12mA? b) Why is 4mA preferred over 0mA? c) What troubleshooting steps would you take if the PLC reads 2mA?',
      true, 13),

    ta('Q13. Analog Troubleshooting',
      'A humidity sensor reads 98% RH constantly but the room is clearly dry. List: Possible causes, Troubleshooting order, Expected meter readings, How you isolate PLC vs sensor vs wiring issue.',
      true, 14),

    // ── Section 3: Communication Protocols & Networking (25 Points) ─────────
    ta('Q14. Industrial Communications',
      'Explain how Modbus RTU differs from Modbus TCP. Include: Physical Layer, Network Topology, Speed, Typical Applications.',
      true, 15),

    ta('Q15. Ethernet Infrastructure',
      'What is the difference between Managed and Unmanaged Ethernet Switches? When would you use each?',
      true, 16),

    ta('Q16. PLC Networking',
      'What is the purpose of assigning an IP address to a PLC? Describe: Network communication, Remote access, HMI communications, SCADA integration.',
      true, 17),

    ta('Q17. Industrial Gateways',
      'What is the function of a gateway in an industrial control network? Give practical examples.',
      true, 18),

    ta('Q18. Communication Protocol Experience',
      'Describe your familiarity and experience with: BACnet, Modbus RTU, Modbus TCP, Ethernet/IP, Profinet. Which do you prefer and why?',
      true, 19),

    // ── Section 4: NEC, UL & Safety (20 Points) ─────────────────────────────
    ta('Q19. NEC Knowledge',
      'a) What NEC article generally covers industrial control panels? b) What is SCCR? c) Why is SCCR important for UL508A panels?',
      true, 20),

    ta('Q20. Motor Protection',
      'A 10HP, 460V motor has FLA = 14A. a) How would you size branch protection? b) What is the difference between overload and short-circuit protection? c) Why can motor breakers exceed conductor ampacity?',
      true, 21),

    ta('Q21. Grounding & Bonding',
      'Explain: Equipment Grounding Conductor, Bonding, Neutral vs Ground, Analog signal grounding considerations.',
      true, 22),

    ta('Q22. Arc Flash',
      'a) What factors influence arc flash hazard levels? b) What documentation should exist on a control panel? c) What design decisions reduce arc flash risk?',
      true, 23),

    ta('Q23. Lockout / Tagout',
      'Describe proper lockout/tagout procedure for troubleshooting industrial equipment.',
      true, 24),

    // ── Section 5: Drawings, Schematics & Documentation (30 Points) ─────────
    ta('Q24. Electrical Drawing Standards',
      'Explain the difference between: One-Line Diagram, Schematic, Wiring Diagram, P&ID. What information belongs in a title block?',
      true, 25),

    ta('Q25. P&ID Diagrams',
      'What does P&ID stand for? Describe: Its purpose, Typical symbols, How electrical and controls engineers use it.',
      true, 26),

    ta('Q26. Field Devices on Schematics',
      'How are field devices typically represented on a 24VDC wiring schematic? Include: Sensors, Switches, Solenoids, Remote devices.',
      true, 27),

    ta('Q27. Wire Numbering',
      'Design a wire numbering philosophy for: 480VAC Power, 120VAC Control, 24VDC Control, Analog Signals, Ethernet Communications.',
      true, 28),

    ta('Q28. PLC I/O Documentation',
      'You are given: 2 VFDs, 1 EEV, 6 Temperature Sensors, 2 Humidity Sensors, 4 Safety Devices, BACnet Communication. Create: I/O List Structure, Tag Naming Convention, Documentation Method.',
      true, 29),

    ta('Q29. Panel Layout Standards',
      'Describe best practices for: High Voltage Separation, Analog Signal Routing, VFD Placement, Heat Management, Serviceability, Field Wiring Terminals.',
      true, 30),

    ta('Q30. Schematic Troubleshooting',
      'A compressor contactor will not energize. Using only the schematic, describe your troubleshooting process step-by-step.',
      true, 31),

    // ── Section 6: PLC Programming & Control Theory (35 Points) ────────────
    ta('Q31. PLC Architecture',
      'Describe your preferred PLC architecture for industrial HVAC/dehumidification equipment. Include: PLC Platform, HMI, Remote I/O, Networking, Remote Access, Alarm Handling.',
      true, 32),

    ta('Q32. PLC Programming Exercise',
      'Write ladder logic or pseudocode for a supply fan that: Starts on Enable, Proves Airflow within 10 seconds, Retries twice, Locks out after third failure, Requires Manual Reset.',
      true, 33),

    ta('Q33. PID Fundamentals',
      'What does PID stand for? Describe the function of Proportional, Integral, and Derivative.',
      true, 34),

    ta('Q34. PID Application',
      'Give an example of an industrial process where a PID controller is appropriate. Explain: Controlled Variable, Process Variable, Output Device.',
      true, 35),

    ta('Q35. PID Tuning',
      'How would you tune a discharge air temperature loop? Explain: Oscillation, Integral Windup, Stability.',
      true, 36),

    ta('Q36. VFD Control',
      'Explain: How a VFD controls motor speed, Scalar vs Vector Control, Shielded Cable Requirements, Grounding Considerations.',
      true, 37),

    ta('Q37. Refrigeration & HVAC Controls',
      'Discuss control strategies for: Compressors, EEVs, Condenser Fans, Reheat, Desiccant Reactivation Heaters.',
      true, 38),

    // ── Section 7: Practical Engineering Assessment (40 Points) ─────────────
    ta('Q38. Unit Freeze-Up Troubleshooting',
      'A customer reports the unit keeps freezing. System includes: Chilled Water Precooling, EEV, Compressor Unloading, Occasional Low Airflow. Describe: Data Required, Root Causes, Control Solutions, Mechanical Solutions.',
      true, 39),

    ta('Q39. Control System Design Exercise',
      'Design the control architecture for a custom industrial desiccant dehumidifier. Include: Power Distribution, PLC, HMI, Safety Circuits, Sensors, Networking, Remote Access. Hand sketches acceptable — describe your design in detail.',
      true, 40),

    ta('Q40. Engineering Philosophy',
      'Describe: What separates a good controls engineer from a great one, Your troubleshooting philosophy, Your documentation philosophy, Your automation philosophy.',
      true, 41),

    // ── Bonus (not required) ─────────────────────────────────────────────────
    ta('Q41. AI & Automation in Engineering (Bonus)',
      'How can AI improve: Electrical Drawing Generation, PLC Code Generation, BOM Creation, Testing, Remote Diagnostics?',
      false, 42),

    ta('Q42. Future of Industrial Controls (Bonus)',
      'What do you believe is the future of industrial automation? Discuss: PLCs, Industrial PCs, Edge Computing, Cloud Monitoring, AI-Assisted Diagnostics, Digital Twins.',
      false, 43),
  ],
}

async function run() {
  console.log('Fetching categories...')
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')

  if (catError) {
    console.error('Failed to fetch categories:', catError.message)
    process.exit(1)
  }

  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))
  console.log('Categories found:', Object.keys(catMap).join(', '))

  const categoryId = catMap[FORM.category]
  if (!categoryId) {
    console.error(`No category found for "${FORM.category}"`)
    process.exit(1)
  }

  // Check if slug already exists
  const { data: existing } = await supabase
    .from('forms')
    .select('id')
    .eq('slug', FORM.slug)
    .single()

  if (existing) {
    console.log(`Form with slug "${FORM.slug}" already exists — skipping.`)
    console.log('To re-seed, delete the existing form from the admin panel first.')
    process.exit(0)
  }

  // Insert form
  const { data: form, error: formError } = await supabase
    .from('forms')
    .insert({
      title: FORM.title,
      description: FORM.description,
      category_id: categoryId,
      slug: FORM.slug,
      is_active: true,
      success_message: FORM.successMessage,
    })
    .select()
    .single()

  if (formError || !form) {
    console.error('Failed to create form:', formError?.message)
    process.exit(1)
  }

  console.log(`✓ Form created: "${FORM.title}" (id: ${form.id})`)

  // Insert fields
  const fieldRows = FORM.fields.map((f, i) => ({
    form_id: form.id,
    label: f.label,
    field_type: f.field_type,
    placeholder: f.placeholder || null,
    is_required: f.is_required,
    sort_order: i,
    options: f.options || null,
  }))

  const { error: fieldsError } = await supabase
    .from('form_fields')
    .insert(fieldRows)

  if (fieldsError) {
    console.error('Failed to insert fields:', fieldsError.message)
    process.exit(1)
  }

  console.log(`✓ ${fieldRows.length} fields inserted (${fieldRows.filter(f => f.is_required).length} required, ${fieldRows.filter(f => !f.is_required).length} bonus/optional)`)
  console.log(`\nForm live at: ${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${FORM.slug}`)
}

run().catch(console.error)
