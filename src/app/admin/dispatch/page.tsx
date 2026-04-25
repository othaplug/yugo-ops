export const metadata = { title: "Dispatch" }
export const dynamic = "force-dynamic"
export const revalidate = 0

import DispatchBoardClient from "./DispatchBoardClient"
import { getTodayString } from "@/lib/business-timezone"

export default function AdminDispatchPage() {
  const today = getTodayString()
  return <DispatchBoardClient today={today} />
}
