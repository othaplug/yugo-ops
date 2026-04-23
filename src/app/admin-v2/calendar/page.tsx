import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { CalendarClient } from "./calendar-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CalendarPage = async () => {
  const { moves } = await getAdminUniverse()
  return <CalendarClient moves={moves} />
}

export default CalendarPage
