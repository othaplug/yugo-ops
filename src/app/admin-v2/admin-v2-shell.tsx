"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"
import { ThemeProvider } from "@/components/admin-v2/providers/theme-provider"
import { QueryProvider } from "@/components/admin-v2/providers/query-provider"
import { AdminShell, type AdminShellUser } from "@/components/admin-v2/layout"

type AdminV2ShellProps = {
  user: AdminShellUser
  children: React.ReactNode
}

export const AdminV2Shell = ({ user, children }: AdminV2ShellProps) => {
  const router = useRouter()

  const handleSignOut = React.useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }, [router])

  return (
    <ThemeProvider>
      <QueryProvider>
        <AdminShell user={user} onSignOut={handleSignOut}>
          {children}
        </AdminShell>
      </QueryProvider>
    </ThemeProvider>
  )
}
