import { notFound } from "next/navigation"
import { TableHarness } from "./table-harness"

export default function AdminV2TableDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }
  return <TableHarness />
}
