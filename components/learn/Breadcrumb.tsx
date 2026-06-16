import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type Crumb = { label: string; href?: string }

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 text-[12.5px] text-gray-400 dark:text-zinc-500">
      <Link href="/learn" className="font-medium transition-colors hover:text-[#089447] dark:hover:text-emerald-400">
        Learn
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={13} className="text-gray-300 dark:text-zinc-500" />
          {item.href ? (
            <Link href={item.href} className="font-medium transition-colors hover:text-[#089447] dark:hover:text-emerald-400">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-gray-600 dark:text-zinc-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
