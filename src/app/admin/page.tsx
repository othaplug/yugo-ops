export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = { title: "Command Center" }

import AdminPageClient from "./AdminPageClient"
import { loadCommandCenterData } from "@/lib/admin/command-center-data"

const AdminPage = async () => {
  const data = await loadCommandCenterData()
  const { revenueV2: _revenueV2, ...v1 } = data
  return <AdminPageClient {...v1} />
}

export default AdminPage
