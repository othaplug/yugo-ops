import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { InvoicesClient } from "./invoices-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const InvoicesPage = async () => {
  const { invoices } = await getAdminUniverse()
  return <InvoicesClient initialInvoices={invoices} />
}

export default InvoicesPage
