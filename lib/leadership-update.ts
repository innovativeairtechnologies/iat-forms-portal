import { readFile } from 'fs/promises'
import path from 'path'
import { anthropic } from './anthropic'

// ─── The weekly leadership update ────────────────────────────────────────────
//
// Turns the last seven days of CHANGELOG.md into a one-page summary a director
// can read in under a minute, and mails it as a Word attachment.
//
// ── Why the changelog is the source ─────────────────────────────────────────
// Because it is already written, already accurate, and already updated on every
// deploy (a standing rule). Deriving the update from git subjects instead would
// mean summarising commit messages, which describe code; the changelog entries
// describe what changed for the business, which is what leadership is asking
// about. It also means this report cannot drift from reality — if nothing was
// written to the changelog, nothing is claimed.
//
// ── Why an LLM ──────────────────────────────────────────────────────────────
// The changelog is written for the next engineer: it names files, env vars and
// migrations. Leadership needs the same facts in their own terms. That is a
// translation, not an invention — the prompt below forbids adding anything not
// present in the source, because a report that quietly embellishes is worse
// than no report.

export type UpdateSection = { title: string; items: string[] }

export type LeadershipUpdate = {
  weekEnding: string
  sections: UpdateSection[]
  /** Entry headings that fed the summary — logged so a thin week is explicable. */
  sourceEntries: string[]
}

const CHANGELOG = path.join(process.cwd(), 'CHANGELOG.md')

/**
 * Changelog entries dated within `days` of `asOf`. Entries are `## YYYY-MM-DD — title`
 * and newest-first, so we take from the top until one falls out of range.
 */
export function recentEntries(markdown: string, asOf: Date, days = 7): { heading: string; body: string }[] {
  const cutoff = new Date(asOf.getTime() - days * 864e5)
  const parts = markdown.split(/^## /m).slice(1)
  const out: { heading: string; body: string }[] = []

  for (const part of parts) {
    const newline = part.indexOf('\n')
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim()
    const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(heading)
    if (!dateMatch) continue
    // Midday avoids a timezone shift pushing an entry over the boundary.
    const entryDate = new Date(`${dateMatch[1]}T12:00:00Z`)
    if (entryDate < cutoff) break
    out.push({ heading, body: newline === -1 ? '' : part.slice(newline + 1).trim() })
  }
  return out
}

const SYSTEM = `You write the weekly one-page update for the leadership team of Innovative Air Technologies, an industrial dehumidification manufacturer. Your input is the engineering changelog for the past week.

Your reader is a director. They are not technical. They will give this 45 seconds.

THE HARD RULE
Each line is ONE sentence of AT MOST 18 WORDS. Count them. A line with two full stops is wrong. A line that needs a semicolon is too long — cut it down or drop the detail.

WHAT TO WRITE
- The business outcome only. What can someone now do, or what stopped being broken.
- Never how it was built. No file names, no error codes, no percentages of anything technical, no product model numbers, no words like: endpoint, cron, idempotency, server, API, environment variable, reCAPTCHA, migration, bisection, canonical, permissions, round-trip.
- Problems found and fixed belong here, stated plainly and without blame or drama.
- When something was broken, say what it COST — how long it ran, or what was missed. "Six customer tickets went unseen for ten days" earns its words; "alerts now deliver reliably" hides the story leadership needs.
- Invent NOTHING. Every line must trace to the input. A quiet week gets fewer lines, not padding.
- Never name a customer, a customer's company, or a competitor. Say "a customer".
- Plain business English. No marketing language, no exclamation marks, no emoji.

EXAMPLES

Input mentions a missing CRON_SECRET meaning cron routes 401'd and digest_runs was empty.
BAD:  "Scheduled jobs have never run since launch. The authentication secret was missing, so every cron route returned 401. Fixed and verified."
GOOD: "Scheduled jobs had never run; the daily digest and weekly leave accrual now work."

Input describes a guided RFQ wizard with 18 presets producing a 5-page PDF.
BAD:  "Quote requests can be submitted through a guided moisture survey form. Replaces emailed Word attachments. Eighteen room applications and eleven process types seed typical values."
GOOD: "Customers can now complete a full moisture survey online in about three minutes."

Input describes append-only notes with author snapshots and assignee permission checks.
BAD:  "Quote requests gain an owner and permanent note trail. Each request assigns to someone holding deals permissions. Notes are append-only with timestamps and attribution."
GOOD: "Every quote request now has an owner and a permanent, attributed note trail."

SHAPE
At most 4 sections, titles in capitals (NEW, FIXED, IMPROVED are usually right).
AT MOST 14 lines in total across all sections. Merge related items rather than listing each one.

Return ONLY valid JSON, no prose around it:
{"sections":[{"title":"NEW","items":["...","..."]}]}`

/** Lines that break the brief, so a bad generation can be caught and retried. */
function offenders(sections: UpdateSection[]): string[] {
  const BANNED = /\b(endpoint|cron|idempotenc|API|environment variable|reCAPTCHA|migration|bisection|canonical|round-trip|401|server[- ]side|permissions)\b/i
  return sections.flatMap(s => s.items).filter(
    line => line.split(/\s+/).length > 20 || (line.match(/\./g) ?? []).length > 1 || BANNED.test(line),
  )
}

/** Build the update. Throws rather than emitting a half-empty report. */
export async function buildLeadershipUpdate(asOf = new Date()): Promise<LeadershipUpdate> {
  const markdown = await readFile(CHANGELOG, 'utf8')
  const entries = recentEntries(markdown, asOf)

  const weekEnding = asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!entries.length) {
    return { weekEnding, sections: [], sourceEntries: [] }
  }

  const source = entries.map(e => `## ${e.heading}\n${e.body}`).join('\n\n')

  // One retry with the offending lines quoted back. The first pass reliably
  // over-writes — it wants to explain the engineering — and naming the specific
  // lines that broke the brief fixes it far more often than restating the rules.
  let sections: UpdateSection[] = []
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: source.slice(0, 60000) },
  ]

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages,
    })
    const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('')

    // Told to return bare JSON, but a stray code fence is the one failure worth
    // tolerating rather than throwing the week's report away.
    const json = /\{[\s\S]*\}/.exec(text)
    if (!json) throw new Error('leadership update: model returned no JSON')

    const parsed = JSON.parse(json[0]) as { sections?: UpdateSection[] }
    sections = (parsed.sections ?? []).filter(
      s => s && typeof s.title === 'string' && Array.isArray(s.items) && s.items.length,
    )
    if (!sections.length) throw new Error('leadership update: model returned no sections')

    const bad = offenders(sections)
    if (!bad.length) break
    if (attempt === 1) {
      // Second pass still over-long. Ship it rather than send nothing — a wordy
      // update beats a silent Monday — but say so in the log.
      console.warn(`[leadership] ${bad.length} line(s) still over the brief after a retry`)
      break
    }
    messages.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `These lines break the brief — each is over 18 words, contains more than one sentence, or uses banned technical vocabulary:\n\n${bad.map(b => `- ${b}`).join('\n')}\n\nRewrite the WHOLE response. Same facts, same JSON shape, but every line one short sentence a director would read aloud in a meeting. At most 14 lines total.`,
      },
    )
  }

  return { weekEnding, sections, sourceEntries: entries.map(e => e.heading) }
}
