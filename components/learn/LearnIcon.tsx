import {
  Rocket, Building2, ShieldCheck, Wrench, Package, BookOpen,
  GraduationCap, Truck, Zap, FlaskConical, Wind, Users, type LucideIcon,
} from 'lucide-react'

// Maps the `icon` string stored on learn_categories to a lucide component.
const ICONS: Record<string, LucideIcon> = {
  Rocket, Building2, ShieldCheck, Wrench, Package, BookOpen,
  GraduationCap, Truck, Zap, FlaskConical, Wind, Users,
}

export function LearnIcon({
  name, size = 22, className,
}: { name: string | null; size?: number; className?: string }) {
  const Icon = (name && ICONS[name]) || BookOpen
  return <Icon size={size} className={className} />
}
