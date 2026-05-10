import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { CustomersClient } from "./customers-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CustomersPage = async () => {
  const { customers, moves, quotes, invoices } = await getAdminUniverse()
  return (
    <CustomersClient
      initialCustomers={customers}
      moves={moves}
      quotes={quotes}
      invoices={invoices}
    />
  )
}

export default CustomersPage
