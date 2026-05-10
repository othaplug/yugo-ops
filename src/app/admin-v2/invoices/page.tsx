import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { InvoicesClient } from "./invoices-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const InvoicesPage = async () => {
  const { invoices, moves } = await getAdminUniverse()
  return <InvoicesClient initialInvoices={invoices} moves={moves} />
}

export default InvoicesPage
