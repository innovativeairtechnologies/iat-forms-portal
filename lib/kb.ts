import { supabaseAdmin } from './supabase-admin'
import type { KbArticle, Ticket } from './supabase'

// Words too common to be useful for matching a ticket to an article.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'have', 'has', 'had', 'not',
  'are', 'was', 'were', 'but', 'our', 'your', 'their', 'when', 'what', 'which',
  'from', 'into', 'unit', 'units', 'system', 'systems', 'issue', 'issues',
  'problem', 'problems', 'please', 'help', 'about', 'they', 'them', 'been',
  'will', 'would', 'should', 'could', 'there', 'here', 'just', 'also', 'very',
])

type TicketLike = Partial<Pick<Ticket,
  | 'problem_description'
  | 'pre_cooling' | 'pre_cooling_type' | 'pre_cooling_working'
  | 'post_cooling' | 'post_cooling_type' | 'post_cooling_working'
  | 'airflow_balanced' | 'react_heat_working' | 'react_heat_setpoint'
  | 'seals_good'
>>

/**
 * Derive a set of lowercase keywords describing a ticket, drawn from both its
 * structured system-check fields and free-text problem description. These are
 * matched against each article's tags/category/title in `scoreArticle`.
 */
export function ticketKeywords(t: TicketLike): string[] {
  const kw = new Set<string>()
  const add = (...words: string[]) => words.forEach(w => kw.add(w.toLowerCase()))

  if (t.airflow_balanced === false) add('airflow', 'balancing', 'balance', 'cfm', 'damper')

  if (t.pre_cooling || t.post_cooling) add('cooling')
  if (t.pre_cooling_working === false || t.post_cooling_working === false) {
    add('cooling', 'diagnostics')
  }
  const coolingTypes = `${t.pre_cooling_type ?? ''} ${t.post_cooling_type ?? ''}`.toLowerCase()
  if (coolingTypes.includes('dx')) add('dx', 'refrigerant', 'compressor')
  if (coolingTypes.includes('chill') || coolingTypes.includes('water')) add('chilled', 'water')

  if (t.react_heat_working === false) add('react', 'heat', 'heater', 'temperature')
  if (t.react_heat_setpoint === false) add('temperature', 'setpoint', 'calibration', 'pid')

  if (t.seals_good === false) add('seals', 'gasket', 'leak')

  for (const tok of (t.problem_description ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length > 3 && !STOPWORDS.has(tok)) kw.add(tok)
  }

  return Array.from(kw)
}

/** Score one article against a ticket's keywords. Tags weigh most, then category, then title words. */
export function scoreArticle(article: KbArticle, keywords: string[]): number {
  const kset = new Set(keywords)
  let score = 0

  for (const tag of article.tags ?? []) {
    if (kset.has(tag.toLowerCase())) score += 3
  }
  if (article.category && kset.has(article.category.toLowerCase())) score += 2
  for (const w of (article.title ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length > 3 && kset.has(w)) score += 1
  }

  return score
}

/** Rank articles by relevance to the keywords; drop zero-score articles. */
export function rankArticles(articles: KbArticle[], keywords: string[], limit = 3): KbArticle[] {
  return articles
    .map(a => ({ a, score: scoreArticle(a, keywords) }))
    .filter(x => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.sort_order - y.a.sort_order)
    .slice(0, limit)
    .map(x => x.a)
}

/**
 * Fetch published KB articles and return the ones most relevant to a ticket.
 * Returns [] if the kb_articles table is empty or unavailable — so the status
 * page degrades gracefully until real article content exists.
 */
export async function matchKbArticlesForTicket(t: TicketLike, limit = 3): Promise<KbArticle[]> {
  const { data, error } = await supabaseAdmin
    .from('kb_articles')
    .select('*')
    .eq('is_published', true)

  if (error || !data) return []
  return rankArticles(data as KbArticle[], ticketKeywords(t), limit)
}
