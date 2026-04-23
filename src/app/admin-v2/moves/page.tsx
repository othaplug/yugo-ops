import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { MovesClient } from "./moves-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MovesPage = async () => {
  const { moves } = await getAdminUniverse()
  return <MovesClient initialMoves={moves} />
}

export default MovesPage
