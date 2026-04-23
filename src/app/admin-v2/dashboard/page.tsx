import { createClient } from "@/lib/supabase/server"
import { loadCommandCenterData } from "@/lib/admin/command-center-data"
import { DashboardClient } from "./dashboard-client"

export const metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"
export const revalidate = 0

const DashboardPage = async () => {
  const data = await loadCommandCenterData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let userFirstName: string | null = null
  if (user) {
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
    const raw =
      platformUser?.full_name?.trim() || user.email?.split("@")[0] || ""
    userFirstName = raw ? raw.split(/\s+/)[0] ?? null : null
  }

  return <DashboardClient {...data} userFirstName={userFirstName} />
}

export default DashboardPage
