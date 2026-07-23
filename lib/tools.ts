import type { LucideIcon } from 'lucide-react'
import { Wind, Image as ImageIcon, Zap, Calculator, Flame, PartyPopper } from 'lucide-react'

/* Single source of truth for the internal-apps launcher ("Internal Apps" in the
   nav — renamed from "Tools" so it isn't confused with the Tool Crib check-out
   registry), shared by the employee list (/employee/resources/tools) and the
   admin list (/admin/tools). Each app is a self-contained HTML page in
   public/tools/<slug>.html, gated to signed-in staff by middleware (/tools/*),
   and opens in a new tab. */

export type ToolApp = {
  title: string
  desc: string
  href: string
  icon: LucideIcon
  external?: boolean
  tag?: string
}

export const TOOL_APPS: ToolApp[] = [
  {
    title: 'Gas Burner Selection Guide',
    desc: 'Size the AH-MA gas burner length, plenum height, profile-plate gap, and gas pressure-tap differential from the desiccant wheel and reactivation duty on your flow diagram — packaged as a submittal-ready PDF.',
    href: '/tools/burner-selection-guide.html',
    icon: Flame,
    external: true,
    tag: 'New',
  },
  {
    title: 'Duct Traverse Report',
    desc: 'Run a Pitot traverse across a square or round duct, average the point velocities, and get airflow (CFM) — with a branded PDF you can email.',
    href: '/tools/duct-traverse-report.html',
    icon: Wind,
    external: true,
  },
  {
    title: 'Order Status Card Generator',
    desc: 'Generate branded order-status cards for customer emails.',
    href: '/tools/order-status-card.html',
    icon: ImageIcon,
    external: true,
  },
  {
    title: 'Voltage Scaling Calculator',
    desc: 'Convert and scale voltages across configurations.',
    href: '/tools/voltage-scaling-calculator.html',
    icon: Zap,
    external: true,
  },
  {
    title: 'US Rotors Pricing Calculator',
    desc: 'Price out US Rotors rotor configurations.',
    href: '/tools/us-rotors-pricing-calculator.html',
    icon: Calculator,
    external: true,
  },
  {
    title: 'SUPER IMPORTANT SOFTWARE™',
    desc: 'Mission-critical hippo choreography. Make the purple hippo dance and export a transparent GIF for slides (or an MP4 video). Business-critical. Do not question it.',
    href: '/tools/super-important-software.html',
    icon: PartyPopper,
    external: true,
    tag: 'Mission-Critical',
  },
]
