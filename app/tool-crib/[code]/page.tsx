import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeTagCode } from '@/lib/tool-crib'
import type { CribTool } from '@/lib/supabase'
import ScanActionClient from './ScanActionClient'
import LostFoundNote from './LostFoundNote'

export const dynamic = 'force-dynamic'

/* PATH A — where a physical label lands.
 *
 * The employee points their phone's built-in Camera app at the QR, taps the
 * notification, and arrives here already signed in via the session cookie. No
 * scanner library is involved anywhere in this path, which is exactly why it's
 * the reliable floor: if the in-app scanner ever breaks, or iOS changes the
 * camera rules again, this still works. */
export default async function ToolByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = normalizeTagCode(raw)

  if (!code) return <NotFound raw={raw} />

  const { data } = await supabaseAdmin
    .from('crib_tools')
    .select('*, holder:employees!crib_tools_held_by_fkey(name)')
    .eq('tag_code', code)
    .single()

  if (!data) return <NotFound raw={raw} />

  const { holder, ...tool } = data as CribTool & { holder: { name: string } | null }

  // Who's looking. Drives whether the button says "Check in" (it's yours) or
  // reports that someone else has it.
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ScanActionClient
      tool={tool as CribTool}
      holderName={tool.held_by ? (holder?.name ?? null) : null}
      isMine={!!user && tool.held_by === user.id}
    />
  )
}

function NotFound({ raw }: { raw: string }) {
  return (
    <div className="p-6 text-center">
      <SearchX size={30} className="text-ink-faint mx-auto mb-3 mt-10" />
      <h1 className="text-[17px] text-ink" style={{ fontWeight: 620 }}>No tool with that code</h1>
      <p className="text-[13px] text-ink-muted mt-1.5">
        Nothing matches <span className="font-mono">{raw}</span>. If the label is
        damaged, type the code by hand.
      </p>
      <Link href="/tool-crib"
        className="inline-block mt-5 px-4 py-2.5 text-[13px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors">
        Enter a code
      </Link>
      <div className="max-w-md mx-auto"><LostFoundNote /></div>
    </div>
  )
}
