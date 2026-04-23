import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { CustomersClient } from "./customers-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CustomersPage = async () => {
  const { customers } = await getAdminUniverse()
  return <CustomersClient initialCustomers={customers} />
}

export default CustomersPage
