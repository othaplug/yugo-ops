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
  House,
  Broadcast,
  CalendarBlank,
  MapPin,
  ChartBar,
  Handshake,
  Briefcase,
  ShippingContainer,
  FileText,
  Lightning,
  Path,
  Recycle,
  Buildings,
  Money,
  CreditCard,
  Shield,
  TrendUp,
  UserCheck,
  Funnel,
  ClipboardText,
  Gift,
  Gear,
  UsersThree,
  Lock,
  Scroll,
} from "../icons"

export type NavItem = {
  href: string
  label: string
  Icon: Icon
  minRole?: string
  badgeKey?: "quotes" | "changeRequests"
}

export type NavSection = {
  label: string
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
    label: "Overview",
    items: [
      { href: "/admin", label: "Command Center", Icon: House, minRole: "coordinator" },
      { href: "/admin/dispatch", label: "Dispatch", Icon: Broadcast, minRole: "dispatcher" },
      { href: "/admin/calendar", label: "Calendar", Icon: CalendarBlank, minRole: "sales" },
      { href: "/admin/crew", label: "Live Tracking", Icon: MapPin },
      { href: "/admin/crew/analytics", label: "Crew Analytics", Icon: ChartBar, minRole: "admin" },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/admin/quotes", label: "Quotes", Icon: FileText, badgeKey: "quotes", minRole: "sales" },
      { href: "/admin/widget-leads", label: "Widget Leads", Icon: Lightning, minRole: "sales" },
      { href: "/admin/moves", label: "All Moves", Icon: Path },
      { href: "/admin/bin-rentals", label: "Bin Rentals", Icon: Recycle, minRole: "coordinator" },
      { href: "/admin/buildings", label: "Buildings", Icon: Buildings, minRole: "coordinator" },
    ],
  },
  {
    label: "B2B",
    items: [
      { href: "/admin/partners", label: "All Partners", Icon: Handshake, minRole: "coordinator" },
      { href: "/admin/partners/realtors", label: "Referral Partners", Icon: Handshake, minRole: "coordinator" },
      { href: "/admin/deliveries", label: "Jobs", Icon: Briefcase, minRole: "coordinator" },
      { href: "/admin/inbound-shipments", label: "Inbound Shipments", Icon: ShippingContainer, minRole: "coordinator" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", Icon: FileText, minRole: "admin" },
      { href: "/admin/revenue", label: "Revenue", Icon: Money, minRole: "admin" },
      { href: "/admin/tips", label: "Tips", Icon: CreditCard, minRole: "admin" },
      { href: "/admin/claims", label: "Claims", Icon: Shield, minRole: "admin" },
      { href: "/admin/finance/profitability", label: "Profitability", Icon: TrendUp, minRole: "owner" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/clients", label: "Contacts", Icon: UserCheck, minRole: "admin" },
      { href: "/admin/leads", label: "Leads", Icon: Funnel, minRole: "sales" },
      { href: "/admin/change-requests", label: "Change Requests", Icon: ClipboardText, badgeKey: "changeRequests", minRole: "admin" },
      { href: "/admin/perks", label: "Perks & Referrals", Icon: Gift, minRole: "admin" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/platform", label: "Platform", Icon: Gear, minRole: "owner" },
      { href: "/admin/users", label: "Users", Icon: UsersThree, minRole: "owner" },
      { href: "/admin/settings", label: "Settings", Icon: Lock, minRole: "coordinator" },
      { href: "/admin/audit-log", label: "Audit Log", Icon: Scroll, minRole: "admin" },
    ],
  },
]

export const ALL_NAV_HREFS = SIDEBAR_SECTIONS.flatMap((s) =>
  s.items.map((i) => i.href),
)

export type QuickAction = {
  label: string
  href: string
  description?: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New quote", href: "/admin/quotes/new", description: "Residential or B2B quote" },
  { label: "New move", href: "/admin/moves/new", description: "Schedule a move" },
  { label: "New contact", href: "/admin/clients/new", description: "Add a person or org" },
  { label: "New partner", href: "/admin/partners/new", description: "Onboard a B2B partner" },
  { label: "New delivery", href: "/admin/deliveries/new", description: "Create a B2B job" },
  { label: "New invoice", href: "/admin/invoices/new", description: "Invoice a client" },
]
