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
// Muted: low-chroma tint + neutral hairline ring so the row stays quiet; the
// colored icon/label keeps each tier distinguishable.
export const TIER_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  bronze:  { bg: 'bg-amber-50/60 dark:bg-amber-500/[0.07]',   text: 'text-amber-600 dark:text-amber-400',   ring: 'ring-black/5 dark:ring-white/10',   label: 'Bronze' },
  silver:  { bg: 'bg-slate-100/70 dark:bg-slate-500/[0.07]',  text: 'text-slate-500 dark:text-slate-300',   ring: 'ring-black/5 dark:ring-white/10',   label: 'Silver' },
  gold:    { bg: 'bg-yellow-50/70 dark:bg-yellow-500/[0.07]', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-black/5 dark:ring-white/10',   label: 'Gold' },
  special: { bg: 'bg-emerald-50/70 dark:bg-emerald-500/[0.07]', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-black/5 dark:ring-white/10', label: 'Special' },
}
