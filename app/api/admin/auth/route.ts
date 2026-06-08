// Login is now handled client-side via supabase.auth.signInWithPassword().
// This file is kept only as a legacy fallback; no active callers remain.
import { NextResponse } from 'next/server'

export async function DELETE() {
  return NextResponse.json({ ok: true })
}
