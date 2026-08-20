import { getHomeData } from '@/lib/home-data'
import { FUN_FACTS, coreValueOfWeek } from '@/lib/home-content'
import { getLearnHeaderStats, type LearnHeaderStats } from '@/lib/learn'
import { HomeContent } from './HomeContent'
import { prettyName, firstNameOf } from '@/lib/display-name'

/* Shared body for both shell homes (/admin/home and /employee/home). Computes the
   greeting/date/fun-fact and loads the live home data, then renders HomeContent
   into whichever portal shell wraps the calling page. `name` comes from the
   shell's already-resolved user, so this does no auth of its own. */

export async function HomePage({
  name, profileHref, userId, unreadCount = 0, ticketCount = 0,
}: {
  name: string
  /** Where the top-bar profile avatar links (per shell). */
  profileHref: string
  /** Signed-in user, for the personal "Your training" card. Omit to hide it. */
  userId?: string
  /** Notification-bell counts (admin surface; 0 elsewhere for now). */
  unreadCount?: number
  ticketCount?: number
}) {
  // Joined into the existing fetch rather than awaited after it, so the training
  // card costs no extra round trip on a page everyone loads daily.
  const [data, learn] = await Promise.all([
    getHomeData(),
    userId ? getLearnHeaderStats(userId) : Promise.resolve(null as LearnHeaderStats | null),
  ])

  const now = new Date()
  const hourET = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10)
  const dateET = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
  const greeting = hourET < 12 ? 'Good morning' : hourET < 17 ? 'Good afternoon' : 'Good evening'
  const doy = Math.floor(
    (Date.parse(now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })) - Date.parse(`1/1/${now.getFullYear()}`)) / 864e5,
  )
  const funIdx = ((doy % FUN_FACTS.length) + FUN_FACTS.length) % FUN_FACTS.length
  // Normalized here as well as at each caller: this is the one component both
  // shells render, so a future caller can't reintroduce a dotted local-part.
  const fullName = prettyName(name)
  const firstName = firstNameOf(name)
  const cv = coreValueOfWeek(now)

  return (
    <HomeContent
      greeting={greeting} dateET={dateET} firstName={firstName} funIdx={funIdx}
      data={data} name={fullName} profileHref={profileHref} learn={learn}
      unreadCount={unreadCount} ticketCount={ticketCount}
      coreValue={cv.value} coreValueIndex={cv.index} coreValueTotal={cv.total}
    />
  )
}
