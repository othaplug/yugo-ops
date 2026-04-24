"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ToastProvider } from "./Toast"
import { NotificationProvider } from "./NotificationContext"
import {
  PendingChangeRequestsProvider,
  usePendingChangeRequests,
} from "./PendingChangeRequestsContext"
import { ThemeProvider } from "./ThemeContext"
import RealtimeListener from "./RealtimeListener"
import SessionTimeout from "./SessionTimeout"
import OfflineBanner from "@/components/ui/OfflineBanner"
import { AdminShell } from "@/design-system/admin/layout"

function PendingAwareShell({
  children,
  user,
  isSuperAdmin,
  role,
}: {
  children: React.ReactNode
  user: any
  isSuperAdmin: boolean
  role: string
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const { pendingCount } = usePendingChangeRequests()
  const [quoteBadge, setQuoteBadge] = React.useState(0)
  const [notificationCount, setNotificationCount] = React.useState(0)

  React.useEffect(() => {
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "viewed"])
      .then(({ count }: { count: number | null }) => {
        if (typeof count === "number") setQuoteBadge(count)
      })
  }, [supabase])

  React.useEffect(() => {
    if (!user?.id) return
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null)
      .then(({ count }: { count: number | null }) => {
        if (typeof count === "number") setNotificationCount(count)
      })
  }, [supabase, user?.id])

  const handleSignOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }, [router, supabase])

  return (
    <AdminShell
      user={{
        id: user?.id,
        email: user?.email,
        full_name:
          user?.user_metadata?.full_name || user?.user_metadata?.name || null,
      }}
      role={role}
      isSuperAdmin={isSuperAdmin}
      badges={{ quotes: quoteBadge, changeRequests: pendingCount }}
      notificationCount={notificationCount}
      onSignOut={handleSignOut}
    >
      {children}
    </AdminShell>
  )
}

export default function AdminShellV3Wrapper({
  user,
  isSuperAdmin = false,
  role = "dispatcher",
  children,
}: {
  user: any
  isSuperAdmin?: boolean
  isAdmin?: boolean
  role?: string
  twoFactorEnabled?: boolean
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <PendingChangeRequestsProvider>
          <ToastProvider>
            <RealtimeListener />
            <SessionTimeout />
            <OfflineBanner />
            <PendingAwareShell user={user} isSuperAdmin={isSuperAdmin} role={role}>
              {children}
            </PendingAwareShell>
          </ToastProvider>
        </PendingChangeRequestsProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
