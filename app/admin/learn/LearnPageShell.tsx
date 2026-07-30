import type { ReactNode } from 'react'

/* Scroll container + page padding for the Learn surface inside the admin shell.
   /admin pages own their own scroller (app/admin/layout.tsx only supplies the
   sidebar + top bar), and Learn's pages were written against LearnShell's
   `px-6 py-8` wrapper — this replaces it.

   `chrome` is where a record page puts its <PageChrome>: inside the scroller, so
   PageChrome's `sticky top-0` mobile bar has a scrolling ancestor to stick to
   (matching how every /admin detail page nests it in DetailShell), but outside
   the padding so that bar stays full-bleed. */

export default function LearnPageShell({ chrome, children }: { chrome?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {chrome}
      <div className="px-6 py-8">{children}</div>
    </div>
  )
}
