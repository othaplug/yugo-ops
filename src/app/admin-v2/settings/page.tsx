import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { SettingsClient } from "./settings-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const SettingsPage = async () => {
  const { platformUsers } = await getAdminUniverse()
  return <SettingsClient platformUsers={platformUsers} />
}

export default SettingsPage
