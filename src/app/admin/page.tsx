export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = { title: "Overview" }

/** Admin home (`/admin`): Command Center. `AdminPageClient.tsx` is an unused legacy shell. */
import CommandCenterV3Client from "./CommandCenterV3Client"
import { loadCommandCenterData } from "@/lib/admin/command-center-data"

const AdminPage = async () => {
  const data = await loadCommandCenterData()
  const { revenueV2, ...v1 } = data
  return <CommandCenterV3Client {...v1} revenueByDay={revenueV2.byDay} />
}

export default AdminPage
