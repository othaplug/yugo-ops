import { createClient } from "@/lib/supabase/server"
import { isSuperAdminEmail } from "@/lib/super-admin"
import SettingsHub from "./SettingsHub"

export const metadata = { title: "Settings" }
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: pu } = user
    ? await supabase
        .from("platform_users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }
  const isSuper = isSuperAdminEmail(user?.email)
  const role = isSuper ? "owner" : pu?.role ?? "coordinator"
  return <SettingsHub role={role} isOwnerScope={isSuper} />
}
