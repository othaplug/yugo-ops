import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { CrewClient } from "./crew-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CrewPage = async () => {
  const { crew, moves } = await getAdminUniverse()
  return <CrewClient initialCrew={crew} moves={moves} />
}

export default CrewPage
