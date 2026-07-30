import type { ReactNode } from 'react'

/* Scroll container + page padding for the Learn surface inside the admin shell.
   /admin pages own their own scroller (app/admin/layout.tsx only supplies the
   sidebar + top bar), and Learn's pages were written against LearnShell's
   `px-6 py-8` wrapper — this replaces it.

   PageChrome renders INSIDE this, as its first child: its mobile bar is
   `sticky top-0`, which is inert without a scrolling ancestor. */

export default function LearnPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-8">{children}</div>
    </div>
  )
}
