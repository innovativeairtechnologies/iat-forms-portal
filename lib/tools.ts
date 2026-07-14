import type { LucideIcon } from 'lucide-react'
import { Wind, Image as ImageIcon, Zap, Calculator } from 'lucide-react'

/* Single source of truth for the internal Tools & Apps launcher, shared by the
   employee list (/employee/resources/tools) and the admin list (/admin/tools).
   Each tool is a self-contained HTML app in public/tools/<slug>.html, gated to
   signed-in staff by middleware (/tools/*), and opens in a new tab. */

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
    title: 'Duct Traverse Report',
    desc: 'Run a Pitot traverse across a square or round duct, average the point velocities, and get airflow (CFM) — with a branded PDF you can email.',
    href: '/tools/duct-traverse-report.html',
    icon: Wind,
    external: true,
    tag: 'New',
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
]
