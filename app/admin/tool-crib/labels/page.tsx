import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { canPrintLabels, LABEL_ORIGIN } from '@/lib/tool-crib'
import type { CribTool } from '@/lib/supabase'
import LabelSheet from './LabelSheet'

export const dynamic = 'force-dynamic'

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams

  let q = supabaseAdmin
    .from('crib_tools')
    .select('id, tag_code, name, category, home_location')
    .neq('status', 'retired')
    .order('tag_code')

  if (ids) q = q.in('id', ids.split(',').filter(Boolean))

  const { data } = await q
  const tools = (data ?? []) as Pick<CribTool, 'id' | 'tag_code' | 'name' | 'category' | 'home_location'>[]

  /* Hard gate. A label is glued to a drill and can never be reprinted — if the
     origin baked into the QR is wrong (or is a dev localhost), we've produced a
     sheet of permanent stickers pointing at nothing, and we'd only find out when
     someone scans one on the floor. Refuse rather than print something wrong. */
  if (!canPrintLabels()) {
    return (
      <div className="flex-1 overflow-auto bg-canvas p-8">
        <div className="max-w-lg mx-auto mt-10 bg-surface border border-hairline rounded-xl p-6">
          <AlertTriangle size={22} className="text-amber-500 mb-3" />
          <h1 className="text-[16px] text-ink" style={{ fontWeight: 620 }}>
            Label printing is locked
          </h1>
          <p className="text-[13px] text-ink-muted mt-2 leading-relaxed">
            <code className="text-ink-secondary">NEXT_PUBLIC_LABEL_ORIGIN</code> isn’t set to an
            https origin{LABEL_ORIGIN ? <> (it’s currently <code className="text-ink-secondary">{LABEL_ORIGIN}</code>)</> : null}.
            Every printed QR bakes that origin in permanently, so this stays locked
            until it’s pointed at the real production domain.
          </p>
          <p className="text-[12.5px] text-ink-faint mt-3 leading-relaxed">
            Set it in the Vercel project env for Production and redeploy. Don’t
            print from a dev box — those labels would point at localhost.
          </p>
          <Link href="/admin/tool-crib"
            className="inline-block mt-5 px-4 py-2 text-[13px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
            Back to Tool Crib
          </Link>
        </div>
      </div>
    )
  }

  return <LabelSheet tools={tools} origin={LABEL_ORIGIN} />
}
