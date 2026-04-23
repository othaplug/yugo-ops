import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { QuotesClient } from "./quotes-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const QuotesPage = async () => {
  const { quotes } = await getAdminUniverse()
  return <QuotesClient initialQuotes={quotes} />
}

export default QuotesPage
