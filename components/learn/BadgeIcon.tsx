import {
  Footprints, Zap, BookMarked, Award, Trophy, Flame, GraduationCap, Crown, Medal,
} from 'lucide-react'

// Badge `icon` strings (from lib/learn-gamification) → lucide components.
const ICONS: Record<string, React.ElementType> = {
  Footprints, Zap, BookMarked, Award, Trophy, Flame, GraduationCap, Crown,
}

export function BadgeIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Medal
  return <Icon size={size} className={className} />
}

// Tier → color treatment for an EARNED badge. Locked badges render gray (below).
export const TIER_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  bronze:  { bg: 'bg-amber-50 dark:bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-200/70 dark:ring-amber-500/20',   label: 'Bronze' },
  silver:  { bg: 'bg-slate-100 dark:bg-slate-500/10',  text: 'text-slate-500 dark:text-slate-300',   ring: 'ring-slate-300/70 dark:ring-slate-500/20',   label: 'Silver' },
  gold:    { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-300/70 dark:ring-yellow-500/20',  label: 'Gold' },
  special: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-300/70 dark:ring-emerald-500/20', label: 'Special' },
}
