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

const SYSTEM = `You write a weekly one-page update for the leadership team of Innovative Air Technologies, an industrial dehumidification manufacturer. Your input is the engineering changelog for the past week.

Rewrite it for readers who are not engineers and will spend under sixty seconds on it.

RULES
- Every line must be ONE sentence, under 20 words, and readable on its own.
- Say what changed for the business, never how it was implemented. No file names, no environment variables, no migration numbers, no function names.
- State outcomes plainly. "Customers can now X." "We found and fixed Y."
- Include problems found and fixed — leadership should see those, stated factually and without drama or blame.
- Invent NOTHING. Every line must trace to the input. If the week was quiet, return fewer lines.
- Never name a customer, a customer's company, or any competitor. Say "a customer" or "an outside company".
- Plain British-neutral business English. No marketing language, no exclamation marks, no emoji.

Group into at most 4 sections. Use short section titles in capitals, e.g. NEW, FIXED, IMPROVED. Aim for 12-20 lines in total across all sections.

Return ONLY valid JSON, no prose around it:
{"sections":[{"title":"NEW","items":["...","..."]}]}`

/** Build the update. Throws rather than emitting a half-empty report. */
export async function buildLeadershipUpdate(asOf = new Date()): Promise<LeadershipUpdate> {
  const markdown = await readFile(CHANGELOG, 'utf8')
  const entries = recentEntries(markdown, asOf)

  const weekEnding = asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!entries.length) {
    return { weekEnding, sections: [], sourceEntries: [] }
  }

  const source = entries.map(e => `## ${e.heading}\n${e.body}`).join('\n\n')
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: source.slice(0, 60000) }],
  })

  const text = res.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')

  // The model is told to return bare JSON, but a stray code fence is the one
  // failure worth tolerating rather than throwing the week's report away.
  const json = /\{[\s\S]*\}/.exec(text)
  if (!json) throw new Error('leadership update: model returned no JSON')

  const parsed = JSON.parse(json[0]) as { sections?: UpdateSection[] }
  const sections = (parsed.sections ?? []).filter(
    s => s && typeof s.title === 'string' && Array.isArray(s.items) && s.items.length,
  )
  if (!sections.length) throw new Error('leadership update: model returned no sections')

  return { weekEnding, sections, sourceEntries: entries.map(e => e.heading) }
}
