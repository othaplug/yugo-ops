"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import { ThemeProvider as AdminThemeProvider } from "@/app/admin/components/ThemeContext"
import type UnifiedTrackingViewType from "@/app/admin/crew/UnifiedTrackingView"

type DispatchTrackingProps = React.ComponentProps<typeof UnifiedTrackingViewType>

/** Client wrapper so the v1 `UnifiedTrackingView` (which depends on the admin
 * `ThemeContext`) renders cleanly inside /admin-v2 without leaking its chrome. */
const UnifiedTrackingView = dynamic(
  () => import("@/app/admin/crew/UnifiedTrackingView"),
  { ssr: false },
)

export const DispatchTracking = (props: DispatchTrackingProps) => (
  <AdminThemeProvider>
    <UnifiedTrackingView {...props} />
  </AdminThemeProvider>
)
