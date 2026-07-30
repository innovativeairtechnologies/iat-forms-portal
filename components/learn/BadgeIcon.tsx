import type { LucideIcon } from 'lucide-react'
import {
  Footprints, Zap, BookMarked, Award, Trophy, Flame, GraduationCap, Crown, Medal,
} from 'lucide-react'

// Badge `icon` strings (from lib/learn-gamification) → lucide components.
const ICONS: Record<string, LucideIcon> = {
  Footprints, Zap, BookMarked, Award, Trophy, Flame, GraduationCap, Crown,
}

export function BadgeIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Medal
  return <Icon size={size} className={className} />
}

/* Tier → treatment for an EARNED badge. Locked badges render neutral (see
   /admin/learn/me). Every value is a DESIGN §2.4 Tone recipe — the only place
   non-brand chroma is allowed, and the tier IS the meaning here.

   Ladder: bronze → slate, silver → sky, gold → amber, special → emerald
   (the top "IAT Scholar" award, so success/brand-adjacent). `yellow` is not a
   Tone and is gone. Ranks 1/2/3 on the leaderboard use the matching
   amber / slate / violet podium chips.

   Note this is a plain const in a server-safe module, so /admin/learn/me (a
   Server Component) can import it directly. */
export const TIER_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  bronze: { bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-hairline', label: 'Bronze' },
  silver: { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-400', ring: 'ring-hairline', label: 'Silver' },
  gold: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-hairline', label: 'Gold' },
  special: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-hairline', label: 'Special' },
}
