import { hasInteractive, splitLessonHtml } from '@/lib/learn-interactive'
import InteractiveBlockView from './InteractiveBlockView'

// Renders imported/admin-authored lesson HTML in the Learn prose style.
// Content originates from our own Trainual import and the admin TipTap editor
// (trusted, internal), styled via the `.learn-prose` rules in globals.css.
//
// A lesson may also carry interactive markers (see lib/learn-interactive.ts),
// in which case the body is split into HTML runs with real components between
// them. A body WITHOUT a marker takes the original single-injection path
// untouched — that guard is what keeps the 357 existing lessons on exactly the
// markup they render today.
//
// `lessonId` lets a graded exercise mark this lesson complete when it is
// passed. Optional because previews and the quiz-generator's text extraction
// render bodies with no lesson in scope.
export default function LessonContent({
  html,
  lessonId,
}: {
  html: string | null
  lessonId?: string
}) {
  if (!html || !html.trim()) {
    return (
      <p className="rounded-xl border border-dashed border-hairline bg-surface px-5 py-10 text-center text-[13.5px] text-ink-muted">
        This lesson doesn’t have content yet.
      </p>
    )
  }

  if (!hasInteractive(html)) {
    return <div className="learn-prose" dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div className="learn-prose learn-prose-split">
      {splitLessonHtml(html).map((segment, i) =>
        segment.kind === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : (
          <InteractiveBlockView key={i} name={segment.name} params={segment.params} lessonId={lessonId} />
        ),
      )}
    </div>
  )
}
