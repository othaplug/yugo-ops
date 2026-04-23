import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { LeadsClient } from "./leads-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const LeadsPage = async () => {
  const { leads } = await getAdminUniverse()
  return <LeadsClient initialLeads={leads} />
}

export default LeadsPage
