import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { BuildingsClient } from "./buildings-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const BuildingsPage = async () => {
  const { buildings } = await getAdminUniverse()
  return <BuildingsClient initialBuildings={buildings} />
}

export default BuildingsPage
