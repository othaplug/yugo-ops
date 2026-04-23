import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { B2BClient } from "./b2b-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const B2BPage = async () => {
  const { b2bPartners } = await getAdminUniverse()
  return <B2BClient initialPartners={b2bPartners} />
}

export default B2BPage
