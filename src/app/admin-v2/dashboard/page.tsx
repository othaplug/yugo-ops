import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { DashboardClient } from "./dashboard-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const DashboardPage = async () => {
  const { leads, moves, quotes, crew } = await getAdminUniverse()
  return (
    <DashboardClient leads={leads} moves={moves} quotes={quotes} crew={crew} />
  )
}

export default DashboardPage
