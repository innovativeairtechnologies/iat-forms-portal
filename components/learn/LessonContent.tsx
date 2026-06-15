// Renders imported/admin-authored lesson HTML in the Learn prose style.
// Content originates from our own Trainual import and the admin TipTap editor
// (trusted, internal), styled via the `.learn-prose` rules in globals.css.
export default function LessonContent({ html }: { html: string | null }) {
  if (!html || !html.trim()) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-[13.5px] text-gray-400">
        This lesson doesn’t have content yet.
      </p>
    )
  }
  return <div className="learn-prose" dangerouslySetInnerHTML={{ __html: html }} />
}
