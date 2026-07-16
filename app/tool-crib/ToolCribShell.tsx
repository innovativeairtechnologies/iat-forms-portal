import Link from 'next/link'
import { ChevronLeft, Wrench } from 'lucide-react'

/* Minimal phone-first chrome. This surface is used one-handed, standing at a
   shelf, often with a glove on — so it carries a fixed bar and nothing else.
   No sidebar, no tabs, no nav. */
export default function ToolCribShell({
  name, backHref, children,
}: {
  name: string | null
  backHref: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center gap-3 px-4 bg-surface border-b border-hairline">
        <Link href={backHref} className="text-ink-faint hover:text-ink-secondary transition-colors -ml-1 p-1">
          <ChevronLeft size={20} />
        </Link>
        <Link href="/tool-crib" className="flex items-center gap-2 min-w-0">
          <Wrench size={15} className="text-brand flex-shrink-0" />
          <span className="text-[14px] text-ink truncate" style={{ fontWeight: 620 }}>Tool Crib</span>
        </Link>
        <span className="ml-auto text-[12px] text-ink-faint truncate max-w-[40%]">{name}</span>
      </header>

      {/* pt-14 clears the fixed bar. A spacer div would work here (this is a
          flex COLUMN), but padding on the content column is the portal-wide
          pattern — see docs/mobile.md. */}
      <main className="flex-1 min-h-0 pt-14">{children}</main>
    </div>
  )
}
