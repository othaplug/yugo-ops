/**
 * Yugo+ admin v3 — sidebar navigation registry.
 *
 * Central declaration of every navigable route shown in the sidebar and
 * command palette. Keep in sync with the role policy in [AdminShell.tsx].
 *
 * "use client" — registers icon components (phosphor) as data values, so
 * we must stay on the client side of the RSC boundary.
 */
"use client"

import type { Icon } from "@phosphor-icons/react"
import {
  SquaresFour,
  CalendarBlank,
  MapPin,
  FileText,
  Funnel,
  Path,
  Broadcast,
  Briefcase,
  Recycle,
  Handshake,
  ShareNetwork,
  Gift,
  HardHat,
  Shield,
  CurrencyDollar,
  Gear,
} from "../icons"

export type NavItem = {
  href: string
  label: string
  Icon: Icon
  minRole?: string
  badgeKey?: "quotes" | "changeRequests"
  /**
   * When set, sidebar uses this instead of prefix matching (see Live tracking vs
   * Crew, both under /admin/crew/*).
   */
  activePath?: (pathname: string) => boolean
}

export type NavSection = {
  /** When null, the group renders without an eyebrow (e.g. bottom Settings) */
  label: string | null
  items: NavItem[]
}

export const ROLE_LEVEL: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  dispatcher: 50,
  coordinator: 40,
  viewer: 30,
  sales: 25,
  crew: 20,
  partner: 10,
}

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    label: "Dashboard",
    items: [
      {
        href: "/admin",
        label: "Overview",
        Icon: SquaresFour,
        minRole: "coordinator",
      },
      {
        href: "/admin/calendar",
        label: "Calendar",
        Icon: CalendarBlank,
        minRole: "sales",
      },
      {
        href: "/admin/crew",
        label: "Live tracking",
        Icon: MapPin,
        activePath: (p) => p === "/admin/crew" || p === "/admin/crew/",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/admin/quotes",
        label: "Quotes",
        Icon: FileText,
        badgeKey: "quotes",
        minRole: "sales",
      },
      { href: "/admin/leads", label: "Leads", Icon: Funnel, minRole: "sales" },
    ],
  },
  {
    label: "Moves & Jobs",
    items: [
      {
        href: "/admin/dispatch",
        label: "Dispatch",
        Icon: Broadcast,
        minRole: "coordinator",
      },
      { href: "/admin/moves", label: "All moves", Icon: Path },
      {
        href: "/admin/b2b/jobs",
        label: "B2B jobs",
        Icon: Briefcase,
        minRole: "coordinator",
      },
      {
        href: "/admin/bin-rentals",
        label: "Bin rentals",
        Icon: Recycle,
        minRole: "coordinator",
      },
    ],
  },
  {
    label: "Partners",
    items: [
      {
        href: "/admin/partners",
        label: "All partners",
        Icon: Handshake,
        minRole: "coordinator",
      },
      {
        href: "/admin/partners/referral",
        label: "Referral partners",
        Icon: ShareNetwork,
        minRole: "coordinator",
      },
      {
        href: "/admin/perks",
        label: "Perks & referrals",
        Icon: Gift,
        minRole: "coordinator",
        activePath: (p) =>
          p === "/admin/perks" || p.startsWith("/admin/perks/"),
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/crew/analytics",
        label: "Crew",
        Icon: HardHat,
        minRole: "dispatcher",
        activePath: (p) => p !== "/admin/crew" && p.startsWith("/admin/crew/"),
      },
      {
        href: "/admin/claims",
        label: "Claims",
        Icon: Shield,
        minRole: "admin",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/admin/finance",
        label: "Revenue",
        Icon: CurrencyDollar,
        minRole: "admin",
        activePath: (p) =>
          p === "/admin/finance" ||
          p === "/admin/finance/" ||
          p.startsWith("/admin/finance/invoices") ||
          p.startsWith("/admin/finance/revenue") ||
          p.startsWith("/admin/finance/profitability") ||
          p.startsWith("/admin/finance/forecast") ||
          p === "/admin/finance/tips" ||
          p.startsWith("/admin/finance/tips/"),
      },
    ],
  },
  {
    label: null,
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        Icon: Gear,
        minRole: "coordinator",
      },
    ],
  },
]

export const ALL_NAV_HREFS = SIDEBAR_SECTIONS.flatMap((s) =>
  s.items.map((i) => i.href),
)

/** Same active rules as the sidebar, for mobile nav and other UIs. */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.activePath) return item.activePath(pathname)
  const { href } = item
  if (href === "/admin")
    return pathname === "/admin" || pathname === "/admin/"
  if (!pathname.startsWith(href)) return false
  const more = ALL_NAV_HREFS.filter(
    (h) => h !== href && h.startsWith(`${href}/`),
  )
  if (more.length === 0) return true
  if (pathname === href || pathname === `${href}/`) return true
  return !more.some((l) => pathname === l || pathname.startsWith(`${l}/`))
}

export type QuickAction = {
  label: string
  href: string
  description?: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New quote",
    href: "/admin/quotes/new",
    description: "Residential or B2B quote",
  },
  {
    label: "New move",
    href: "/admin/moves/create",
    description: "Schedule a move",
  },
  {
    label: "New contact",
    href: "/admin/clients/new",
    description: "Add a person or org",
  },
  {
    label: "New partner",
    href: "/admin/partners/new",
    description: "Onboard a B2B partner",
  },
  {
    label: "New delivery",
    href: "/admin/deliveries/new",
    description: "Create a B2B job",
  },
  {
    label: "New invoice",
    href: "/admin/finance/invoices/new",
    description: "Invoice a client",
  },
]
