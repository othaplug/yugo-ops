import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { PMClient } from "./pm-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const PMPage = async () => {
  const { pmAccounts, moves } = await getAdminUniverse()
  return <PMClient initialAccounts={pmAccounts} moves={moves} />
}

export default PMPage
