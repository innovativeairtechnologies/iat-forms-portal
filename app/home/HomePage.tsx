import { getHomeData } from '@/lib/home-data'
import { FUN_FACTS, coreValueOfWeek } from '@/lib/home-content'
import { HomeContent } from './HomeContent'

/* Shared body for both shell homes (/admin/home and /employee/home). Computes the
   greeting/date/fun-fact and loads the live home data, then renders HomeContent
   into whichever portal shell wraps the calling page. `name` comes from the
   shell's already-resolved user, so this does no auth of its own. */

export async function HomePage({
  name, profileHref, unreadCount = 0, ticketCount = 0,
}: {
  name: string
  /** Where the top-bar profile avatar links (per shell). */
  profileHref: string
  /** Notification-bell counts (admin surface; 0 elsewhere for now). */
  unreadCount?: number
  ticketCount?: number
}) {
  const data = await getHomeData()

  const now = new Date()
  const hourET = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10)
  const dateET = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
  const greeting = hourET < 12 ? 'Good morning' : hourET < 17 ? 'Good afternoon' : 'Good evening'
  const doy = Math.floor(
    (Date.parse(now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })) - Date.parse(`1/1/${now.getFullYear()}`)) / 864e5,
  )
  const funIdx = ((doy % FUN_FACTS.length) + FUN_FACTS.length) % FUN_FACTS.length
  const firstName = (name || '').trim().split(' ')[0] || ''
  const cv = coreValueOfWeek(now)

  return (
    <HomeContent
      greeting={greeting} dateET={dateET} firstName={firstName} funIdx={funIdx}
      data={data} name={name} profileHref={profileHref}
      unreadCount={unreadCount} ticketCount={ticketCount}
      coreValue={cv.value} coreValueIndex={cv.index} coreValueTotal={cv.total}
    />
  )
}
