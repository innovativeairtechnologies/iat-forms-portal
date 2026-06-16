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
  bronze:  { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-200/70',   label: 'Bronze' },
  silver:  { bg: 'bg-slate-100',  text: 'text-slate-500',   ring: 'ring-slate-300/70',   label: 'Silver' },
  gold:    { bg: 'bg-yellow-50',  text: 'text-yellow-600',  ring: 'ring-yellow-300/70',  label: 'Gold' },
  special: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-300/70', label: 'Special' },
}
