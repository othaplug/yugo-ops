import type { IconName } from "../primitives/Icon"

export type NavItem = {
  id: string
  label: string
  href: string
  icon: IconName
  badgeKey?: string
}

export type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}

export const ADMIN_V2_BASE = "/admin-v2"

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "today",
    items: [
      { id: "dashboard", label: "Dashboard", href: `${ADMIN_V2_BASE}/dashboard`, icon: "home" },
      { id: "inbox", label: "Inbox", href: `${ADMIN_V2_BASE}/inbox`, icon: "inbox", badgeKey: "inbox.unread" },
      { id: "mywork", label: "My work", href: `${ADMIN_V2_BASE}/my-work`, icon: "mywork", badgeKey: "mywork.count" },
      { id: "calendar", label: "Calendar", href: `${ADMIN_V2_BASE}/calendar`, icon: "calendar" },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "leads", label: "Leads", href: `${ADMIN_V2_BASE}/leads`, icon: "leads" },
      { id: "quotes", label: "Quotes", href: `${ADMIN_V2_BASE}/quotes`, icon: "quotes" },
      { id: "moves", label: "Moves", href: `${ADMIN_V2_BASE}/moves`, icon: "moves" },
      { id: "customers", label: "Customers", href: `${ADMIN_V2_BASE}/customers`, icon: "customers" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { id: "dispatch", label: "Dispatch", href: `${ADMIN_V2_BASE}/dispatch`, icon: "dispatch" },
      { id: "invoices", label: "Invoices", href: `${ADMIN_V2_BASE}/invoices`, icon: "invoices" },
      { id: "crew", label: "Crew", href: `${ADMIN_V2_BASE}/crew`, icon: "crew" },
      { id: "buildings", label: "Buildings", href: `${ADMIN_V2_BASE}/buildings`, icon: "buildings" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    items: [
      { id: "b2b", label: "B2B partners", href: `${ADMIN_V2_BASE}/b2b`, icon: "b2b" },
      { id: "pm", label: "Property management", href: `${ADMIN_V2_BASE}/pm`, icon: "pm" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "analytics", label: "Analytics", href: `${ADMIN_V2_BASE}/analytics`, icon: "analytics" },
      { id: "pricing", label: "Pricing", href: `${ADMIN_V2_BASE}/pricing`, icon: "pricing" },
    ],
  },
]

export const FOOTER_NAV: NavItem[] = [
  { id: "help", label: "Help", href: `${ADMIN_V2_BASE}/help`, icon: "help" },
  { id: "settings", label: "Settings", href: `${ADMIN_V2_BASE}/settings`, icon: "settings" },
]

export const isActiveHref = (href: string, pathname: string) => {
  if (href === pathname) return true
  return pathname.startsWith(href + "/")
}
