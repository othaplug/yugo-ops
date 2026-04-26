"use client"

import { usePathname } from "next/navigation"
import { BackToSettingsOverview } from "../components/BackToSettingsOverview"

/**
 * On settings subpages, link back to the card overview. Hidden on /admin/settings.
 */
export default function SettingsBackToHub() {
  const pathname = usePathname() || ""
  const isHub =
    pathname === "/admin/settings" || pathname === "/admin/settings/"
  if (isHub) {
    return null
  }

  return <BackToSettingsOverview />
}
