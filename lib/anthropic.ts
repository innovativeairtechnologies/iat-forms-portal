import Anthropic from '@anthropic-ai/sdk'

// Single shared Anthropic client for all server-side AI features. Import this
// (`import { anthropic } from '@/lib/anthropic'`) instead of constructing a
// client per route/lib — every call site was building the identical instance.
// Model, max_tokens, and system stay per-call; only the client is shared.
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
