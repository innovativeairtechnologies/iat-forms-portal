import { supabaseAdmin } from './supabase-admin'

// ─────────────────────────────────────────────────────────────────────────────
// KB RAG retrieval layer (full-text-search POC).
//
// The REUSABLE retrieval layer over the kb_documents / kb_chunks pool (migration
// 030). The customer assistant calls retrieveChunks() to ground its answers in
// IAT's documentation and cite the source (document + page). An internal assistant
// can reuse the same function later by passing includeInternal: true.
//
// Ranking + internal-doc filtering happen in Postgres (match_kb_chunks) via
// websearch_to_tsquery + ts_rank_cd. This module just shapes the call and result.
// ─────────────────────────────────────────────────────────────────────────────

// A documentation excerpt retrieved from the pool, with enough provenance to cite.
export type RetrievedChunk = {
  content: string
  documentTitle: string
  sourceFilename: string
  category: string | null
  pageNumber: number
  rank: number
}

export type RetrieveOptions = {
  limit?: number
  /** Include internal/company docs (is_internal=true). Customer-facing: leave false. */
  includeInternal?: boolean
}

/**
 * Full-text-search the KB chunk pool for the excerpts most relevant to `query`.
 *
 * Degrades gracefully: returns [] if the query is empty or the table/function
 * isn't there yet — so the assistant behaves exactly as before until the pool is
 * ingested (mirrors lib/kb.ts's empty-table handling).
 */
export async function retrieveChunks(query: string, opts: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const q = (query || '').trim()
  if (!q) return []

  const { data, error } = await supabaseAdmin.rpc('match_kb_chunks', {
    query_text: q,
    match_limit: opts.limit ?? 6,
    include_internal: opts.includeInternal ?? false,
  })
  if (error || !Array.isArray(data)) {
    // Degrade gracefully (the assistant still answers without excerpts), but
    // surface a REAL misconfiguration — a missing GRANT, a function/signature
    // drift, a transient DB error — so it doesn't masquerade forever as
    // "nothing in the docs". An absent table/function pre-ingest is expected.
    if (error) console.warn('[kb-rag] retrieveChunks failed; returning no excerpts:', error.message, (error as { code?: string }).code ?? '')
    return []
  }

  return (data as Record<string, unknown>[]).map((r) => ({
    content: String(r.content ?? ''),
    documentTitle: String(r.document_title ?? ''),
    sourceFilename: String(r.source_filename ?? ''),
    category: (r.category as string | null) ?? null,
    pageNumber: Number(r.page_number ?? 0),
    rank: Number(r.rank ?? 0),
  }))
}

// A citation the UI can render (document + page). Deduped from retrieved chunks.
export type KbSource = { documentTitle: string; pageNumber: number }

/** Stable, human-readable citation label, e.g. "ASPYRE 60-210A Manual, p.12". */
export function citationLabel(c: KbSource): string {
  return c.pageNumber >= 1 ? `${c.documentTitle}, p.${c.pageNumber}` : c.documentTitle
}

/**
 * Render retrieved chunks as a labeled excerpts block for the LLM prompt. Each
 * excerpt is tagged with its citation label so the model can cite it inline.
 */
export function formatExcerptsForPrompt(chunks: RetrievedChunk[], maxChars = 1200): string {
  if (!chunks.length) return '(no matching documentation found)'
  return chunks
    .map((c) => {
      const body = c.content.length > maxChars ? `${c.content.slice(0, maxChars)}…` : c.content
      return `[${citationLabel(c)}]\n${body.trim()}`
    })
    .join('\n\n---\n\n')
}

/** Dedupe retrieved chunks to a citation list (document + page), preserving rank order. */
export function dedupeSources(chunks: RetrievedChunk[]): KbSource[] {
  const seen = new Set<string>()
  const out: KbSource[] = []
  for (const c of chunks) {
    const key = `${c.documentTitle}|${c.pageNumber}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ documentTitle: c.documentTitle, pageNumber: c.pageNumber })
  }
  return out
}
