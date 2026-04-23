import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSuperAdminEmail } from "@/lib/super-admin"
import { AdminV2Shell } from "./admin-v2-shell"

type PlatformUser = {
  role: string | null
  two_factor_enabled: boolean | null
  full_name: string | null
}

export const dynamic = "force-dynamic"

const AdminV2Layout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()

  let user: { id: string; email?: string } | null = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/refresh\s*token|AuthApiError/i.test(msg)) {
      await supabase.auth.signOut()
      redirect("/login")
    }
    throw err
  }

  if (!user) redirect("/login")

  const { data: platformUser } = (await supabase
    .from("platform_users")
    .select("role, two_factor_enabled, full_name")
    .eq("user_id", user.id)
    .maybeSingle()) as { data: PlatformUser | null }

  const isSuperAdmin = isSuperAdminEmail(user.email)
  if (!platformUser && !isSuperAdmin) redirect("/partner")

  const displayName =
    platformUser?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Admin user"

  return (
    <AdminV2Shell
      user={{
        name: displayName,
        email: user.email,
      }}
    >
      {children}
    </AdminV2Shell>
  )
}

export default AdminV2Layout
