import { redirect } from 'next/navigation'

// /admin/scheduling was renamed to /admin/schedule. Keep this stub so any old
// links/bookmarks redirect cleanly (works regardless of middleware ordering).
export default function SchedulingRedirect() {
  redirect('/admin/schedule')
}
