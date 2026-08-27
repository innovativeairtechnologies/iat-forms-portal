import 'server-only'
import { anthropic } from './anthropic'
import { supabaseAdmin } from './supabase-admin'
import { CATEGORY_LABELS, isCategory, type Category } from './post-production'

/* ────────────────────────────────────────────────────────────────────────────
   lib/pp-match.ts — "have we said this before?"

   From the meeting: "use AI to determine has this issue been identified before.
   And if all of a sudden it's like guys, we've brought these up twelve times
   before… same comments, same issues."

   ── The division of labour, which is the whole design ──────────────────────
   Postgres RETRIEVES. Claude JUDGES. A person CONFIRMS. Numbers are SQL.

     1. match_pp_findings() (migration 098) shortlists prior findings by
        IDF-weighted keyword overlap. Cheap, deterministic, and it never invents
        a candidate that is not in the table.
     2. Claude reads that shortlist and says whether any of them is the same
        underlying issue — the part that genuinely needs judgement, because "big
        gap between the filter and the wheel" and "wheel could have come further
        down" are the same finding written by two people and share almost no
        words.
     3. The answer is stored as a SUGGESTION (theme_source = 'ai') and shown as
        one until somebody agrees.
     4. Every count on the themes board is COUNT(*) over confirmed links. The
        model never contributes to a number.

   ⚠️ Do not "simplify" this by letting the model report how many times something
   has happened. It cannot count rows it was not shown, it will produce a
   confident number anyway, and "raised twelve times" is precisely the claim that
   has to survive an engineer checking it.

   ⚠️ And do not drop the retrieval step in favour of handing the model every
   finding. It works today at a few hundred rows and silently degrades into
   truncation as the table grows — the failure mode being that the twelfth
   occurrence stops matching the first eleven, which is the exact thing this
   exists to catch.
   ──────────────────────────────────────────────────────────────────────────── */

export type MatchCandidate = {
  finding_id: string
  job_number: string
  note: string
  category: string
  severity: string
  status: string
  theme_id: string | null
  theme_title: string | null
  created_at: string
  rank: number
}

export type MatchSuggestion =
  | { kind: 'existing_theme'; themeId: string; title: string; confidence: number; why: string; candidates: MatchCandidate[] }
  | { kind: 'new_theme'; title: string; summary: string; category: Category; confidence: number; why: string; candidates: MatchCandidate[] }
  | { kind: 'none'; why: string; candidates: MatchCandidate[] }

const SYSTEM = `You compare quality findings recorded during post-production walkarounds of industrial desiccant dehumidifiers built by IAT.

A walkaround happens after a unit passes test and before it ships. An engineer walks around the built unit and records what they would have done differently — component spacing, airflow path, parts that had to be modified to fit, wiring, finish, missing documentation.

Your ONE job: decide whether a new finding describes the SAME UNDERLYING ISSUE as any earlier finding you are shown.

What "same underlying issue" means:
- The same root cause, on a different unit, that the same design or process change would prevent.
- Wording will differ completely. "Big gap between the filter bank and the wheel" and "the wheel could have come a lot further down, air comes in and has to get back down again" are THE SAME ISSUE.
- The same component in two unrelated ways is NOT the same issue. "Damper linkage fouls the filter rack" and "damper actuator wired to the wrong terminal" share a word and nothing else.
- One unit's one-off mistake is not a theme. If the earlier finding reads as a build error rather than a design pattern, say so.

Be sceptical. A wrong match is worse than no match here: it inflates a recurrence count that leadership acts on, and the person who finds the bad match stops believing the good ones. When you are not sure, answer "none".

Reply with ONLY a JSON object, no prose and no code fence:
{
  "match": "existing" | "new" | "none",
  "themeId": "<uuid of the existing theme, only when match is existing>",
  "title": "<short imperative issue name, max 70 chars, only when match is new>",
  "summary": "<one or two sentences describing the recurring problem, only when match is new>",
  "category": "<one of the category keys you were given, only when match is new>",
  "confidence": <integer 0-100>,
  "why": "<one sentence, max 200 chars, naming what makes these the same or different>"
}

Rules:
- "existing" requires the themeId to be one you were actually shown. Never invent one.
- "new" is only for when two or more of the findings shown are the same issue as each other AND as the new one, and none of them already carries a theme.
- Never state how many times something has happened. You are not shown the whole table and any number you produce would be wrong.`

/** Keyword shortlist. Retrieval only — no judgement, no model. */
export async function findCandidates(note: string, excludeId?: string, limit = 8): Promise<MatchCandidate[]> {
  const text = (note || '').trim()
  // Two words is not a query. Running one produces a shortlist built from
  // stopword-adjacent terms, which is how unrelated findings end up in front of
  // the model in the first place.
  if (text.split(/\s+/).filter(Boolean).length < 3) return []

  const { data, error } = await supabaseAdmin.rpc('match_pp_findings', {
    query_text: text,
    exclude_id: excludeId ?? null,
    match_limit: limit,
  })
  if (error) { console.error('[pp-match] retrieval failed:', error.message); return [] }

  const rows = (data ?? []) as Omit<MatchCandidate, 'theme_title'>[]
  const themeIds = [...new Set(rows.map(r => r.theme_id).filter(Boolean))] as string[]
  const titles = new Map<string, string>()
  if (themeIds.length) {
    const { data: themes } = await supabaseAdmin.from('pp_themes').select('id, title').in('id', themeIds)
    for (const t of (themes ?? []) as { id: string; title: string }[]) titles.set(t.id, t.title)
  }
  return rows.map(r => ({ ...r, theme_title: r.theme_id ? titles.get(r.theme_id) ?? null : null }))
}

/**
 * Ask whether this finding is a repeat.
 *
 * NEVER THROWS and never blocks a save. Recurrence detection is a bonus on top
 * of a finding that is already recorded and already assigned; if the model is
 * slow, down, or answers with something unparseable, the finding is simply
 * un-themed and a person can link it by hand from the detail page. Failing the
 * submission because a nice-to-have failed would mean somebody standing next to
 * a unit loses what they just dictated.
 */
export async function suggestTheme(
  note: string,
  category: Category,
  excludeId?: string,
): Promise<MatchSuggestion> {
  const candidates = await findCandidates(note, excludeId)
  if (!candidates.length) {
    return { kind: 'none', why: 'Nothing similar has been recorded before.', candidates: [] }
  }

  const list = candidates.map((c, i) => [
    `[${i + 1}] job ${c.job_number} · ${c.created_at.slice(0, 10)} · ${CATEGORY_LABELS[c.category as Category] ?? c.category}`,
    c.theme_id ? `    already grouped under theme ${c.theme_id} — "${c.theme_title ?? 'untitled'}"` : '    not grouped yet',
    `    ${c.note.slice(0, 600).replace(/\s+/g, ' ')}`,
  ].join('\n')).join('\n\n')

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content:
          `CATEGORY KEYS: ${Object.keys(CATEGORY_LABELS).join(', ')}\n\n` +
          `NEW FINDING (category ${CATEGORY_LABELS[category]}):\n${note.slice(0, 3000)}\n\n` +
          `EARLIER FINDINGS, most similar first:\n\n${list}`,
      }],
    }, { timeout: 30_000, maxRetries: 1 })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(
      raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim(),
    ) as Record<string, unknown>

    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0))
    const why = String(parsed.why ?? '').slice(0, 200)

    if (parsed.match === 'existing') {
      const themeId = String(parsed.themeId ?? '')
      // The model may only pick from what it was shown. An id it produced from
      // nowhere would create a link to a theme that does not exist, or worse, to
      // one that does and is unrelated.
      const known = candidates.find(c => c.theme_id === themeId)
      if (known?.theme_id) {
        return { kind: 'existing_theme', themeId: known.theme_id, title: known.theme_title ?? 'Untitled', confidence, why, candidates }
      }
      return { kind: 'none', why: 'The suggested group could not be verified.', candidates }
    }

    if (parsed.match === 'new') {
      const title = String(parsed.title ?? '').trim().slice(0, 70)
      if (!title) return { kind: 'none', why, candidates }
      const cat = isCategory(parsed.category) ? parsed.category : category
      return {
        kind: 'new_theme',
        title,
        summary: String(parsed.summary ?? '').trim().slice(0, 500),
        category: cat,
        confidence,
        why,
        candidates,
      }
    }

    return { kind: 'none', why: why || 'Nothing earlier is the same issue.', candidates }
  } catch (err) {
    console.warn('[pp-match] suggestion failed; leaving the finding un-grouped:', err)
    return { kind: 'none', why: 'Similar findings were found but could not be compared automatically.', candidates }
  }
}

/**
 * Apply a suggestion. Creates the theme when the suggestion is a new one, and
 * always stamps `theme_source = 'ai'` — a link the model made is a suggestion
 * until a person opens it and agrees, however confident the model was.
 *
 * ⚠️ A new finding landing on a RESOLVED theme reopens it. Somebody marked that
 * theme fixed and it has just happened again; leaving it green because of a
 * decision made before the recurrence is how a board stops describing reality.
 */
export async function applySuggestion(
  findingId: string,
  s: MatchSuggestion,
  createdBy: string | null,
): Promise<{ themeId: string | null; created: boolean }> {
  if (s.kind === 'none') return { themeId: null, created: false }

  let themeId: string
  let created = false

  if (s.kind === 'new_theme') {
    const { data, error } = await supabaseAdmin
      .from('pp_themes')
      .insert({ title: s.title, summary: s.summary, category: s.category, created_by: createdBy })
      .select('id')
      .single()
    if (error || !data) {
      console.error('[pp-match] could not create theme:', error?.message)
      return { themeId: null, created: false }
    }
    themeId = data.id as string
    created = true
  } else {
    themeId = s.themeId
    const { data: theme } = await supabaseAdmin
      .from('pp_themes').select('status').eq('id', themeId).maybeSingle()
    if (theme?.status === 'resolved') {
      await supabaseAdmin
        .from('pp_themes')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', themeId)
    }
  }

  await supabaseAdmin
    .from('pp_findings')
    .update({
      theme_id: themeId,
      theme_source: 'ai',
      theme_note: s.why || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', findingId)

  return { themeId, created }
}
