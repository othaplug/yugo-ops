import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { DispatchClient } from "./dispatch-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const DispatchPage = async () => {
  const { moves } = await getAdminUniverse()
  return <DispatchClient moves={moves} />
}

export default DispatchPage
