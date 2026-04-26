"use client"

import Link from "next/link"
import type { Icon } from "@phosphor-icons/react"
import {
  User,
  Lock,
  Gear,
  UsersThree,
  Scroll,
  Buildings,
  Palette,
  Bell,
  Lightning,
  MapPin,
  Flag,
  Code,
} from "@/design-system/admin/icons"
import { cn } from "@/design-system/admin/lib/cn"

type LinkCard = {
  href: string
  title: string
  description: string
  Icon: Icon
  minRole?: "owner" | "admin" | "coordinator"
}

const baseLinks: LinkCard[] = [
  {
    href: "/admin/settings/personal",
    title: "Personal & profile",
    description: "Name, email, and appearance.",
    Icon: User,
  },
  {
    href: "/admin/settings/security",
    title: "Security",
    description: "Password and two factor authentication.",
    Icon: Lock,
  },
  {
    href: "/admin/settings/appearance",
    title: "Appearance",
    description: "Theme and display preferences.",
    Icon: Palette,
  },
  {
    href: "/admin/settings/notifications",
    title: "Notifications",
    description: "Alerts and in app notices.",
    Icon: Bell,
  },
  {
    href: "/admin/settings/integrations",
    title: "Integrations",
    description: "Email and third party connections.",
    Icon: Lightning,
  },
  {
    href: "/admin/audit-log",
    title: "Change log",
    description: "History of important account and operations actions.",
    Icon: Scroll,
    minRole: "admin",
  },
]

const ownerLinks: LinkCard[] = [
  {
    href: "/admin/platform",
    title: "Platform",
    description: "Pricing, equipment, and global configuration.",
    Icon: Gear,
    minRole: "owner",
  },
  {
    href: "/admin/buildings",
    title: "Buildings",
    description: "Facility and address records for moves and storage.",
    Icon: MapPin,
    minRole: "owner",
  },
  {
    href: "/admin/settings/platform/feature-flags",
    title: "Feature flags",
    description: "Product experiments and rollout switches.",
    Icon: Flag,
    minRole: "owner",
  },
  {
    href: "/admin/settings/platform/developer",
    title: "Developer",
    description: "API keys, webhooks, and technical tools.",
    Icon: Code,
    minRole: "owner",
  },
  {
    href: "/admin/users",
    title: "Users & access",
    description: "Team members and platform accounts.",
    Icon: UsersThree,
    minRole: "owner",
  },
  {
    href: "/admin/settings/operations/business-info",
    title: "Operations",
    description: "Business information and templates.",
    Icon: Buildings,
    minRole: "owner",
  },
]

const ROLE: Record<string, number> = {
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

export default function SettingsHub({
  role,
  isOwnerScope,
}: {
  role: string
  isOwnerScope: boolean
}) {
  const level = ROLE[role] ?? 0
  const showAdmin = level >= 80 || isOwnerScope
  const showOwner = level >= 100 || isOwnerScope

  const all = [
    ...baseLinks.filter(
      (l) => !l.minRole || (l.minRole === "admin" && showAdmin),
    ),
    ...ownerLinks.filter(() => showOwner),
  ]

  return (
    <div className="w-full">
      <p className="yu3-t-eyebrow mb-4">Overview</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((item) => {
          const Ic = item.Icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex gap-3 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 transition-colors",
                "hover:border-[var(--yu3-wine-tint)] hover:bg-[var(--yu3-wine-wash)]/40",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] text-[var(--yu3-wine)] group-hover:bg-[var(--yu3-wine-tint)]">
                <Ic size={20} weight="regular" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--yu3-ink-strong)] group-hover:text-[var(--yu3-wine)]">
                  {item.title}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--yu3-ink-muted)]">
                  {item.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
